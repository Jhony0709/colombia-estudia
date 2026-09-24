/**
 * La bandeja de staff (`/inicio`, ola 3 UX, 23/9): lo que requiere atención hoy y cómo van
 * los tres embudos de la ola 1, en una sola consulta por bloque.
 * SSOT: docs/ux/decision-ux-2309.md («Aterrizaje de ADMIN»: pantalla de situación, no de
 * configuración), reference/01-routing/routes.md (`/inicio`).
 *
 * Nada de aquí es una verdad nueva: cada línea de «requiere atención» apunta a la pantalla
 * que ya existe para resolverla, y cada cifra de embudo sale de tablas que ya se escriben
 * (`Person`/`Membership`, `LessonProgress`, `Submission`). No hay eventos de telemetría
 * propios; el tercer embudo de la ola 1 («sesiones con error no recuperado») no se puede
 * medir sin ellos y por eso no aparece.
 */

import 'server-only';

import { createTenantClient } from '@/lib/db/tenant';
import { planCohortOpening } from '@/features/cohorts/server/cohorts.service';

export type AttentionKind =
  | 'submissions' // entregas por revisar, por cohorte
  | 'planned_missing' // cohorte planificada con piezas sin publicar
  | 'content_updates' // cohorte abierta con contenido publicado que no tiene
  | 'invitations' // invitaciones que vencen en 7 días
  | 'overdue'; // cuotas vencidas sin pagar

export interface AttentionItem {
  kind: AttentionKind;
  count: number;
  href: string;
  /** La cohorte a la que pertenece, cuando la línea es de una cohorte. */
  cohort?: { code: string; name: string };
}

export interface Funnel {
  /** Los que entraron al embudo en el periodo. */
  entered: number;
  /** Los que llegaron al final. */
  completed: number;
}

export interface StaffInbox {
  attention: AttentionItem[];
  funnels: {
    /** ISO del inicio del periodo (30 días). */
    since: string;
    /** Personas nuevas con rol de estudiante → con al menos un tema completado. */
    onboarding: Funnel;
    /** Temas empezados → completados. */
    lessons: Funnel;
    /** Actividades enviadas → aprobadas. */
    submissions: Funnel;
  };
  /**
   * El recorrido del estudiante en 30 días, en personas distintas por paso (E0 de la
   * decisión del estudiante, 23/9). Sale de `LearningEvent`: los dos eventos que declara el
   * cliente (`student.primary_action.*`) y los que ya emitía el servidor.
   */
  journey: JourneyStep[];
}

export type JourneyStepKey =
  | 'saw_action' // vio la acción principal en /aprender
  | 'clicked_action' // la pulsó
  | 'opened_lesson' // abrió un tema
  | 'reached_end' // llegó al final del contenido (scroll, vídeo al 90 % o transcripción)
  | 'completed' // completó un tema o envió una actividad
  | 'continued'; // pulsó «Siguiente» / «Ir al examen» en la barra del player

export interface JourneyStep {
  key: JourneyStepKey;
  /** Personas distintas que dieron este paso en el periodo. */
  people: number;
}

// `where` va sin tipo de Prisma (`@prisma/client` solo en lib/db): filtros JSON de Postgres
// (`path` + `equals`); `in` no existe para JSON, por eso el `OR` del último paso.
const JOURNEY: ReadonlyArray<{ key: JourneyStepKey; types: string[]; where?: object }> = [
  {
    key: 'saw_action',
    types: ['student.primary_action.shown'],
    where: { payload: { path: ['screen'], equals: 'aprender' } },
  },
  {
    key: 'clicked_action',
    types: ['student.primary_action.clicked'],
    where: { payload: { path: ['screen'], equals: 'aprender' } },
  },
  { key: 'opened_lesson', types: ['lesson.opened'] },
  {
    key: 'reached_end',
    types: ['lesson.scrolled_to_end', 'lesson.video.progress', 'lesson.transcript.read'],
  },
  { key: 'completed', types: ['lesson.completed', 'submission_received'] },
  {
    key: 'continued',
    types: ['student.primary_action.clicked'],
    where: {
      AND: [
        { payload: { path: ['screen'], equals: 'lesson' } },
        {
          OR: [
            { payload: { path: ['action'], equals: 'next' } },
            { payload: { path: ['action'], equals: 'exam' } },
          ],
        },
      ],
    },
  },
];

const DAY = 24 * 60 * 60 * 1000;

export async function getStaffInbox({
  institutionId,
  now = new Date(),
}: {
  institutionId: string;
  now?: Date;
}): Promise<StaffInbox> {
  const db = createTenantClient(institutionId);
  const since = new Date(now.getTime() - 30 * DAY);
  const in7 = new Date(now.getTime() + 7 * DAY);

  const [submitted, planned, open, invitations, overdue, newStudents, lessonsOpened, sent] =
    await Promise.all([
      db.submission.findMany({
        where: { status: 'SUBMITTED' },
        select: {
          assignment: {
            select: { cohortId: true, cohort: { select: { code: true, name: true } } },
          },
        },
      }),
      db.cohort.findMany({
        where: { status: 'PLANNED' },
        orderBy: { startsOn: 'asc' },
        select: {
          id: true,
          code: true,
          name: true,
          program: {
            select: {
              modules: {
                where: { archivedAt: null },
                select: {
                  lessons: {
                    where: { archivedAt: null },
                    select: {
                      id: true,
                      title: true,
                      versions: {
                        where: { status: 'PUBLISHED' },
                        orderBy: { number: 'desc' },
                        take: 1,
                        select: { id: true, number: true, status: true },
                      },
                    },
                  },
                  assessments: {
                    where: { archivedAt: null },
                    select: {
                      id: true,
                      title: true,
                      versions: {
                        where: { status: 'PUBLISHED' },
                        orderBy: { number: 'desc' },
                        take: 1,
                        select: { id: true, number: true, status: true },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      }),
      db.cohort.findMany({
        where: { status: 'OPEN' },
        select: {
          id: true,
          code: true,
          name: true,
          programId: true,
          lessonAssignments: { select: { lessonId: true } },
          assessmentAssignments: { select: { assessmentId: true } },
        },
      }),
      db.invitation.count({
        where: {
          acceptedAt: null,
          expiresAt: { gt: now, lte: in7 },
          person: { anonymizedAt: null },
        },
      }),
      db.installment.count({
        where: { status: { in: ['OPEN', 'PARTIALLY_PAID'] }, dueOn: { lt: now } },
      }),
      db.person.findMany({
        where: {
          createdAt: { gte: since },
          anonymizedAt: null,
          memberships: { some: { role: 'STUDENT', revokedAt: null } },
        },
        select: {
          id: true,
          lessonProgress: { where: { status: 'COMPLETED' }, take: 1, select: { id: true } },
        },
      }),
      db.lessonProgress.groupBy({
        by: ['status'],
        where: { startedAt: { gte: since } },
        _count: { _all: true },
      }),
      db.submission.groupBy({
        by: ['status'],
        where: { submittedAt: { gte: since } },
        _count: { _all: true },
      }),
    ]);

  const attention: AttentionItem[] = [];

  // Entregas por revisar, una línea por cohorte, la que más tiene primero.
  const byCohort = new Map<string, { count: number; cohort: { code: string; name: string } }>();
  for (const s of submitted) {
    const entry = byCohort.get(s.assignment.cohortId) ?? { count: 0, cohort: s.assignment.cohort };
    entry.count += 1;
    byCohort.set(s.assignment.cohortId, entry);
  }
  for (const [cohortId, { count, cohort }] of [...byCohort].sort(
    (a, b) => b[1].count - a[1].count
  )) {
    attention.push({
      kind: 'submissions',
      count,
      href: `/cohortes/${cohortId}/actividades`,
      cohort,
    });
  }

  // Cohortes planificadas a las que abrir les dejaría piezas fuera.
  for (const c of planned) {
    const plan = planCohortOpening(
      c.program.modules.flatMap((m) => m.lessons),
      c.program.modules.flatMap((m) => m.assessments)
    );
    if (plan.missing.length > 0) {
      attention.push({
        kind: 'planned_missing',
        count: plan.missing.length,
        href: `/cohortes/${c.id}`,
        cohort: { code: c.code, name: c.name },
      });
    }
  }

  // Cohortes abiertas con contenido publicado del programa que aún no tienen.
  if (open.length > 0) {
    const programIds = [...new Set(open.map((c) => c.programId))];
    const published = await db.module.findMany({
      where: { programId: { in: programIds }, archivedAt: null },
      select: {
        programId: true,
        lessons: {
          where: { archivedAt: null, versions: { some: { status: 'PUBLISHED' } } },
          select: { id: true },
        },
        assessments: {
          where: { archivedAt: null, versions: { some: { status: 'PUBLISHED' } } },
          select: { id: true },
        },
      },
    });
    for (const c of open) {
      const modules = published.filter((m) => m.programId === c.programId);
      const hasLesson = new Set(c.lessonAssignments.map((a) => a.lessonId));
      const hasAssessment = new Set(c.assessmentAssignments.map((a) => a.assessmentId));
      const missing =
        modules.flatMap((m) => m.lessons).filter((l) => !hasLesson.has(l.id)).length +
        modules.flatMap((m) => m.assessments).filter((a) => !hasAssessment.has(a.id)).length;
      if (missing > 0) {
        attention.push({
          kind: 'content_updates',
          count: missing,
          href: `/cohortes/${c.id}?seccion=ruta`,
          cohort: { code: c.code, name: c.name },
        });
      }
    }
  }

  if (invitations > 0) {
    attention.push({
      kind: 'invitations',
      count: invitations,
      href: '/personas?invitacion=pendiente',
    });
  }
  if (overdue > 0) {
    attention.push({ kind: 'overdue', count: overdue, href: '/cartera?estado=OVERDUE' });
  }

  // El recorrido: personas distintas por paso. Un `groupBy` por paso; son seis consultas
  // pequeñas sobre un índice (`institutionId, type, occurredAt`).
  const journey = await Promise.all(
    JOURNEY.map(async (step) => {
      const rows = await db.learningEvent.groupBy({
        by: ['studentId'],
        where: { type: { in: step.types }, occurredAt: { gte: since }, ...(step.where ?? {}) },
      });
      return { key: step.key, people: rows.length };
    })
  );

  const countOf = (rows: Array<{ status: string; _count: { _all: number } }>, status: string) =>
    rows.find((r) => r.status === status)?._count._all ?? 0;
  const lessonsCompleted = countOf(lessonsOpened, 'COMPLETED');
  const lessonsInProgress = countOf(lessonsOpened, 'IN_PROGRESS');

  return {
    attention,
    funnels: {
      since: since.toISOString(),
      onboarding: {
        entered: newStudents.length,
        completed: newStudents.filter((p) => p.lessonProgress.length > 0).length,
      },
      lessons: { entered: lessonsCompleted + lessonsInProgress, completed: lessonsCompleted },
      submissions: {
        entered: countOf(sent, 'SUBMITTED') + countOf(sent, 'RETURNED') + countOf(sent, 'APPROVED'),
        completed: countOf(sent, 'APPROVED'),
      },
    },
    journey,
  };
}
