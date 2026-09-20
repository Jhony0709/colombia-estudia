/**
 * Anonimización (Ley 1581 de 2012): lo que se hace cuando alguien pide que sus datos
 * personales dejen de existir aquí. SSOT: plan/03 «Sesión» (borra el usuario de Auth),
 * plan/10 §3, prisma `Person.anonymizedAt`, catálogo `person.anonymized`.
 *
 * Qué se borra: nombre, documento, fecha de nacimiento, correo, teléfono y el usuario de
 * Auth (no podrá entrar). Qué se conserva: la fila (`id`) y todo lo que cuelga de ella
 * —matrículas, progreso, intentos, notas, cartera, auditoría—, porque son registros de la
 * institución (académicos y contables) que la ley obliga a guardar y que ya no identifican
 * a nadie sin los campos borrados. Las membresías se revocan y las invitaciones pendientes
 * dejan de valer. Es irreversible, y por eso pide motivo y queda en `AuditLog`.
 *
 * `institution.manage`: no es una operación del día a día.
 */

import 'server-only';

import { createTenantClient } from '@/lib/db/tenant';
import { APIError } from '@/lib/core/errors';
import { getSupabaseAdmin } from '@/lib/auth/supabase-server';
import { logger } from '@/lib/observability/logger';

export async function anonymizePerson({
  institutionId,
  actorId,
  personId,
  reason,
  now = new Date(),
}: {
  institutionId: string;
  actorId: string;
  personId: string;
  reason: string;
  now?: Date;
}): Promise<{ personId: string; anonymizedAt: string }> {
  if (personId === actorId) {
    throw new APIError('No puedes anonimizarte a ti mismo desde aquí', 'CONFLICT');
  }
  const db = createTenantClient(institutionId);
  const person = await db.person.findFirst({
    where: { id: personId },
    select: { id: true, authUserId: true, anonymizedAt: true },
  });
  if (!person) throw new APIError('Not found', 'NOT_FOUND');
  if (person.anonymizedAt) throw new APIError('Esta persona ya fue anonimizada', 'CONFLICT');

  // Primero la base: si esto falla, nada cambió. El usuario de Auth se borra después, y si
  // esa parte falla queda un usuario sin persona que no puede hacer nada (sin membresías,
  // sin matrícula que le dé capacidades) y se registra para repetir.
  await db.$transaction(async (tx) => {
    await tx.person.update({
      where: { id: person.id },
      data: {
        givenName: 'Persona',
        familyName: 'anonimizada',
        documentType: null,
        documentNumber: null,
        birthDate: null,
        email: null,
        phone: null,
        authUserId: null,
        anonymizedAt: now,
      },
    });
    await tx.membership.updateMany({
      where: { personId: person.id, revokedAt: null },
      data: { revokedAt: now },
    });
    await tx.invitation.updateMany({
      where: { personId: person.id, acceptedAt: null },
      data: { expiresAt: now },
    });
    await tx.auditLog.create({
      data: {
        institutionId,
        actorId,
        entity: 'person',
        entityId: person.id,
        action: 'anonymized',
        after: { reason },
        occurredAt: now,
      },
    });
  });

  if (person.authUserId) {
    try {
      await getSupabaseAdmin().auth.admin.deleteUser(person.authUserId);
    } catch (err) {
      logger.error({
        event: 'anonymize-auth-delete-failed',
        personId: person.id,
        error: String(err),
      });
    }
  }

  return { personId: person.id, anonymizedAt: now.toISOString() };
}
