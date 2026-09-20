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

/** Cohortes que empiezan (planificadas) o terminan (abiertas) en los próximos `days` días. */
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
      where: { status: 'PLANNED', startsOn: { gte: now, lte: until } },
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
}: {
  institutionId: string;
  actorId: string | null;
  cohortId: string;
}): Promise<{ id: string; assigned: number }> {
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

    if (plan.missing.length > 0) {
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
        },
      },
    });

    return { id: cohortId, assigned };
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
