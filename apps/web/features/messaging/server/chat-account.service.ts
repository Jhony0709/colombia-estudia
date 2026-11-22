import 'server-only';

/**
 * Crear la cuenta desde el chat de WhatsApp (22/11). El bot ya pidió la autorización de datos,
 * que es mayor de edad, nombre, correo y fecha de nacimiento (`intake.ts`, `ACCOUNT`). Aquí se
 * crea la ficha con su rol de estudiante, se matricula en la introducción —como `/registro`— y
 * se le envía la invitación: el enlace prueba que el correo es suyo, y en esa página acepta la
 * política y crea su contraseña. Por WhatsApp no viajan ni contraseña ni número de documento.
 */

import { createTenantClient, prisma } from '@/lib/db/tenant';
import { logger } from '@/lib/observability/logger';
import { siteUrl } from '@/lib/seo/site-url';
import { sendInvitation } from '@/features/auth/server/invitations.service';
import { enrollInIntroCohort } from '@/features/auth/server/registration.service';
import type { IntakeData } from '../intake';

export type ChatAccountResult =
  | { status: 'sent'; email: string; enrolled: boolean }
  | { status: 'has_account' }
  | { status: 'has_profile' }
  /** La ficha quedó, pero el correo no salió (sin proveedor de correo): lo sigue un asesor. */
  | { status: 'not_delivered' }
  | { status: 'failed' };

export async function createAccountFromChat({
  institutionId,
  conversationId,
  data,
  now,
}: {
  institutionId: string;
  conversationId: string;
  data: IntakeData;
  now: Date;
}): Promise<ChatAccountResult> {
  const db = createTenantClient(institutionId);
  const email = (data.email ?? '').trim().toLowerCase();
  const [givenName = '', ...rest] = (data.fullName ?? '').trim().split(/\s+/);
  const birthDate = data.birthDate ? new Date(`${data.birthDate}T00:00:00.000Z`) : null;
  if (!email || !givenName || !rest.length || !birthDate) return { status: 'failed' };

  // Como en `/registro`: un correo de la institución no se registra otra vez.
  const existing = await db.person.findFirst({
    where: { email, anonymizedAt: null },
    select: { authUserId: true },
  });
  if (existing) return { status: existing.authUserId ? 'has_account' : 'has_profile' };

  try {
    const personId = await db.$transaction(async (tx) => {
      const person = await tx.person.create({
        data: {
          institutionId,
          givenName,
          familyName: rest.join(' '),
          email,
          phone: data.phone ?? null,
          birthDate,
        },
        select: { id: true },
      });
      await tx.membership.create({ data: { institutionId, personId: person.id, role: 'STUDENT' } });
      await tx.auditLog.create({
        data: {
          institutionId,
          actorId: person.id,
          entity: 'person',
          entityId: person.id,
          action: 'registered',
          after: { channel: 'whatsapp', conversationId, consentAt: data._consentAt ?? null },
          occurredAt: now,
        },
      });
      return person.id;
    });
    await prisma.conversation.update({ where: { id: conversationId }, data: { personId } });

    const institution = await db.institution.findUniqueOrThrow({
      where: { id: institutionId },
      select: {
        id: true,
        name: true,
        emailFromName: true,
        supportEmail: true,
        introCohortId: true,
      },
    });
    const enrollment = await enrollInIntroCohort({
      institutionId,
      personId,
      email,
      introCohortId: institution.introCohortId,
      now,
    });
    const sent = await sendInvitation({
      institution,
      personId,
      actorId: personId,
      origin: siteUrl(),
      confirm: true,
    });
    if (!sent.emailDelivered) return { status: 'not_delivered' };
    return { status: 'sent', email, enrolled: enrollment.status === 'ENROLLED' };
  } catch (err) {
    logger.warn({ event: 'whatsapp-account-failed', conversationId, error: String(err) });
    return { status: 'failed' };
  }
}

/**
 * «Reenviar correo» (22/11): la invitación otra vez, con el mismo texto de confirmar; la
 * anterior deja de servir. Solo para la ficha que este chat creó y que todavía no tiene cuenta.
 */
export async function resendAccountEmail({
  institutionId,
  conversationId,
}: {
  institutionId: string;
  conversationId: string;
}): Promise<'sent' | 'has_account' | 'none'> {
  const conversation = await prisma.conversation.findFirst({
    where: { id: conversationId, institutionId, intakeKind: 'ACCOUNT' },
    select: { person: { select: { id: true, authUserId: true, email: true } } },
  });
  const person = conversation?.person;
  if (!person?.email) return 'none';
  if (person.authUserId) return 'has_account';
  const institution = await createTenantClient(institutionId).institution.findUniqueOrThrow({
    where: { id: institutionId },
    select: { id: true, name: true, emailFromName: true, supportEmail: true },
  });
  try {
    const sent = await sendInvitation({
      institution,
      personId: person.id,
      actorId: person.id,
      origin: siteUrl(),
      reinvite: true,
      confirm: true,
    });
    return sent.emailDelivered ? 'sent' : 'none';
  } catch (err) {
    logger.warn({ event: 'whatsapp-account-resend-failed', conversationId, error: String(err) });
    return 'none';
  }
}
