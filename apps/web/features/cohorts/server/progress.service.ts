/**
 * El avance de una cohorte: métricas y tabla por estudiante, y el CSV.
 * SSOT: reference/04-business-logic/reportes.md, packages/domain/src/metrics.ts,
 * reference/02-api/endpoints.md:77 (`GET /api/cohorts/[id]/progress`, `…/export`) y :53
 * (`/api/partner/cohort`).
 *
 * Las fórmulas están en `metrics.ts` y aquí solo se les dan los datos: «30 % completado»
 * tiene que significar lo mismo en `/cohortes/[id]/avance` y en `/aliado`. Por eso el aliado
 * llama a **esta misma función** con su cohorte: la única diferencia es qué columnas ve
 * (la cartera solo si el pagador es él, Fase 5), no qué números.
 *
 * Lo manual va aparte y nunca sumado al avance con evidencia (reportes.md:13).
 */

import 'server-only';

import {
  evidenceProgress,
  nonEvidenceProgress,
  completionRate,
  atRisk,
  assessmentsTakenAndPassed,
  medianDaysToComplete,
} from '@colombia-estudia/domain';
import { createTenantClient } from '@/lib/db/tenant';
import { toCsv } from '@/lib/csv/serialize';

export interface CohortProgressRow {
  enrollmentId: string;
  personId: string;
  name: string;
  status: string;
  enrolledAt: string;
  accessUntil: string;
  /** Temas completados con evidencia / temas asignados. */
  evidenceCompleted: number;
  /** Temas completados a mano o importados (aparte, nunca sumado). */
  manualCompleted: number;
  assigned: number;
  assessmentsTaken: number;
  assessmentsPassed: number;
  lastActivityAt: string | null;
  atRisk: boolean;
}

export interface CohortProgress {
  cohort: { id: string; code: string; name: string; programName: string; status: string };
  metrics: {
    enrollments: number;
    active: number;
    completionRate: number;
    evidenceAverage: number;
    manualAverage: number;
    atRisk: number;
    assessmentsTaken: number;
    assessmentsPassed: number;
    medianDaysToComplete: number | null;
  };
  rows: CohortProgressRow[];
}

export async function getCohortProgress({
  institutionId,
  cohortId,
  now = new Date(),
}: {
  institutionId: string;
  cohortId: string;
  now?: Date;
}): Promise<CohortProgress | null> {
  const db = createTenantClient(institutionId);

  const cohort = await db.cohort.findFirst({
    where: { id: cohortId },
    select: {
      id: true,
      code: true,
      name: true,
      status: true,
      program: { select: { name: true } },
    },
  });
  if (!cohort) return null;

  const [enrollments, lessonAssignments, attempts] = await Promise.all([
    db.enrollment.findMany({
      where: { cohortId },
      orderBy: [{ student: { familyName: 'asc' } }, { student: { givenName: 'asc' } }],
      select: {
        id: true,
        status: true,
        enrolledAt: true,
        accessUntil: true,
        completedAt: true,
        student: { select: { id: true, givenName: true, familyName: true } },
        lessonProgress: { select: { status: true, source: true, lastActivityAt: true } },
      },
    }),
    db.lessonAssignment.count({ where: { cohortId } }),
    db.attempt.findMany({
      where: { assignment: { cohortId }, status: 'GRADED' },
      select: {
        enrollmentId: true,
        score: true,
        maxScore: true,
        assessmentVersion: { select: { passPercent: true } },
      },
    }),
  ]);

  // Última actividad: el `LearningEvent` más reciente de cada estudiante en esta cohorte.
  // Es la fuente que fija reportes.md:15 para «en riesgo».
  const lastEvents = await db.learningEvent.groupBy({
    by: ['enrollmentId'],
    where: { enrollmentId: { in: enrollments.map((e) => e.id) } },
    _max: { occurredAt: true },
  });
  const lastEventAt = new Map(lastEvents.map((r) => [r.enrollmentId, r._max.occurredAt]));

  const attemptRows = attempts.map((a) => ({
    enrollmentId: a.enrollmentId,
    status: 'GRADED',
    score: a.score ? a.score.toNumber() : 0,
    maxScore: a.maxScore ? a.maxScore.toNumber() : 0,
    passPercent: a.assessmentVersion.passPercent,
  }));

  const riskIds = new Set(
    atRisk({
      enrollments: enrollments.map((e) => ({
        id: e.id,
        status: e.status as 'ACTIVE' | 'COMPLETED' | 'WITHDRAWN',
        lastLearningEventAt: lastEventAt.get(e.id) ?? null,
      })),
      now,
    })
  );

  const rows: CohortProgressRow[] = enrollments.map((e) => {
    const evidenceCompleted = e.lessonProgress.filter(
      (p) => p.status === 'COMPLETED' && p.source === 'EVIDENCE'
    ).length;
    const manualCompleted = e.lessonProgress.filter(
      (p) => p.status === 'COMPLETED' && p.source !== 'EVIDENCE'
    ).length;
    const own = attemptRows.filter((a) => a.enrollmentId === e.id);
    const { taken, passed } = assessmentsTakenAndPassed({ attempts: own, enrollmentCount: 1 });
    const last = lastEventAt.get(e.id) ?? null;
    return {
      enrollmentId: e.id,
      personId: e.student.id,
      name: `${e.student.familyName}, ${e.student.givenName}`,
      status: e.status,
      enrolledAt: e.enrolledAt.toISOString(),
      accessUntil: e.accessUntil.toISOString().slice(0, 10),
      evidenceCompleted,
      manualCompleted,
      assigned: lessonAssignments,
      assessmentsTaken: taken,
      assessmentsPassed: passed,
      lastActivityAt: last ? last.toISOString() : null,
      atRisk: riskIds.has(e.id),
    };
  });

  const evidence = evidenceProgress({
    perEnrollment: rows.map((r) => ({ completed: r.evidenceCompleted, assigned: r.assigned })),
  });
  const manual = nonEvidenceProgress({
    perEnrollment: rows.map((r) => ({ completed: r.manualCompleted, assigned: r.assigned })),
  });
  const totals = assessmentsTakenAndPassed({
    attempts: attemptRows,
    enrollmentCount: enrollments.length,
  });
  const completed = enrollments.filter(
    (e): e is typeof e & { completedAt: Date } => e.status === 'COMPLETED' && e.completedAt !== null
  );

  return {
    cohort: {
      id: cohort.id,
      code: cohort.code,
      name: cohort.name,
      programName: cohort.program.name,
      status: cohort.status,
    },
    metrics: {
      enrollments: enrollments.length,
      active: enrollments.filter((e) => e.status === 'ACTIVE').length,
      // Todas las matrículas de una cohorte fueron ACTIVE alguna vez (se crean así).
      completionRate: completionRate({
        completedCount: completed.length,
        everActiveCount: enrollments.length,
      }),
      evidenceAverage: evidence.cohortAverage,
      manualAverage: manual.cohortAverage,
      atRisk: riskIds.size,
      assessmentsTaken: totals.taken,
      assessmentsPassed: totals.passed,
      medianDaysToComplete:
        completed.length === 0
          ? null
          : medianDaysToComplete(
              completed.map((e) => ({ enrolledAt: e.enrolledAt, completedAt: e.completedAt }))
            ),
    },
    rows,
  };
}

/**
 * El CSV por estudiante (reportes.md «Exportación»), sin BOM: lo pone la ruta, como en el
 * resto de exportaciones (`lib/csv/serialize.ts`).
 */
export function cohortProgressCsv(progress: CohortProgress): string {
  const header = [
    'estudiante',
    'estado_matricula',
    'matriculada_el',
    'acceso_hasta',
    'temas_asignados',
    'temas_completados_con_evidencia',
    'temas_completados_manual_o_importados',
    'evaluaciones_presentadas',
    'evaluaciones_aprobadas',
    'ultima_actividad',
    'en_riesgo',
  ];
  return toCsv(
    header,
    progress.rows.map((r) => [
      r.name,
      r.status,
      r.enrolledAt.slice(0, 10),
      r.accessUntil,
      String(r.assigned),
      String(r.evidenceCompleted),
      String(r.manualCompleted),
      String(r.assessmentsTaken),
      String(r.assessmentsPassed),
      r.lastActivityAt ? r.lastActivityAt.slice(0, 16).replace('T', ' ') : '',
      r.atRisk ? 'si' : 'no',
    ])
  );
}

/** Las cohortes que financian los aliados de los que esta persona es contacto (`/aliado`). */
export async function listPartnerCohorts({
  institutionId,
  partnerIds,
}: {
  institutionId: string;
  partnerIds: string[];
}): Promise<Array<{ id: string; code: string; name: string; status: string }>> {
  if (partnerIds.length === 0) return [];
  const db = createTenantClient(institutionId);
  return db.cohort.findMany({
    where: { partnerId: { in: partnerIds } },
    orderBy: [{ startsOn: 'desc' }],
    select: { id: true, code: true, name: true, status: true },
  });
}
