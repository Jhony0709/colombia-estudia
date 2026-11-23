/**
 * Pedir el certificado de estudios desde `/aprender/certificados` (23/11). No es una constancia:
 * lo expide la institución, cuesta y se paga aparte. Llega como aviso a operación con enlace a la
 * ficha (ahí están el nombre y el documento) y queda en la auditoría de la persona. Sin tabla
 * propia, como «Reportar un problema» (`features/learn/server/report.service.ts`).
 */

import 'server-only';

import { createTenantClient } from '@/lib/db/tenant';
import { APIError } from '@/lib/core/errors';
import { notifyMany, staffPersonIds } from '@/features/notifications/server/notifications.service';

export async function requestStudyCertificate({
  institutionId,
  personId,
  documentPlace,
  reason,
  now = new Date(),
}: {
  institutionId: string;
  personId: string;
  documentPlace: string;
  reason: string;
  now?: Date;
}): Promise<{ notified: number }> {
  const db = createTenantClient(institutionId);
  const person = await db.person.findFirst({
    where: { id: personId },
    select: { code: true, givenName: true, familyName: true },
  });
  if (!person) throw new APIError('Not found', 'NOT_FOUND');

  await db.auditLog.create({
    data: {
      institutionId,
      actorId: personId,
      entity: 'person',
      entityId: personId,
      action: 'study_certificate.requested',
      after: { documentPlace, reason, channel: 'platform' },
      occurredAt: now,
    },
  });

  const staff = await staffPersonIds(institutionId, ['OPERATIONS', 'ADMIN']);
  const result = await notifyMany(institutionId, staff, {
    type: 'study_certificate_requested',
    title: 'Pedido de certificado de estudios',
    body: `${person.givenName} ${person.familyName}: ${reason} (documento expedido en ${documentPlace}).`,
    href: `/personas/${person.code}`,
    // Uno por persona y día: pulsar dos veces no avisa dos veces.
    dedupeKey: `study_certificate:${personId}:${now.toISOString().slice(0, 10)}`,
  });
  return { notified: result.created };
}
