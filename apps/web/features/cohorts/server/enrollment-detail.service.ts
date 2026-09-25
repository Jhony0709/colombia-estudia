/**
 * El detalle de una matrícula: quién, en qué cohorte, cómo va.
 * SSOT: reference/01-routing/routes.md (`/cohortes/[cohortId]/matriculas/[enrollmentId]`),
 * plan/06-cohortes-y-personas.md:72-77, plan/08 §8, endpoints.md:78 (`progress.override`).
 *
 * El avance se cuenta con la misma regla que ve el estudiante: un tema está completado si
 * `LessonProgress.status === 'COMPLETED'`, sea por evidencia o por `MANUAL`; una evaluación,
 * por su mejor intento calificado. No hay una segunda aritmética para el staff.
 */

import 'server-only';

import { createTenantClient } from '@/lib/db/tenant';
import { APIError } from '@/lib/core/errors';

export interface EnrollmentLessonRow {
  assignmentId: string;
  progressId: string | null;
  moduleName: string;
  modulePosition: number;
  position: number;
  title: string;
  requiresSubmission: boolean;
  status: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';
  source: 'EVIDENCE' | 'MANUAL' | null;
  completedAt: string | null;
  lastActivityAt: string | null;
  submissionStatus: 'SUBMITTED' | 'RETURNED' | 'APPROVED' | null;
}

export interface EnrollmentAssessmentRow {
  assignmentId: string;
  moduleName: string;
  modulePosition: number;
  position: number;
  title: string;
  kind: string;
  passPercent: number | null;
  attemptsAllowed: number;
  attempts: Array<{
    id: string;
    number: number;
    status: string;
    submittedAt: string | null;
    score: number | null;
    maxScore: number | null;
  }>;
}

export interface EnrollmentDetail {
  id: string;
  status: string;
  isMinorAtEnrollment: boolean;
  enrolledAt: string;
  accessUntil: string;
  completedAt: string | null;
  withdrawnAt: string | null;
  withdrawReason: string | null;
  /** Grado de entrada (20/9): posición del primer módulo de su ruta. Nulo = desde el primero. */
  startsAtModule: number | null;
  student: { id: string; code: string; name: string };
  /** `startsOn` como día (`YYYY-MM-DD`): «no ha empezado» solo tiene sentido si la cohorte ya empezó. */
  cohort: {
    id: string;
    code: string;
    name: string;
    programName: string;
    status: string;
    startsOn: string;
  };
  lessons: EnrollmentLessonRow[];
  assessments: EnrollmentAssessmentRow[];
  progress: { completed: number; total: number };
}

export async function getEnrollmentDetail({
  institutionId,
  cohortId,
  enrollmentId,
}: {
  institutionId: string;
  cohortId: string;
  enrollmentId: string;
}): Promise<EnrollmentDetail | null> {
  const db = createTenantClient(institutionId);

  const e = await db.enrollment.findFirst({
    where: { id: enrollmentId, cohortId },
    select: {
      id: true,
      status: true,
      isMinorAtEnrollment: true,
      enrolledAt: true,
      accessUntil: true,
      completedAt: true,
      withdrawnAt: true,
      withdrawReason: true,
      startsAtModule: true,
      student: { select: { id: true, code: true, givenName: true, familyName: true } },
      cohort: {
        select: {
          id: true,
          code: true,
          name: true,
          status: true,
          startsOn: true,
          program: { select: { name: true } },
        },
      },
    },
  });
  if (!e) return null;

  const [lessonAssignments, assessmentAssignments, accommodation] = await Promise.all([
    db.lessonAssignment.findMany({
      where: { cohortId },
      select: {
        id: true,
        lesson: {
          select: {
            title: true,
            position: true,
            requiresSubmission: true,
            module: { select: { name: true, position: true } },
          },
        },
        progress: {
          where: { enrollmentId },
          select: { id: true, status: true, source: true, completedAt: true, lastActivityAt: true },
        },
        submissions: {
          where: { enrollmentId },
          orderBy: { submittedAt: 'desc' },
          take: 1,
          select: { status: true },
        },
      },
    }),
    db.assessmentAssignment.findMany({
      where: { cohortId },
      select: {
        id: true,
        assessment: {
          select: {
            title: true,
            kind: true,
            position: true,
            module: { select: { name: true, position: true } },
          },
        },
        assessmentVersion: { select: { passPercent: true, maxAttempts: true } },
        attempts: {
          where: { enrollmentId },
          orderBy: { number: 'asc' },
          select: {
            id: true,
            number: true,
            status: true,
            submittedAt: true,
            score: true,
            maxScore: true,
          },
        },
      },
    }),
    db.accommodation.findFirst({
      where: { enrollmentId },
      select: { allowedAttemptsBonus: true },
    }),
  ]);

  // Su ruta empieza en su grado de entrada (20/9): lo anterior no se lista ni se cuenta.
  const fromModule = e.startsAtModule ?? 1;

  const lessons: EnrollmentLessonRow[] = lessonAssignments
    .filter((a) => a.lesson.module.position >= fromModule)
    .map((a) => {
      const p = a.progress[0];
      return {
        assignmentId: a.id,
        progressId: p?.id ?? null,
        moduleName: a.lesson.module.name,
        modulePosition: a.lesson.module.position,
        position: a.lesson.position,
        title: a.lesson.title,
        requiresSubmission: a.lesson.requiresSubmission,
        status: (p?.status ?? 'NOT_STARTED') as EnrollmentLessonRow['status'],
        source: (p?.source ?? null) as EnrollmentLessonRow['source'],
        completedAt: p?.completedAt ? p.completedAt.toISOString() : null,
        lastActivityAt: p?.lastActivityAt ? p.lastActivityAt.toISOString() : null,
        submissionStatus: (a.submissions[0]?.status ??
          null) as EnrollmentLessonRow['submissionStatus'],
      };
    })
    .sort((x, y) => x.modulePosition - y.modulePosition || x.position - y.position);

  const assessments: EnrollmentAssessmentRow[] = assessmentAssignments
    .filter((a) => (a.assessment.module?.position ?? fromModule) >= fromModule)
    .map((a) => ({
      assignmentId: a.id,
      moduleName: a.assessment.module?.name ?? '',
      modulePosition: a.assessment.module?.position ?? -1,
      position: a.assessment.position,
      title: a.assessment.title,
      kind: a.assessment.kind,
      passPercent: a.assessmentVersion.passPercent,
      attemptsAllowed: a.assessmentVersion.maxAttempts + (accommodation?.allowedAttemptsBonus ?? 0),
      attempts: a.attempts.map((t) => ({
        id: t.id,
        number: t.number,
        status: t.status,
        submittedAt: t.submittedAt ? t.submittedAt.toISOString() : null,
        score: t.score ? t.score.toNumber() : null,
        maxScore: t.maxScore ? t.maxScore.toNumber() : null,
      })),
    }))
    .sort((x, y) => x.modulePosition - y.modulePosition || x.position - y.position);

  const completedLessons = lessons.filter((l) => l.status === 'COMPLETED').length;
  const completedAssessments = assessments.filter((a) =>
    a.attempts.some((t) => t.status === 'GRADED')
  ).length;

  return {
    id: e.id,
    status: e.status,
    isMinorAtEnrollment: e.isMinorAtEnrollment,
    enrolledAt: e.enrolledAt.toISOString(),
    accessUntil: e.accessUntil.toISOString().slice(0, 10),
    completedAt: e.completedAt ? e.completedAt.toISOString() : null,
    withdrawnAt: e.withdrawnAt ? e.withdrawnAt.toISOString() : null,
    withdrawReason: e.withdrawReason,
    startsAtModule: e.startsAtModule,
    student: {
      id: e.student.id,
      code: e.student.code,
      name: `${e.student.givenName} ${e.student.familyName}`,
    },
    cohort: {
      id: e.cohort.id,
      code: e.cohort.code,
      name: e.cohort.name,
      programName: e.cohort.program.name,
      status: e.cohort.status,
      startsOn: e.cohort.startsOn.toISOString().slice(0, 10),
    },
    lessons,
    assessments,
    progress: {
      completed: completedLessons + completedAssessments,
      total: lessons.length + assessments.length,
    },
  };
}

/**
 * Marca un tema como completado a mano (`progress.override`), con motivo y auditoría.
 * SSOT: endpoints.md:78, plan/06:75.
 *
 * `source: 'MANUAL'` deja claro para siempre que no fue evidencia. Si el tema ya está
 * completado no hace nada: no hay dos formas de estar completado.
 */
export async function overrideLessonProgress({
  institutionId,
  actorId,
  enrollmentId,
  assignmentId,
  reason,
  now = new Date(),
}: {
  institutionId: string;
  actorId: string;
  enrollmentId: string;
  assignmentId: string;
  reason: string;
  now?: Date;
}): Promise<{ progressId: string; changed: boolean }> {
  const db = createTenantClient(institutionId);

  const enrollment = await db.enrollment.findFirst({
    where: { id: enrollmentId },
    select: { id: true, studentId: true, cohortId: true },
  });
  if (!enrollment) throw new APIError('Not found', 'NOT_FOUND');

  const assignment = await db.lessonAssignment.findFirst({
    where: { id: assignmentId, cohortId: enrollment.cohortId },
    select: { id: true, lessonVersionId: true },
  });
  if (!assignment) throw new APIError('Not found', 'NOT_FOUND');

  const existing = await db.lessonProgress.findFirst({
    where: { enrollmentId, lessonAssignmentId: assignmentId },
    select: { id: true, status: true, source: true },
  });
  if (existing?.status === 'COMPLETED') return { progressId: existing.id, changed: false };

  const progressId = await db.$transaction(async (tx) => {
    const row = await tx.lessonProgress.upsert({
      where: {
        enrollmentId_lessonAssignmentId: { enrollmentId, lessonAssignmentId: assignmentId },
      },
      create: {
        institutionId,
        enrollmentId,
        studentId: enrollment.studentId,
        lessonAssignmentId: assignmentId,
        lessonVersionId: assignment.lessonVersionId,
        status: 'COMPLETED',
        source: 'MANUAL',
        evidence: {},
        startedAt: now,
        lastActivityAt: now,
        completedAt: now,
      },
      update: { status: 'COMPLETED', source: 'MANUAL', completedAt: now, lastActivityAt: now },
      select: { id: true },
    });

    await tx.auditLog.create({
      data: {
        institutionId,
        actorId,
        entity: 'progress',
        entityId: row.id,
        action: 'override',
        before: { status: existing?.status ?? 'NOT_STARTED', source: existing?.source ?? null },
        after: { status: 'COMPLETED', source: 'MANUAL', reason, assignmentId, enrollmentId },
        occurredAt: now,
      },
    });

    await tx.learningEvent.create({
      data: {
        institutionId,
        studentId: enrollment.studentId,
        enrollmentId,
        type: 'lesson.completed',
        payload: { assignmentId, source: 'MANUAL' },
        occurredAt: now,
      },
    });

    return row.id;
  });

  return { progressId, changed: true };
}
