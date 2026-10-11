import 'server-only';

/** Opinión al terminar un componente (11/10): recomendada y con nombre; una nota baja avisa. */

import { createTenantClient } from '@/lib/db/tenant';
import { APIError } from '@/lib/core/errors';
import { isUniqueViolation } from '@/lib/db/errors';
import { getCohortOutline, type CohortOutline } from '@/features/learn/server/cohort.service';
import { notifyMany, staffPersonIds } from '@/features/notifications/server/notifications.service';

export const FEEDBACK_SCORES = ['usefulness', 'understanding', 'clarity', 'support'] as const;
export type FeedbackScore = (typeof FEEDBACK_SCORES)[number];
/** Una nota así o menor avisa a operación. */
export const LOW_SCORE = 2;

export interface FeedbackInput {
  usefulness: number;
  understanding: number;
  clarity: number;
  /** Nulo: no necesitó la atención. */
  support: number | null;
  comment: string | null;
}

export interface ModuleFeedbackContext {
  enrollmentId: string;
  cohortId: string;
  programName: string;
  module: { id: string; name: string; position: number };
  /** Terminó el componente: solo entonces se le pregunta. */
  eligible: boolean;
  /** ISO: ya respondió. */
  answeredAt: string | null;
  /** El siguiente componente bloqueado, para ofrecer pedir que lo habiliten al terminar. */
  nextLocked: { id: string; name: string } | null;
}

/** Un componente está terminado cuando tiene ítems y todos están completados. */
export function moduleDone(items: ReadonlyArray<{ status: string }>): boolean {
  return items.length > 0 && items.every((item) => item.status === 'COMPLETED');
}

/** La nota más baja de una respuesta (sin contar la atención que no se necesitó). */
export function lowestScore(input: Pick<FeedbackInput, FeedbackScore>): number {
  return Math.min(
    ...FEEDBACK_SCORES.map((key) => input[key]).filter((v): v is number => v !== null)
  );
}

/** El contexto de la encuesta para la persona que pregunta; `null` si no es suya o no existe. */
export async function getModuleFeedbackContext({
  institutionId,
  personId,
  enrollmentId,
  moduleId,
  now = new Date(),
}: {
  institutionId: string;
  personId: string;
  enrollmentId: string;
  moduleId: string;
  now?: Date;
}): Promise<ModuleFeedbackContext | null> {
  const db = createTenantClient(institutionId);
  const enrollment = await db.enrollment.findFirst({
    where: { id: enrollmentId, studentId: personId },
    select: {
      id: true,
      status: true,
      startsAtModule: true,
      cohort: { select: { id: true, programId: true, program: { select: { name: true } } } },
    },
  });
  if (!enrollment) return null;

  const component = await db.module.findFirst({
    where: {
      id: moduleId,
      programId: enrollment.cohort.programId,
      archivedAt: null,
      position: { gte: enrollment.startsAtModule ?? 1 },
    },
    select: { id: true, name: true, position: true },
  });
  if (!component) return null;

  const existing = await db.moduleFeedback.findFirst({
    where: { enrollmentId, moduleId },
    select: { createdAt: true },
  });

  // Matrícula terminada: todos sus componentes lo están. Activa: lo dice la ruta.
  let eligible = enrollment.status === 'COMPLETED';
  let nextLocked: ModuleFeedbackContext['nextLocked'] = null;
  if (enrollment.status === 'ACTIVE') {
    const outline = await getCohortOutline({ institutionId, personId, enrollmentId, now });
    const current = outline.modules.find((m) => m.id === moduleId);
    eligible = !outline.gate && !!current && moduleDone(current.items);
    const locked = outline.modules.find((m) => m.access.state === 'LOCKED');
    if (locked && locked.position > component.position) {
      nextLocked = { id: locked.id, name: locked.name };
    }
  }

  return {
    enrollmentId: enrollment.id,
    cohortId: enrollment.cohort.id,
    programName: enrollment.cohort.program.name,
    module: component,
    eligible,
    answeredAt: existing?.createdAt.toISOString() ?? null,
    nextLocked,
  };
}

export interface SubmittedFeedback {
  /** ISO */
  createdAt: string;
  /** Ya había respondido: no se guardó otra ni se avisó otra vez. */
  already: boolean;
}

export async function submitModuleFeedback({
  institutionId,
  personId,
  enrollmentId,
  moduleId,
  input,
  now = new Date(),
}: {
  institutionId: string;
  personId: string;
  enrollmentId: string;
  moduleId: string;
  input: FeedbackInput;
  now?: Date;
}): Promise<SubmittedFeedback> {
  const context = await getModuleFeedbackContext({
    institutionId,
    personId,
    enrollmentId,
    moduleId,
    now,
  });
  if (!context) throw new APIError('Not found', 'NOT_FOUND');
  if (context.answeredAt) return { createdAt: context.answeredAt, already: true };
  if (!context.eligible) {
    throw new APIError('Termina el componente para contarnos cómo te fue', 'CONFLICT');
  }

  const db = createTenantClient(institutionId);
  const comment = input.comment?.trim() ? input.comment.trim() : null;
  let created: { id: string; createdAt: Date };
  try {
    created = await db.moduleFeedback.create({
      data: {
        institutionId,
        enrollmentId,
        moduleId,
        usefulness: input.usefulness,
        understanding: input.understanding,
        clarity: input.clarity,
        support: input.support,
        comment,
        createdAt: now,
      },
      select: { id: true, createdAt: true },
    });
  } catch (err) {
    // Dos envíos a la vez: el otro ganó el índice único.
    if (!isUniqueViolation(err)) throw err;
    const again = await db.moduleFeedback.findFirst({
      where: { enrollmentId, moduleId },
      select: { createdAt: true },
    });
    if (!again) throw err;
    return { createdAt: again.createdAt.toISOString(), already: true };
  }

  const lowest = lowestScore(input);
  if (lowest <= LOW_SCORE) {
    const person = await db.person.findFirst({
      where: { id: personId },
      select: { givenName: true, familyName: true },
    });
    const staff = await staffPersonIds(institutionId, ['OPERATIONS', 'ADMIN']);
    await notifyMany(institutionId, staff, {
      type: 'feedback_low',
      title: 'Opinión con nota baja',
      body: `${person?.givenName ?? ''} ${person?.familyName ?? ''} calificó ${context.module.name} con ${lowest} de 5.`.trim(),
      href: `/cohortes/${context.cohortId}/opiniones`,
      dedupeKey: `module_feedback:${created.id}`,
    });
  }

  return { createdAt: created.createdAt.toISOString(), already: false };
}

/** El último componente terminado sin opinión (con la matrícula terminada, el último). */
export async function getFeedbackInvite({
  institutionId,
  enrollmentId,
  outline,
}: {
  institutionId: string;
  enrollmentId: string;
  outline: Pick<CohortOutline, 'gate' | 'modules'>;
}): Promise<{ moduleId: string; moduleName: string } | null> {
  const db = createTenantClient(institutionId);
  let candidate: { id: string; name: string } | null = null;
  if (outline.gate === null) {
    candidate = [...outline.modules].reverse().find((m) => moduleDone(m.items)) ?? null;
  } else if (outline.gate.kind === 'COMPLETED') {
    const enrollment = await db.enrollment.findFirst({
      where: { id: enrollmentId },
      select: { cohort: { select: { programId: true } } },
    });
    if (enrollment) {
      candidate = await db.module.findFirst({
        where: { programId: enrollment.cohort.programId, archivedAt: null },
        orderBy: { position: 'desc' },
        select: { id: true, name: true },
      });
    }
  }
  if (!candidate) return null;
  const answered = await db.moduleFeedback.findFirst({
    where: { enrollmentId, moduleId: candidate.id },
    select: { id: true },
  });
  return answered ? null : { moduleId: candidate.id, moduleName: candidate.name };
}

// ─────────────────────────── Para el equipo ───────────────────────────

export interface FeedbackEntry {
  id: string;
  enrollmentId: string;
  personName: string;
  scores: Record<FeedbackScore, number | null>;
  comment: string | null;
  /** ISO */
  createdAt: string;
  low: boolean;
}

export interface ModuleFeedbackSummary {
  id: string;
  position: number;
  name: string;
  responses: number;
  /** Promedio con un decimal; nulo sin respuestas (o, en atención, si nadie la necesitó). */
  averages: Record<FeedbackScore, number | null>;
  low: number;
  /** Las que dicen algo: con comentario o con nota baja. Más nuevas primero. */
  entries: FeedbackEntry[];
}

export interface CohortFeedback {
  cohort: { id: string; code: string; name: string; programName: string };
  responses: number;
  modules: ModuleFeedbackSummary[];
}

interface FeedbackRow {
  id: string;
  moduleId: string;
  enrollmentId: string;
  personName: string;
  usefulness: number;
  understanding: number;
  clarity: number;
  support: number | null;
  comment: string | null;
  createdAt: Date;
}

const average = (values: number[]): number | null =>
  values.length === 0
    ? null
    : Math.round((values.reduce((sum, v) => sum + v, 0) / values.length) * 10) / 10;

/** Pura: agrupa por componente, en el orden de la ruta. */
export function summarizeFeedback(
  modules: ReadonlyArray<{ id: string; position: number; name: string }>,
  rows: ReadonlyArray<FeedbackRow>
): ModuleFeedbackSummary[] {
  return modules.map((module) => {
    const mine = rows
      .filter((row) => row.moduleId === module.id)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    const averages = Object.fromEntries(
      FEEDBACK_SCORES.map((key) => [
        key,
        average(mine.map((row) => row[key]).filter((v): v is number => v !== null)),
      ])
    ) as Record<FeedbackScore, number | null>;
    const entries = mine.flatMap((row): FeedbackEntry[] => {
      const low = lowestScore(row) <= LOW_SCORE;
      if (!low && !row.comment) return [];
      return [
        {
          id: row.id,
          enrollmentId: row.enrollmentId,
          personName: row.personName,
          scores: {
            usefulness: row.usefulness,
            understanding: row.understanding,
            clarity: row.clarity,
            support: row.support,
          },
          comment: row.comment,
          createdAt: row.createdAt.toISOString(),
          low,
        },
      ];
    });
    return {
      id: module.id,
      position: module.position,
      name: module.name,
      responses: mine.length,
      averages,
      low: entries.filter((entry) => entry.low).length,
      entries,
    };
  });
}

export async function getCohortFeedback({
  institutionId,
  cohortId,
}: {
  institutionId: string;
  cohortId: string;
}): Promise<CohortFeedback | null> {
  const db = createTenantClient(institutionId);
  const cohort = await db.cohort.findFirst({
    where: { id: cohortId },
    select: {
      id: true,
      code: true,
      name: true,
      programId: true,
      program: { select: { name: true } },
    },
  });
  if (!cohort) return null;

  const [modules, rows] = await Promise.all([
    db.module.findMany({
      where: { programId: cohort.programId, archivedAt: null },
      orderBy: { position: 'asc' },
      select: { id: true, position: true, name: true },
    }),
    db.moduleFeedback.findMany({
      where: { enrollment: { cohortId } },
      select: {
        id: true,
        moduleId: true,
        enrollmentId: true,
        usefulness: true,
        understanding: true,
        clarity: true,
        support: true,
        comment: true,
        createdAt: true,
        enrollment: { select: { student: { select: { givenName: true, familyName: true } } } },
      },
    }),
  ]);

  return {
    cohort: {
      id: cohort.id,
      code: cohort.code,
      name: cohort.name,
      programName: cohort.program.name,
    },
    responses: rows.length,
    modules: summarizeFeedback(
      modules,
      rows.map(({ enrollment, ...row }) => ({
        ...row,
        personName: `${enrollment.student.givenName} ${enrollment.student.familyName}`.trim(),
      }))
    ),
  };
}
