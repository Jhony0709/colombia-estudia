/**
 * La congelación es de la cohorte, no del contenido (decisión de Jhonny, 27/9).
 *
 * `LessonVersion` y `AssessmentVersion` siguen siendo inmutables: conservan qué vio cada
 * estudiante, la puerta de validación y `invalidatesProgress`. Lo que cambia es la
 * asignación: al publicar, las asignaciones **no fijadas** (`pinnedVersion = false`) de las
 * cohortes vivas pasan solas a la versión nueva, con la misma regla de reabrir que tiene el
 * cambio manual (`assignments.service.ts#updateAssignmentToLatest`). Fijar una cohorte es la
 * excepción, para la que está a punto de cerrar y no quiere que le muevan el piso.
 *
 * Cohortes vivas: `PLANNED` y `OPEN`. Una `CLOSED` o `ARCHIVED` ya no estudia; moverla
 * reescribiría con qué versión terminó.
 *
 * Todo corre dentro de la transacción de publicar; los avisos a estudiantes salen después,
 * con `notifyReopened`, porque un correo no se deshace con un ROLLBACK.
 */

import 'server-only';

import { createTenantClient } from '@/lib/db/tenant';
import { notifyMany } from '@/features/notifications/server/notifications.service';

type Tx = Omit<
  ReturnType<typeof createTenantClient>,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;

export const LIVE_COHORT_STATUSES = ['PLANNED', 'OPEN'] as const;

export interface PropagationResult {
  /** Asignaciones que pasaron a la versión nueva. */
  moved: number;
  /** Por asignación reabierta, a quién avisar. */
  reopened: Array<{ assignmentId: string; studentIds: string[] }>;
}

/**
 * Pasa a `version` las asignaciones no fijadas del tema en cohortes vivas. Si la versión
 * `invalidatesProgress`, los `COMPLETED` de esas asignaciones vuelven a `IN_PROGRESS` con la
 * evidencia intacta.
 */
export async function propagateLessonVersion(
  tx: Tx,
  {
    institutionId,
    lessonId,
    version,
  }: {
    institutionId: string;
    lessonId: string;
    version: { id: string; number: number; invalidatesProgress: boolean };
  }
): Promise<PropagationResult> {
  const targets = await tx.lessonAssignment.findMany({
    where: {
      lessonId,
      pinnedVersion: false,
      lessonVersionId: { not: version.id },
      cohort: { status: { in: [...LIVE_COHORT_STATUSES] } },
    },
    select: { id: true, lessonVersion: { select: { number: true } } },
  });
  if (targets.length === 0) return { moved: 0, reopened: [] };

  const ids = targets.map((a) => a.id);
  await tx.lessonAssignment.updateMany({
    where: { id: { in: ids } },
    data: { lessonVersionId: version.id },
  });

  const reopened: PropagationResult['reopened'] = [];
  if (version.invalidatesProgress) {
    const completed = await tx.lessonProgress.findMany({
      where: { lessonAssignmentId: { in: ids }, status: 'COMPLETED' },
      select: { id: true, studentId: true, lessonAssignmentId: true },
    });
    if (completed.length > 0) {
      await tx.lessonProgress.updateMany({
        where: { id: { in: completed.map((p) => p.id) } },
        data: { status: 'IN_PROGRESS', completedAt: null, lessonVersionId: version.id },
      });
      for (const id of ids) {
        const studentIds = completed
          .filter((p) => p.lessonAssignmentId === id)
          .map((p) => p.studentId);
        if (studentIds.length > 0) reopened.push({ assignmentId: id, studentIds });
      }
    }
  }

  await tx.auditLog.createMany({
    data: targets.map((a) => ({
      institutionId,
      actorId: null,
      entity: 'lesson_assignment',
      entityId: a.id,
      action: 'version_changed',
      before: { number: a.lessonVersion.number },
      after: { number: version.number, onPublish: true },
    })),
  });

  return { moved: targets.length, reopened };
}

/** Lo mismo para exámenes. No reabre nada: `Attempt.assessmentVersionId` es el snapshot del intento. */
export async function propagateAssessmentVersion(
  tx: Tx,
  {
    institutionId,
    assessmentId,
    version,
  }: { institutionId: string; assessmentId: string; version: { id: string; number: number } }
): Promise<{ moved: number }> {
  const targets = await tx.assessmentAssignment.findMany({
    where: {
      assessmentId,
      pinnedVersion: false,
      assessmentVersionId: { not: version.id },
      cohort: { status: { in: [...LIVE_COHORT_STATUSES] } },
    },
    select: { id: true, assessmentVersion: { select: { number: true } } },
  });
  if (targets.length === 0) return { moved: 0 };

  await tx.assessmentAssignment.updateMany({
    where: { id: { in: targets.map((a) => a.id) } },
    data: { assessmentVersionId: version.id },
  });
  await tx.auditLog.createMany({
    data: targets.map((a) => ({
      institutionId,
      actorId: null,
      entity: 'assessment_assignment',
      entityId: a.id,
      action: 'version_changed',
      before: { number: a.assessmentVersion.number },
      after: { number: version.number, onPublish: true },
    })),
  });

  return { moved: targets.length };
}

/** Avisa a los reabiertos. Fuera de la transacción, una vez publicada. */
export async function notifyReopened({
  institutionId,
  lessonTitle,
  versionNumber,
  reopened,
  now,
}: {
  institutionId: string;
  lessonTitle: string;
  versionNumber: number;
  reopened: PropagationResult['reopened'];
  now: Date;
}): Promise<number> {
  let total = 0;
  for (const { assignmentId, studentIds } of reopened) {
    const unique = [...new Set(studentIds)];
    total += unique.length;
    await notifyMany(institutionId, unique, {
      type: 'lesson_reopened',
      title: 'Un tema que completaste cambió',
      body: `«${lessonTitle}» tiene una versión nueva con cambios importantes. Vuelve a revisarlo para dejarlo completado.`,
      href: `/aprender/tema/${assignmentId}`,
      dedupeKey: `lesson_reopened:${assignmentId}:${versionNumber}:${now.toISOString().slice(0, 10)}`,
    });
  }
  return total;
}
