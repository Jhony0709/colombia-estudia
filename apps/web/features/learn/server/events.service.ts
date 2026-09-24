/**
 * Eventos de uso del estudiante que el cliente declara (E0 de la decisión del estudiante,
 * 23/9): la acción principal de una pantalla se mostró / se pulsó. Van a `LearningEvent`,
 * junto a los que ya emite el servidor (`lesson.opened`, `lesson.completed`,
 * `attempt.started`…), y con ellos se arma el embudo de `/inicio`.
 * SSOT: docs/ux/decision-estudiante-2309.md (E0), reference/04-business-logic/reportes.md.
 *
 * Sin PII por construcción: el payload es una lista cerrada de claves con valores de
 * enumeración o ids de asignación; nada libre. Y sin confiar en el cliente para el
 * `enrollmentId`: si viene, tiene que ser una matrícula de la misma persona.
 */

import 'server-only';

import { createTenantClient } from '@/lib/db/tenant';
import type { StudentEventPayload, StudentEventType } from '@/lib/telemetry/student-events';

export type { StudentEventPayload, StudentEventType };

export async function recordStudentEvent({
  institutionId,
  personId,
  enrollmentId,
  type,
  payload,
  now = new Date(),
}: {
  institutionId: string;
  personId: string;
  enrollmentId: string | null;
  type: StudentEventType;
  payload: StudentEventPayload;
  now?: Date;
}): Promise<void> {
  const db = createTenantClient(institutionId);

  const ownEnrollment = enrollmentId
    ? await db.enrollment.findFirst({
        where: { id: enrollmentId, studentId: personId },
        select: { id: true },
      })
    : null;

  await db.learningEvent.create({
    data: {
      institutionId,
      studentId: personId,
      enrollmentId: ownEnrollment?.id ?? null,
      type,
      payload: {
        screen: payload.screen,
        action: payload.action,
        ...(payload.assignmentId ? { assignmentId: payload.assignmentId } : {}),
        ...(payload.form ? { form: payload.form } : {}),
        ...(payload.request ? { request: payload.request } : {}),
        ...(payload.outcome ? { outcome: payload.outcome } : {}),
        ...(typeof payload.durationMs === 'number'
          ? { durationMs: Math.max(0, Math.round(payload.durationMs)) }
          : {}),
      },
      occurredAt: now,
    },
  });
}
