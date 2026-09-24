/**
 * «Reportar un problema» con un tema (plan/08 §2, endpoints.md:40).
 *
 * Un motivo de una lista cerrada más un texto libre; llega como `Notification
 * problem_reported` a operación e instructores, con enlace al tema en el editor, y queda un
 * `LearningEvent problem.reported` para saber cuántas veces se quejaron de qué. No hay
 * tabla propia: es un aviso, y lo que hay que hacer con él se hace en el tema.
 */

import 'server-only';

import { createTenantClient } from '@/lib/db/tenant';
import { APIError } from '@/lib/core/errors';
import { notifyMany, staffPersonIds } from '@/features/notifications/server/notifications.service';
import { getCohortOutline } from './cohort.service';

export const PROBLEM_REASONS = [
  'CONTENT_ERROR',
  'MEDIA_BROKEN',
  'ACCESSIBILITY',
  'CANNOT_COMPLETE',
  'OTHER',
] as const;
export type ProblemReason = (typeof PROBLEM_REASONS)[number];

const REASON_LABEL: Record<ProblemReason, string> = {
  CONTENT_ERROR: 'Error en el contenido',
  MEDIA_BROKEN: 'Un video, audio o archivo no funciona',
  ACCESSIBILITY: 'No es accesible',
  CANNOT_COMPLETE: 'No se marca como completado',
  OTHER: 'Otro',
};

export async function reportLessonProblem({
  institutionId,
  personId,
  assignmentId,
  reason,
  details,
  now = new Date(),
}: {
  institutionId: string;
  personId: string;
  assignmentId: string;
  reason: ProblemReason;
  details: string | null;
  now?: Date;
}): Promise<{ notified: number }> {
  const outline = await getCohortOutline({ institutionId, personId, assignmentId, now });
  const item = outline.modules.flatMap((m) => m.items).find((i) => i.assignmentId === assignmentId);
  if (!item || item.kind !== 'LESSON') throw new APIError('Not found', 'NOT_FOUND');

  const db = createTenantClient(institutionId);
  const assignment = await db.lessonAssignment.findFirst({
    where: { id: assignmentId },
    select: { lesson: { select: { id: true, title: true } }, cohort: { select: { code: true } } },
  });
  if (!assignment) throw new APIError('Not found', 'NOT_FOUND');

  const reporter = await db.person.findFirst({
    where: { id: personId },
    select: { givenName: true, familyName: true },
  });

  await db.learningEvent.create({
    data: {
      institutionId,
      studentId: personId,
      enrollmentId: outline.enrollmentId,
      type: 'problem.reported',
      payload: { assignmentId, lessonId: assignment.lesson.id, reason },
      occurredAt: now,
    },
  });

  const recipients = await staffPersonIds(institutionId, ['OPERATIONS', 'INSTRUCTOR', 'ADMIN']);
  const who = reporter ? `${reporter.givenName} ${reporter.familyName}` : 'Un estudiante';
  const result = await notifyMany(institutionId, recipients, {
    type: 'problem_reported',
    title: `Problema en «${assignment.lesson.title}»`,
    body: `${who} (${assignment.cohort.code}): ${REASON_LABEL[reason]}${details ? ` — ${details}` : ''}`,
    href: `/contenido/temas/${assignment.lesson.id}`,
  });
  return { notified: result.created };
}
