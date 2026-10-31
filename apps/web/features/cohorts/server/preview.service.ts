/**
 * Vista de estudiante (31/10): la matrícula de prueba de un admin (`Enrollment.isPreview`).
 * Las reglas que se saltan viven en cohort, progress, submission y attempt.service.
 */

import 'server-only';

import { createTenantClient } from '@/lib/db/tenant';
import { isUniqueViolation } from '@/lib/db/errors';
import { APIError } from '@/lib/core/errors';

/** El acceso de la matrícula de prueba no vence: las capacidades cuelgan de `accessUntil`. */
const PREVIEW_ACCESS_UNTIL = new Date('2099-12-31T00:00:00.000Z');

/** Se recorre si no está archivada y tiene algo asignado en la ruta (un examen sin componente no sale). */
const PREVIEWABLE = {
  status: { not: 'ARCHIVED' as const },
  OR: [
    { lessonAssignments: { some: {} } },
    { assessmentAssignments: { some: { assessment: { moduleId: { not: null } } } } },
  ],
};

export async function startPreview({
  institutionId,
  actorId,
  cohortId,
  now = new Date(),
}: {
  institutionId: string;
  actorId: string;
  cohortId: string;
  now?: Date;
}): Promise<{ enrollmentId: string }> {
  const db = createTenantClient(institutionId);
  const cohort = await db.cohort.findFirst({ where: { id: cohortId }, select: { id: true } });
  if (!cohort) throw new APIError('Cohort not found', 'NOT_FOUND');
  const ready = await db.cohort.count({ where: { id: cohortId, ...PREVIEWABLE } });
  if (ready === 0) {
    throw new APIError('Esta cohorte todavía no tiene contenido para recorrer', 'CONFLICT');
  }

  const existing = async () =>
    db.enrollment.findFirst({
      where: { studentId: actorId, cohortId },
      select: { id: true, isPreview: true },
    });
  const found = await existing();
  if (found && !found.isPreview) {
    throw new APIError('Ya tienes una matrícula real en esta cohorte', 'CONFLICT');
  }
  if (found) {
    // La última abierta es la que pinta la franja y la que `/aprender` toma por defecto.
    await db.enrollment.update({ where: { id: found.id }, data: { enrolledAt: now } });
    return { enrollmentId: found.id };
  }

  try {
    const created = await db.$transaction(async (tx) => {
      const row = await tx.enrollment.create({
        data: {
          institutionId,
          studentId: actorId,
          cohortId,
          status: 'ACTIVE',
          isMinorAtEnrollment: false,
          accessUntil: PREVIEW_ACCESS_UNTIL,
          enrolledAt: now,
          isPreview: true,
        },
        select: { id: true },
      });
      await tx.auditLog.create({
        data: {
          institutionId,
          actorId,
          entity: 'enrollment_preview',
          entityId: row.id,
          action: 'created',
          after: { cohortId },
          occurredAt: now,
        },
      });
      return row;
    });
    return { enrollmentId: created.id };
  } catch (err) {
    // Dos clics a la vez: el otro ya la creó.
    if (!isUniqueViolation(err)) throw err;
    const again = await existing();
    if (!again?.isPreview) throw err;
    return { enrollmentId: again.id };
  }
}

/** Borra lo hecho en la vista de estudiante y deja la matrícula para volver a empezar. */
export async function resetPreview({
  institutionId,
  actorId,
  cohortId,
  now = new Date(),
}: {
  institutionId: string;
  actorId: string;
  cohortId: string;
  now?: Date;
}): Promise<{ enrollmentId: string }> {
  const db = createTenantClient(institutionId);
  const enrollment = await db.enrollment.findFirst({
    where: { studentId: actorId, cohortId, isPreview: true },
    select: { id: true },
  });
  if (!enrollment) throw new APIError('Not found', 'NOT_FOUND');
  const where = { enrollmentId: enrollment.id };

  await db.$transaction(async (tx) => {
    // En orden de dependencias: la nota apunta al intento.
    await tx.score.deleteMany({ where });
    await tx.attempt.deleteMany({ where });
    await tx.lessonProgress.deleteMany({ where });
    await tx.submission.deleteMany({ where });
    await tx.moduleFeedback.deleteMany({ where });
    await tx.enrollmentModule.deleteMany({ where });
    await tx.accessRequest.deleteMany({ where });
    await tx.auditLog.create({
      data: {
        institutionId,
        actorId,
        entity: 'enrollment_preview',
        entityId: enrollment.id,
        action: 'reset',
        after: { cohortId },
        occurredAt: now,
      },
    });
  });
  return { enrollmentId: enrollment.id };
}

/** Las cohortes de un programa que ya tienen contenido asignado: las que se pueden recorrer. */
export async function listPreviewCohorts({
  institutionId,
  programId,
}: {
  institutionId: string;
  programId: string;
}): Promise<Array<{ id: string; code: string; name: string }>> {
  const db = createTenantClient(institutionId);
  return db.cohort.findMany({
    where: { programId, ...PREVIEWABLE },
    orderBy: { startsOn: 'desc' },
    select: { id: true, code: true, name: true },
  });
}

/** Si la matrícula en pantalla es la vista de estudiante de quien mira: lo que pinta la franja. */
export async function getPreviewOf({
  institutionId,
  personId,
  enrollmentId,
}: {
  institutionId: string;
  personId: string;
  enrollmentId: string;
}): Promise<{ cohortId: string; cohortCode: string; programName: string } | null> {
  const db = createTenantClient(institutionId);
  const row = await db.enrollment.findFirst({
    where: { id: enrollmentId, studentId: personId, isPreview: true },
    select: { cohort: { select: { id: true, code: true, program: { select: { name: true } } } } },
  });
  return row
    ? { cohortId: row.cohort.id, cohortCode: row.cohort.code, programName: row.cohort.program.name }
    : null;
}
