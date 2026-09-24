/**
 * La cola de entregas de una cohorte y su revisión.
 * SSOT: plan/08-aprender-y-evaluar.md:72-76 (§4), reference/02-api/endpoints.md:79,
 * reference/01-routing/routes.md (`/cohortes/[id]/actividades`).
 *
 * Aprobar completa el tema: escribe el `LessonProgress` en `COMPLETED` con `source =
 * EVIDENCE` (la entrega ES la evidencia, contenido-y-evaluaciones.md:150), emite
 * `lesson.completed` y avisa al estudiante. Devolver exige comentario y avisa también.
 * Las dos decisiones quedan en `AuditLog` (`submission.approved` / `submission.returned`)
 * con quién y cuándo, que es lo que responde «¿quién la revisó?».
 */

import 'server-only';

import { createTenantClient } from '@/lib/db/tenant';
import { APIError } from '@/lib/core/errors';
import { createReadUrl } from '@/lib/media/storage';
import { notify } from '@/features/notifications/server/notifications.service';

export type SubmissionStatusFilter = 'SUBMITTED' | 'RETURNED' | 'APPROVED';
export const SUBMISSION_STATUSES: readonly SubmissionStatusFilter[] = [
  'SUBMITTED',
  'RETURNED',
  'APPROVED',
];

export interface SubmissionRow {
  id: string;
  status: SubmissionStatusFilter;
  studentId: string;
  studentName: string;
  lessonId: string;
  lessonTitle: string;
  moduleName: string;
  hasFile: boolean;
  hasText: boolean;
  submittedAt: Date;
  reviewedAt: Date | null;
  reviewerName: string | null;
}

export interface SubmissionDetail extends SubmissionRow {
  text: string | null;
  file: { name: string; url: string } | null;
  feedback: string | null;
  /** Lo que el autor pidió (23/9): quien revisa lo ve al lado de lo entregado. Markdown crudo. */
  activityInstructions: string | null;
}

export interface SubmissionCounts {
  SUBMITTED: number;
  RETURNED: number;
  APPROVED: number;
}

const fullName = (p: { givenName: string; familyName: string }) => `${p.givenName} ${p.familyName}`;

export async function countSubmissions({
  institutionId,
  cohortId,
}: {
  institutionId: string;
  cohortId: string;
}): Promise<SubmissionCounts> {
  const db = createTenantClient(institutionId);
  const rows = await db.submission.groupBy({
    by: ['status'],
    where: { assignment: { cohortId } },
    _count: { _all: true },
  });
  const counts: SubmissionCounts = { SUBMITTED: 0, RETURNED: 0, APPROVED: 0 };
  for (const r of rows) counts[r.status as SubmissionStatusFilter] = r._count._all;
  return counts;
}

/** Lo que la página de la cola necesita saber de la cohorte, sin cargar sus matrículas. */
export interface SubmissionsCohortHeader {
  id: string;
  code: string;
  name: string;
  programName: string;
}

export async function getSubmissionsCohortHeader({
  institutionId,
  cohortId,
}: {
  institutionId: string;
  cohortId: string;
}): Promise<SubmissionsCohortHeader | null> {
  const db = createTenantClient(institutionId);
  const c = await db.cohort.findFirst({
    where: { id: cohortId },
    select: { id: true, code: true, name: true, program: { select: { name: true } } },
  });
  return c ? { id: c.id, code: c.code, name: c.name, programName: c.program.name } : null;
}

/** Los temas de la cohorte que se completan con entrega: es el filtro «tema» de la cola. */
export async function listSubmissionLessons({
  institutionId,
  cohortId,
}: {
  institutionId: string;
  cohortId: string;
}): Promise<Array<{ id: string; title: string }>> {
  const db = createTenantClient(institutionId);
  const rows = await db.lessonAssignment.findMany({
    where: { cohortId, lesson: { requiresSubmission: true } },
    select: { lesson: { select: { id: true, title: true, position: true } } },
  });
  return rows
    .sort((a, b) => a.lesson.position - b.lesson.position)
    .map((r) => ({ id: r.lesson.id, title: r.lesson.title }));
}

export async function listSubmissions({
  institutionId,
  cohortId,
  status,
  lessonId,
}: {
  institutionId: string;
  cohortId: string;
  status: SubmissionStatusFilter | null;
  lessonId: string | null;
}): Promise<SubmissionRow[]> {
  const db = createTenantClient(institutionId);
  const rows = await db.submission.findMany({
    where: {
      assignment: { cohortId, ...(lessonId ? { lessonId } : {}) },
      ...(status ? { status } : {}),
    },
    // Las pendientes más antiguas primero: la cola se atiende por orden de llegada.
    orderBy: [{ submittedAt: 'asc' }],
    select: {
      id: true,
      status: true,
      text: true,
      fileAssetId: true,
      submittedAt: true,
      reviewedAt: true,
      reviewedBy: { select: { givenName: true, familyName: true } },
      enrollment: {
        select: { student: { select: { id: true, givenName: true, familyName: true } } },
      },
      assignment: {
        select: {
          lesson: { select: { id: true, title: true, module: { select: { name: true } } } },
        },
      },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    status: r.status as SubmissionStatusFilter,
    studentId: r.enrollment.student.id,
    studentName: fullName(r.enrollment.student),
    lessonId: r.assignment.lesson.id,
    lessonTitle: r.assignment.lesson.title,
    moduleName: r.assignment.lesson.module.name,
    hasFile: Boolean(r.fileAssetId),
    hasText: Boolean(r.text),
    submittedAt: r.submittedAt,
    reviewedAt: r.reviewedAt,
    reviewerName: r.reviewedBy ? fullName(r.reviewedBy) : null,
  }));
}

export async function getSubmission({
  institutionId,
  cohortId,
  submissionId,
}: {
  institutionId: string;
  cohortId: string;
  submissionId: string;
}): Promise<SubmissionDetail | null> {
  const db = createTenantClient(institutionId);
  const r = await db.submission.findFirst({
    where: { id: submissionId, assignment: { cohortId } },
    select: {
      id: true,
      status: true,
      text: true,
      feedback: true,
      submittedAt: true,
      reviewedAt: true,
      reviewedBy: { select: { givenName: true, familyName: true } },
      file: { select: { providerRef: true, status: true } },
      enrollment: {
        select: { student: { select: { id: true, givenName: true, familyName: true } } },
      },
      assignment: {
        select: {
          lesson: {
            select: {
              id: true,
              title: true,
              activityInstructions: true,
              module: { select: { name: true } },
            },
          },
        },
      },
    },
  });
  if (!r) return null;
  const file =
    r.file && r.file.status === 'READY'
      ? {
          name: r.file.providerRef.split('/').pop() ?? 'archivo',
          url: await createReadUrl(r.file.providerRef),
        }
      : null;
  return {
    id: r.id,
    status: r.status as SubmissionStatusFilter,
    studentId: r.enrollment.student.id,
    studentName: fullName(r.enrollment.student),
    lessonId: r.assignment.lesson.id,
    lessonTitle: r.assignment.lesson.title,
    moduleName: r.assignment.lesson.module.name,
    hasFile: file !== null,
    hasText: Boolean(r.text),
    submittedAt: r.submittedAt,
    reviewedAt: r.reviewedAt,
    reviewerName: r.reviewedBy ? fullName(r.reviewedBy) : null,
    activityInstructions: r.assignment.lesson.activityInstructions,
    text: r.text,
    file,
    feedback: r.feedback,
  };
}

export async function reviewSubmission({
  institutionId,
  actorId,
  cohortId,
  submissionId,
  decision,
  feedback,
  now = new Date(),
}: {
  institutionId: string;
  actorId: string;
  cohortId: string;
  submissionId: string;
  decision: 'APPROVED' | 'RETURNED';
  feedback: string | null;
  now?: Date;
}): Promise<{ id: string; status: SubmissionStatusFilter }> {
  if (decision === 'RETURNED' && !feedback) {
    throw new APIError('Para devolver una actividad hay que decir qué falta', 'VALIDATION_ERROR');
  }

  const db = createTenantClient(institutionId);

  const row = await db.submission.findFirst({
    where: { id: submissionId, assignment: { cohortId } },
    select: {
      id: true,
      status: true,
      enrollmentId: true,
      lessonAssignmentId: true,
      enrollment: { select: { studentId: true } },
      assignment: { select: { lessonVersionId: true, lesson: { select: { title: true } } } },
    },
  });
  if (!row) throw new APIError('Actividad no encontrada', 'NOT_FOUND');
  if (row.status !== 'SUBMITTED') {
    throw new APIError('Solo se revisa una actividad que está en revisión', 'CONFLICT');
  }

  await db.$transaction(async (tx) => {
    await tx.submission.update({
      where: { id: row.id },
      data: { status: decision, feedback, reviewedById: actorId, reviewedAt: now },
    });

    if (decision === 'APPROVED') {
      await tx.lessonProgress.upsert({
        where: {
          enrollmentId_lessonAssignmentId: {
            enrollmentId: row.enrollmentId,
            lessonAssignmentId: row.lessonAssignmentId,
          },
        },
        create: {
          institutionId,
          enrollmentId: row.enrollmentId,
          studentId: row.enrollment.studentId,
          lessonAssignmentId: row.lessonAssignmentId,
          lessonVersionId: row.assignment.lessonVersionId,
          status: 'COMPLETED',
          source: 'EVIDENCE',
          evidence: { submissionId: row.id },
          startedAt: now,
          lastActivityAt: now,
          completedAt: now,
        },
        update: { status: 'COMPLETED', source: 'EVIDENCE', lastActivityAt: now, completedAt: now },
      });
      await tx.learningEvent.create({
        data: {
          institutionId,
          studentId: row.enrollment.studentId,
          enrollmentId: row.enrollmentId,
          type: 'lesson.completed',
          payload: {
            assignmentId: row.lessonAssignmentId,
            form: 'SUBMISSION',
            submissionId: row.id,
          },
          occurredAt: now,
        },
      });
    }

    await tx.auditLog.create({
      data: {
        institutionId,
        actorId,
        entity: 'submission',
        entityId: row.id,
        action: decision === 'APPROVED' ? 'approved' : 'returned',
        before: { status: 'SUBMITTED' },
        after: { status: decision, feedback },
        occurredAt: now,
      },
    });
  });

  try {
    await notify(institutionId, {
      personId: row.enrollment.studentId,
      type: decision === 'APPROVED' ? 'submission_approved' : 'submission_returned',
      title: decision === 'APPROVED' ? 'Tu actividad fue aprobada' : 'Tu actividad fue devuelta',
      body:
        decision === 'APPROVED'
          ? `${row.assignment.lesson.title}: tema completado.`
          : `${row.assignment.lesson.title}: ${feedback}`,
      href: `/aprender/tema/${row.lessonAssignmentId}`,
      dedupeKey: `submission_${decision.toLowerCase()}:${row.id}:${now.toISOString()}`,
    });
  } catch {
    // Un aviso que falla no deshace la revisión.
  }

  return { id: row.id, status: decision };
}
