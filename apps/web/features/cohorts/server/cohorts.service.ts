/**
 * Cohorts: create, open, close.
 * SSOT: plan/06-cohortes-y-personas.md:23-30 (§3 Cohortes), routes.md (/cohortes).
 *
 * Opening is the interesting one: it freezes the content the cohort will study by creating
 * an assignment per lesson and per assessment, each pinned to the version that is published
 * *now*. If anything lacks a published version the cohort does not open and the list of what
 * is missing comes back — a half-open cohort would leave students staring at gaps.
 */

import 'server-only';

import { createTenantClient } from '@/lib/db/tenant';
import { isUniqueViolation } from '@/lib/db/errors';
import { APIError } from '@/lib/core/errors';
import { listRecentActivity } from '@/lib/audit/recent-activity';

export type CohortStatus = 'PLANNED' | 'OPEN' | 'CLOSED' | 'ARCHIVED';
export type Progression = 'LINEAR' | 'FREE';

export const PROGRESSIONS: readonly Progression[] = ['LINEAR', 'FREE'];
export const COHORT_STATUSES: readonly CohortStatus[] = ['PLANNED', 'OPEN', 'CLOSED', 'ARCHIVED'];

export interface CohortRow {
  id: string;
  code: string;
  name: string;
  status: CohortStatus;
  programCode: string;
  programName: string;
  partnerName: string | null;
  startsOn: string;
  endsOn: string;
  enrollmentCount: number;
}

// ─────────────────────────── Pure core ───────────────────────────

interface VersionLike {
  id: string;
  status: string;
  number: number;
}

interface PublishableLike {
  id: string;
  title: string;
  versions: VersionLike[];
}

/** The published version with the highest number, or null if none is published. */
export function pickPublishedVersion(versions: VersionLike[]): VersionLike | null {
  const published = versions.filter((v) => v.status === 'PUBLISHED');
  if (published.length === 0) return null;
  return published.reduce((best, v) => (v.number > best.number ? v : best));
}

export interface OpeningPlan {
  lessons: Array<{ lessonId: string; lessonVersionId: string }>;
  assessments: Array<{ assessmentId: string; assessmentVersionId: string }>;
  missing: Array<{ kind: 'lesson' | 'assessment'; title: string }>;
}

/**
 * Works out what the cohort would be assigned, and what is blocking it.
 * Pure on purpose: this is the rule the plan states, and it deserves a test that does not
 * need a database.
 */
export function planCohortOpening(
  lessons: PublishableLike[],
  assessments: PublishableLike[]
): OpeningPlan {
  const plan: OpeningPlan = { lessons: [], assessments: [], missing: [] };

  for (const lesson of lessons) {
    const version = pickPublishedVersion(lesson.versions);
    if (version) {
      plan.lessons.push({ lessonId: lesson.id, lessonVersionId: version.id });
    } else {
      plan.missing.push({ kind: 'lesson', title: lesson.title });
    }
  }

  for (const assessment of assessments) {
    const version = pickPublishedVersion(assessment.versions);
    if (version) {
      plan.assessments.push({ assessmentId: assessment.id, assessmentVersionId: version.id });
    } else {
      plan.missing.push({ kind: 'assessment', title: assessment.title });
    }
  }

  return plan;
}

// ─────────────────────────── Queries ───────────────────────────

export interface CohortFilters {
  status: CohortStatus | null;
  /** Programa por id; `null` = todos. */
  programId: string | null;
  /** Busca en código y nombre. */
  q: string;
}

export async function listCohorts({
  institutionId,
  status,
  programId = null,
  q = '',
}: {
  institutionId: string;
  status: CohortStatus | null;
  programId?: string | null;
  q?: string;
}): Promise<CohortRow[]> {
  const db = createTenantClient(institutionId);

  const cohorts = await db.cohort.findMany({
    where: {
      ...(status ? { status } : {}),
      ...(programId ? { programId } : {}),
      ...(q
        ? {
            OR: [
              { code: { contains: q, mode: 'insensitive' } },
              { name: { contains: q, mode: 'insensitive' } },
            ],
          }
        : {}),
    },
    orderBy: [{ startsOn: 'desc' }, { code: 'asc' }],
    select: {
      id: true,
      code: true,
      name: true,
      status: true,
      startsOn: true,
      endsOn: true,
      program: { select: { code: true, name: true } },
      partner: { select: { name: true } },
      _count: { select: { enrollments: true } },
    },
  });

  return cohorts.map((c) => ({
    id: c.id,
    code: c.code,
    name: c.name,
    status: c.status as CohortStatus,
    programCode: c.program.code,
    programName: c.program.name,
    partnerName: c.partner?.name ?? null,
    startsOn: c.startsOn.toISOString().slice(0, 10),
    endsOn: c.endsOn.toISOString().slice(0, 10),
    enrollmentCount: c._count.enrollments,
  }));
}

// ─────────────────────────── Mutations ───────────────────────────

// ─────────────────────────── Indicadores y carril (19/9) ───────────────────────────

export interface CohortStats {
  open: number;
  planned: number;
  /** Matrículas ACTIVE en cohortes abiertas. */
  activeEnrollments: number;
  /** Cohortes abiertas que terminan en los próximos 30 días. */
  endingSoon: number;
}

/** Solo el número actual (decisión 19/9: sin «vs. mes anterior» hasta tener histórico). */
export async function getCohortStats({
  institutionId,
  now = new Date(),
}: {
  institutionId: string;
  now?: Date;
}): Promise<CohortStats> {
  const db = createTenantClient(institutionId);
  const in30 = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const [open, planned, activeEnrollments, endingSoon] = await Promise.all([
    db.cohort.count({ where: { status: 'OPEN' } }),
    db.cohort.count({ where: { status: 'PLANNED' } }),
    db.enrollment.count({ where: { status: 'ACTIVE', cohort: { status: 'OPEN' } } }),
    db.cohort.count({ where: { status: 'OPEN', endsOn: { gte: now, lte: in30 } } }),
  ]);
  return { open, planned, activeEnrollments, endingSoon };
}

export interface UpcomingCohort {
  id: string;
  code: string;
  name: string;
  /** `starts`: planificada que empieza pronto; `ends`: abierta que termina pronto. */
  kind: 'starts' | 'ends';
  on: Date;
}

/**
 * Cohortes que empiezan o terminan en los próximos `days` días. Empiezan las planificadas y
 * también las **abiertas con inicio futuro** (23/9: RAP-TEST se abrió el 23/9 para empezar el
 * 1/10 y el carril decía «ninguna cohorte empieza»); terminan las abiertas.
 */
export async function listUpcomingCohorts({
  institutionId,
  days = 30,
  take = 5,
  now = new Date(),
}: {
  institutionId: string;
  days?: number;
  take?: number;
  now?: Date;
}): Promise<UpcomingCohort[]> {
  const db = createTenantClient(institutionId);
  const until = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
  const [starting, ending] = await Promise.all([
    db.cohort.findMany({
      where: { status: { in: ['PLANNED', 'OPEN'] }, startsOn: { gte: now, lte: until } },
      orderBy: { startsOn: 'asc' },
      take,
      select: { id: true, code: true, name: true, startsOn: true },
    }),
    db.cohort.findMany({
      where: { status: 'OPEN', endsOn: { gte: now, lte: until } },
      orderBy: { endsOn: 'asc' },
      take,
      select: { id: true, code: true, name: true, endsOn: true },
    }),
  ]);
  return [
    ...starting.map((c) => ({
      id: c.id,
      code: c.code,
      name: c.name,
      kind: 'starts' as const,
      on: c.startsOn,
    })),
    ...ending.map((c) => ({
      id: c.id,
      code: c.code,
      name: c.name,
      kind: 'ends' as const,
      on: c.endsOn,
    })),
  ]
    .sort((a, b) => a.on.getTime() - b.on.getTime())
    .slice(0, take);
}

const COHORT_ENTITIES = ['cohort', 'enrollment', 'import'] as const;

export function listRecentCohortActivity({
  institutionId,
  take = 6,
}: {
  institutionId: string;
  take?: number;
}) {
  return listRecentActivity({ institutionId, entities: COHORT_ENTITIES, take });
}

export async function createCohort({
  institutionId,
  actorId,
  data,
}: {
  institutionId: string;
  actorId: string | null;
  data: {
    code: string;
    name: string;
    programId: string;
    partnerId: string | null;
    progression: Progression;
    startsOn: Date;
    endsOn: Date;
  };
}): Promise<{ id: string }> {
  if (data.endsOn < data.startsOn) {
    throw new APIError('La fecha de fin no puede ser anterior al inicio', 'VALIDATION_ERROR');
  }

  const db = createTenantClient(institutionId);

  try {
    return await db.$transaction(async (tx) => {
      const program = await tx.program.findFirst({
        where: { id: data.programId, institutionId, archivedAt: null },
        select: { id: true },
      });
      if (!program) {
        throw new APIError('Program not found', 'NOT_FOUND');
      }

      const cohort = await tx.cohort.create({
        data: { institutionId, ...data },
        select: { id: true },
      });

      await tx.auditLog.create({
        data: {
          institutionId,
          actorId,
          entity: 'cohort',
          entityId: cohort.id,
          action: 'created',
          after: {
            code: data.code,
            name: data.name,
            programId: data.programId,
            progression: data.progression,
          },
        },
      });

      return cohort;
    });
  } catch (err) {
    if (isUniqueViolation(err)) {
      throw new APIError(`Ya existe una cohorte con el código ${data.code}`, 'CONFLICT');
    }
    throw err;
  }
}

/**
 * Opens the cohort: assignments for every lesson and assessment of its program, pinned to
 * the version published at this moment, and `PLANNED` → `OPEN`, all in one transaction.
 */
export async function openCohort({
  institutionId,
  actorId,
  cohortId,
  skipUnpublished = false,
}: {
  institutionId: string;
  actorId: string | null;
  cohortId: string;
  /**
   * 23/9: abrir dejando fuera lo que sigue en borrador. Lo que falte entra después por
   * «Actualizaciones del programa» (`assignPublishedContent`). Sin esto, un solo tema a
   * medias bloqueaba la apertura entera.
   */
  skipUnpublished?: boolean;
}): Promise<{ id: string; assigned: number; skipped: number }> {
  if (!actorId) {
    // `assignedById` is not nullable: an assignment always records who made it.
    throw new APIError('Missing actor', 'INTERNAL');
  }

  const db = createTenantClient(institutionId);

  return db.$transaction(async (tx) => {
    const cohort = await tx.cohort.findFirst({
      where: { id: cohortId, institutionId },
      select: { id: true, status: true, programId: true, startsOn: true },
    });
    if (!cohort) {
      throw new APIError('Cohort not found', 'NOT_FOUND');
    }
    if (cohort.status !== 'PLANNED') {
      throw new APIError('Solo se puede abrir una cohorte planeada', 'CONFLICT');
    }

    const [lessons, assessments] = await Promise.all([
      tx.lesson.findMany({
        where: { programId: cohort.programId, archivedAt: null },
        select: {
          id: true,
          title: true,
          versions: { select: { id: true, status: true, number: true } },
        },
      }),
      tx.assessment.findMany({
        where: { programId: cohort.programId, archivedAt: null },
        select: {
          id: true,
          title: true,
          versions: { select: { id: true, status: true, number: true } },
        },
      }),
    ]);

    const plan = planCohortOpening(lessons, assessments);

    if (plan.missing.length > 0 && !skipUnpublished) {
      throw new APIError(
        'Hay contenido sin versión publicada; la cohorte no se abrió',
        'CONFLICT',
        { missing: plan.missing }
      );
    }
    if (plan.lessons.length === 0 && plan.assessments.length === 0) {
      throw new APIError('El programa no tiene contenido que asignar', 'CONFLICT');
    }

    await tx.lessonAssignment.createMany({
      data: plan.lessons.map((l) => ({
        institutionId,
        cohortId,
        lessonId: l.lessonId,
        lessonVersionId: l.lessonVersionId,
        availableFrom: cohort.startsOn,
        assignedById: actorId,
      })),
    });

    await tx.assessmentAssignment.createMany({
      data: plan.assessments.map((a) => ({
        institutionId,
        cohortId,
        assessmentId: a.assessmentId,
        assessmentVersionId: a.assessmentVersionId,
        availableFrom: cohort.startsOn,
        assignedById: actorId,
      })),
    });

    await tx.cohort.update({ where: { id: cohortId }, data: { status: 'OPEN' } });

    const assigned = plan.lessons.length + plan.assessments.length;

    await tx.auditLog.create({
      data: {
        institutionId,
        actorId,
        entity: 'cohort',
        entityId: cohortId,
        action: 'opened',
        after: {
          lessonAssignments: plan.lessons.length,
          assessmentAssignments: plan.assessments.length,
          skippedUnpublished: plan.missing.length,
        },
      },
    });

    return { id: cohortId, assigned, skipped: plan.missing.length };
  });
}

/**
 * Closes the cohort: no new enrollments. The people already in it keep their access until
 * their own `accessUntil` — closing a cohort is not cutting anybody off.
 */
export async function closeCohort({
  institutionId,
  actorId,
  cohortId,
}: {
  institutionId: string;
  actorId: string | null;
  cohortId: string;
}): Promise<{ id: string }> {
  const db = createTenantClient(institutionId);

  return db.$transaction(async (tx) => {
    const cohort = await tx.cohort.findFirst({
      where: { id: cohortId, institutionId },
      select: { id: true, status: true },
    });
    if (!cohort) {
      throw new APIError('Cohort not found', 'NOT_FOUND');
    }
    if (cohort.status !== 'OPEN') {
      throw new APIError('Solo se puede cerrar una cohorte abierta', 'CONFLICT');
    }

    await tx.cohort.update({ where: { id: cohortId }, data: { status: 'CLOSED' } });
    await tx.auditLog.create({
      data: { institutionId, actorId, entity: 'cohort', entityId: cohortId, action: 'closed' },
    });

    return { id: cohortId };
  });
}

// ─────────────────────────── Options for the create form ───────────────────────────

export interface CohortFormOptions {
  programs: Array<{ id: string; code: string; name: string }>;
  partners: Array<{ id: string; name: string }>;
}

/**
 * Partners come from `Partner`, which has no CRUD screen yet (plan/06:31-37 lists "aliados"
 * under Personas; it is not built). Until then the select is simply empty, and a cohort
 * without a partner is perfectly valid.
 */
export async function listCohortFormOptions(institutionId: string): Promise<CohortFormOptions> {
  const db = createTenantClient(institutionId);

  const [programs, partners] = await Promise.all([
    db.program.findMany({
      where: { archivedAt: null },
      orderBy: { code: 'asc' },
      select: { id: true, code: true, name: true },
    }),
    db.partner.findMany({
      where: { archivedAt: null },
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    }),
  ]);

  return { programs, partners };
}

// ─────────────────────────── Preflight y actualizaciones (23/9) ───────────────────────────

export interface OpeningPreflight {
  cohort: {
    id: string;
    code: string;
    name: string;
    status: string;
    startsOn: string;
    endsOn: string;
    progression: string;
  };
  programName: string;
  modules: number;
  lessonsPublished: number;
  assessmentsPublished: number;
  enrollments: number;
  /** Lo que se quedaría fuera por no tener versión publicada. */
  missing: OpeningPlan['missing'];
}

/**
 * Lo que «Abrir» va a hacer, antes de hacerlo: cuántas piezas entran, cuántas se quedan
 * fuera y cuánta gente hay. Es la misma `planCohortOpening` que usa `openCohort`, así que
 * lo que dice la revisión es lo que pasa después.
 */
export async function getOpeningPreflight({
  institutionId,
  cohortId,
}: {
  institutionId: string;
  cohortId: string;
}): Promise<OpeningPreflight | null> {
  const db = createTenantClient(institutionId);
  const cohort = await db.cohort.findFirst({
    where: { id: cohortId },
    select: {
      id: true,
      code: true,
      name: true,
      status: true,
      startsOn: true,
      endsOn: true,
      progression: true,
      programId: true,
      program: {
        select: { name: true, modules: { where: { archivedAt: null }, select: { id: true } } },
      },
      _count: { select: { enrollments: true } },
    },
  });
  if (!cohort) return null;

  const [lessons, assessments] = await Promise.all([
    db.lesson.findMany({
      where: { programId: cohort.programId, archivedAt: null },
      select: {
        id: true,
        title: true,
        versions: { select: { id: true, status: true, number: true } },
      },
    }),
    db.assessment.findMany({
      where: { programId: cohort.programId, archivedAt: null },
      select: {
        id: true,
        title: true,
        versions: { select: { id: true, status: true, number: true } },
      },
    }),
  ]);
  const plan = planCohortOpening(lessons, assessments);
  const isoDay = (d: Date) => d.toISOString().slice(0, 10);

  return {
    cohort: {
      id: cohort.id,
      code: cohort.code,
      name: cohort.name,
      status: cohort.status,
      startsOn: isoDay(cohort.startsOn),
      endsOn: isoDay(cohort.endsOn),
      progression: cohort.progression,
    },
    programName: cohort.program.name,
    modules: cohort.program.modules.length,
    lessonsPublished: plan.lessons.length,
    assessmentsPublished: plan.assessments.length,
    enrollments: cohort._count.enrollments,
    missing: plan.missing,
  };
}

export interface PendingContentUpdate {
  kind: 'lesson' | 'assessment';
  id: string;
  title: string;
  moduleName: string | null;
  versionNumber: number;
}

/**
 * Contenido publicado del programa que esta cohorte abierta todavía no tiene asignado
 * (23/9): un tema o examen creado y publicado después de abrirla, o dejado fuera al abrir.
 * Solo piezas nuevas: una versión nueva de algo ya asignado no entra aquí, porque la
 * cohorte abierta conserva la versión con la que empezó (decisión de congelar al abrir).
 */
export async function listPendingContentUpdates({
  institutionId,
  cohortId,
}: {
  institutionId: string;
  cohortId: string;
}): Promise<PendingContentUpdate[]> {
  const db = createTenantClient(institutionId);
  const cohort = await db.cohort.findFirst({
    where: { id: cohortId },
    select: {
      status: true,
      programId: true,
      lessonAssignments: { select: { lessonId: true } },
      assessmentAssignments: { select: { assessmentId: true } },
    },
  });
  if (!cohort || cohort.status !== 'OPEN') return [];

  const assignedLessons = new Set(cohort.lessonAssignments.map((a) => a.lessonId));
  const assignedAssessments = new Set(cohort.assessmentAssignments.map((a) => a.assessmentId));

  const [lessons, assessments] = await Promise.all([
    db.lesson.findMany({
      where: { programId: cohort.programId, archivedAt: null, id: { notIn: [...assignedLessons] } },
      select: {
        id: true,
        title: true,
        module: { select: { name: true } },
        versions: { select: { id: true, status: true, number: true } },
      },
    }),
    db.assessment.findMany({
      where: {
        programId: cohort.programId,
        archivedAt: null,
        id: { notIn: [...assignedAssessments] },
      },
      select: {
        id: true,
        title: true,
        module: { select: { name: true } },
        versions: { select: { id: true, status: true, number: true } },
      },
    }),
  ]);

  const rows: PendingContentUpdate[] = [];
  for (const lesson of lessons) {
    const v = pickPublishedVersion(lesson.versions);
    if (v)
      rows.push({
        kind: 'lesson',
        id: lesson.id,
        title: lesson.title,
        moduleName: lesson.module.name,
        versionNumber: v.number,
      });
  }
  for (const assessment of assessments) {
    const v = pickPublishedVersion(assessment.versions);
    if (v)
      rows.push({
        kind: 'assessment',
        id: assessment.id,
        title: assessment.title,
        moduleName: assessment.module?.name ?? null,
        versionNumber: v.number,
      });
  }
  return rows;
}

/**
 * Asigna a una cohorte abierta contenido publicado que no tenía (23/9): la versión
 * publicada más alta de cada pieza, disponible desde ahora. `items` vacío = todo lo
 * pendiente. Idempotente: lo ya asignado se salta.
 */
export async function assignPublishedContent({
  institutionId,
  actorId,
  cohortId,
  items = [],
  now = new Date(),
}: {
  institutionId: string;
  actorId: string | null;
  cohortId: string;
  items?: Array<{ kind: 'lesson' | 'assessment'; id: string }>;
  now?: Date;
}): Promise<{ assigned: number }> {
  if (!actorId) throw new APIError('Missing actor', 'INTERNAL');
  const db = createTenantClient(institutionId);

  const cohort = await db.cohort.findFirst({ where: { id: cohortId }, select: { status: true } });
  if (!cohort) throw new APIError('Cohort not found', 'NOT_FOUND');
  if (cohort.status !== 'OPEN')
    throw new APIError('Solo se añade contenido a una cohorte abierta', 'CONFLICT');

  const pending = await listPendingContentUpdates({ institutionId, cohortId });
  const wanted =
    items.length === 0
      ? pending
      : pending.filter((p) => items.some((i) => i.kind === p.kind && i.id === p.id));
  if (wanted.length === 0) return { assigned: 0 };

  const lessonIds = wanted.filter((w) => w.kind === 'lesson').map((w) => w.id);
  const assessmentIds = wanted.filter((w) => w.kind === 'assessment').map((w) => w.id);

  const [lessons, assessments] = await Promise.all([
    db.lesson.findMany({
      where: { id: { in: lessonIds } },
      select: {
        id: true,
        title: true,
        versions: { select: { id: true, status: true, number: true } },
      },
    }),
    db.assessment.findMany({
      where: { id: { in: assessmentIds } },
      select: {
        id: true,
        title: true,
        versions: { select: { id: true, status: true, number: true } },
      },
    }),
  ]);
  const plan = planCohortOpening(lessons, assessments);

  await db.$transaction(async (tx) => {
    if (plan.lessons.length > 0) {
      await tx.lessonAssignment.createMany({
        data: plan.lessons.map((l) => ({
          institutionId,
          cohortId,
          lessonId: l.lessonId,
          lessonVersionId: l.lessonVersionId,
          availableFrom: now,
          assignedById: actorId,
        })),
        skipDuplicates: true,
      });
    }
    if (plan.assessments.length > 0) {
      await tx.assessmentAssignment.createMany({
        data: plan.assessments.map((a) => ({
          institutionId,
          cohortId,
          assessmentId: a.assessmentId,
          assessmentVersionId: a.assessmentVersionId,
          availableFrom: now,
          assignedById: actorId,
        })),
        skipDuplicates: true,
      });
    }
    await tx.auditLog.create({
      data: {
        institutionId,
        actorId,
        entity: 'cohort',
        entityId: cohortId,
        action: 'content_added',
        after: {
          lessons: plan.lessons.map((l) => l.lessonId),
          assessments: plan.assessments.map((a) => a.assessmentId),
        },
      },
    });
  });

  return { assigned: plan.lessons.length + plan.assessments.length };
}
