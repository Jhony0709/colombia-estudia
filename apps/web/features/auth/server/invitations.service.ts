/**
 * Invitations service: the only place where invitation routes touch the database.
 * SSOT: plan/03-identidad-y-acceso.md "Invitación (3 pasos, móvil)", plan/01:113-115
 * (route handlers go through features/*\/server, never lib/db directly).
 */

import 'server-only';

import { APIError } from '@/lib/core/errors';
import { createTenantClient, prisma } from '@/lib/db/tenant';
import { generateInvitationToken, hashToken } from '@/lib/auth/invitation-token';
import { getSupabaseAdmin } from '@/lib/auth/supabase-server';
import { getMailer, isMailConfigured } from '@/lib/mail';
import { renderInvitationEmail } from '@/lib/mail/templates/invitation';
import { bogotaDate } from '@colombia-estudia/domain';
import {
  staffPersonIds,
  notifyManyWithoutContext,
} from '@/features/notifications/server/notifications.service';

// ─────────────────────────── Send / reinvite ───────────────────────────

interface SendInvitationInput {
  institution: { id: string; name: string; emailFromName: string; supportEmail: string };
  personId: string;
  actorId: string;
  /** Origin of the request that creates the invitation (never a configured default). */
  origin: string;
  reinvite?: boolean;
}

export interface SentInvitation {
  invitationId: string;
  /**
   * El enlace con el token **en claro**, devuelto UNA vez, aquí y solo aquí.
   *
   * La base guarda `tokenHash` (SHA-256) y nunca el token: quien tenga acceso a la base no
   * puede suplantar a nadie con una invitación pendiente. La consecuencia es que el enlace no
   * se puede recuperar después —ni por la pantalla ni por consulta— y por eso se devuelve en
   * el momento de crearlo, para que operación pueda entregarlo por otro canal cuando el
   * correo no sale. Perdido, no se recupera: se reenvía, y eso invalida el anterior.
   *
   * No se escribe en ningún log. `apiHandler` registra ruta, estado y duración, nunca el
   * cuerpo de la respuesta.
   */
  inviteUrl: string;
  expiresAt: Date;
  /**
   * `false` significa que **no salió ningún correo**: no hay proveedor configurado y el
   * `ConsoleMailer` lo escribió en el log. La pantalla lo dice en vez de cantar victoria.
   */
  emailDelivered: boolean;
}

/**
 * Invalidates pending invitations, creates a new one, sends the email and audits
 * `invitation.sent`.
 */
export async function sendInvitation(input: SendInvitationInput): Promise<SentInvitation> {
  const { institution, personId, actorId, origin, reinvite = false } = input;
  const db = createTenantClient(institution.id);

  const person = await db.person.findUnique({
    where: { id: personId },
    select: { id: true, givenName: true, email: true, authUserId: true },
  });

  if (!person) {
    throw new APIError('Person not found', 'NOT_FOUND');
  }
  if (!person.email) {
    throw new APIError('Person has no email address', 'VALIDATION_ERROR');
  }
  if (person.authUserId) {
    throw new APIError('Person already has an account', 'CONFLICT');
  }

  const now = new Date();
  await db.invitation.updateMany({
    where: { personId, acceptedAt: null, expiresAt: { gt: now } },
    data: { expiresAt: now },
  });

  const { token, hash, expiresAt } = generateInvitationToken();
  const invitation = await db.invitation.create({
    data: {
      personId,
      institutionId: institution.id,
      tokenHash: hash,
      expiresAt,
      createdById: actorId,
    },
  });

  const inviteUrl = `${origin}/invitacion/${token}`;
  const email = renderInvitationEmail({
    givenName: person.givenName,
    institutionName: institution.name,
    inviteUrl,
    expiresAt,
  });
  await getMailer({
    emailFromName: institution.emailFromName,
    supportEmail: institution.supportEmail,
  }).send({ to: person.email, subject: email.subject, html: email.html, text: email.text });

  await db.auditLog.create({
    data: {
      institutionId: institution.id,
      actorId,
      entity: 'invitation',
      entityId: invitation.id,
      action: 'sent',
      ...(reinvite ? { after: { reinvite: true } } : {}),
    },
  });

  return {
    invitationId: invitation.id,
    inviteUrl,
    expiresAt,
    emailDelivered: isMailConfigured(),
  };
}

// ─────────────────────────── Accept ───────────────────────────

interface AcceptInvitationInput {
  invitationId: string;
  institutionId: string;
  personId: string;
  isMinor: boolean;
  dataPolicyVersion: string;
  password: string;
}

/**
 * Creates the Auth user, then in one transaction: Person.authUserId, Consent (adults),
 * Invitation.acceptedAt, AuditLog. If the transaction fails the Auth user is deleted.
 * Public flow: no request context, so every `where` carries the institutionId explicitly.
 */
export async function acceptInvitation(input: AcceptInvitationInput): Promise<{ email: string }> {
  const { invitationId, institutionId, personId, isMinor, dataPolicyVersion, password } = input;

  const person = await prisma.person.findUnique({
    where: { id: personId, institutionId },
    select: { email: true },
  });
  if (!person?.email) {
    throw new APIError('Person has no email address', 'VALIDATION_ERROR');
  }
  const email = person.email;

  const admin = getSupabaseAdmin();
  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true, // the invitation already proved control of the mailbox
  });

  if (authError || !authData.user) {
    if (authError?.code === 'email_exists') {
      throw new APIError('Ya tienes una cuenta con este correo; inicia sesión', 'CONFLICT');
    }
    if (authError?.code === 'weak_password') {
      throw new APIError(
        'Esa contraseña es demasiado débil o apareció en filtraciones de datos; elige otra',
        'VALIDATION_ERROR'
      );
    }
    throw new APIError('Failed to create account', 'INTERNAL');
  }
  const authUserId = authData.user.id;

  try {
    await prisma.$transaction(async (tx) => {
      await tx.person.update({ where: { id: personId, institutionId }, data: { authUserId } });
      if (!isMinor) {
        await tx.consent.create({
          data: {
            institutionId,
            subjectId: personId,
            signedById: personId,
            policyVersion: dataPolicyVersion,
            channel: 'PLATFORM',
          },
        });
      }
      await tx.invitation.update({
        where: { id: invitationId, institutionId },
        data: { acceptedAt: new Date() },
      });
      await tx.auditLog.create({
        data: {
          institutionId,
          actorId: personId,
          entity: 'invitation',
          entityId: invitationId,
          action: 'accepted',
        },
      });
    });
  } catch {
    await admin.auth.admin.deleteUser(authUserId);
    throw new APIError('Failed to complete registration', 'INTERNAL');
  }

  return { email };
}

// ─────────────────────────── Request a new invitation ───────────────────────────

/**
 * Expired or used token → one Notification per active ADMIN/OPERATIONS per Bogotá day.
 * Never reveals whether the token exists: callers answer 200 whatever this does.
 */
export async function requestNewInvitation(token: string): Promise<void> {
  const invitation = await prisma.invitation.findFirst({
    where: { tokenHash: hashToken(token) },
    select: {
      personId: true,
      institutionId: true,
      acceptedAt: true,
      expiresAt: true,
      person: { select: { code: true, givenName: true, familyName: true, email: true } },
    },
  });

  if (!invitation) return;
  // Pending and valid: the person can still use the link.
  if (!invitation.acceptedAt && invitation.expiresAt > new Date()) return;

  const staff = await staffPersonIds(invitation.institutionId, ['ADMIN', 'OPERATIONS']);
  if (staff.length === 0) return;

  const today = bogotaDate(new Date());
  const personName = `${invitation.person.givenName} ${invitation.person.familyName}`;

  // Sin contexto de petición: este flujo es público, lo dispara quien abrió un enlace
  // vencido sin haber iniciado sesión nunca.
  await notifyManyWithoutContext(invitation.institutionId, staff, {
    type: 'reinvite_requested',
    title: 'Solicitud de nueva invitación',
    body: `${personName} (${invitation.person.email ?? 'sin correo'}) solicitó una nueva invitación.`,
    // routes.md:51: personas e invitaciones viven en /personas (grupo staff).
    href: `/personas/${invitation.person.code}`,
    // Una sola solicitud por persona y día: quien insiste con el enlace vencido no debe
    // llenar el centro de notificaciones de operaciones.
    dedupeKey: `reinvite:${invitation.personId}:${today}`,
  });
}

// ─────────────────────────── Estado para operación ───────────────────────────

export interface InvitationOverview {
  /**
   * `account` gana sobre todo lo demás: si la persona ya entró, da igual cuántas
   * invitaciones tenga detrás.
   */
  state: 'account' | 'accepted' | 'pending' | 'expired' | 'none';
  /** Si tiene correo. Sin correo no hay invitación que enviar, y conviene decirlo antes. */
  hasEmail: boolean;
  /** Cuándo vence la que está viva, si la hay. */
  expiresAt: string | null;
  /** Cuándo la aceptó, si la aceptó. */
  acceptedAt: string | null;
  /**
   * El historial: cuándo se envió cada una y quién la envió. Es lo que contesta «¿ya se le
   * mandó?», que hasta hoy solo se podía responder mirando la auditoría.
   */
  history: Array<{
    id: string;
    sentAt: string;
    expiresAt: string;
    acceptedAt: string | null;
    sentBy: string;
    /** Vencida o invalidada por un reenvío: para quien mira es lo mismo, ya no sirve. */
    dead: boolean;
  }>;
  /** Si hay proveedor de correo. Si no, «enviar» no manda nada y hay que entregar el enlace. */
  mailConfigured: boolean;
}

/**
 * Todo lo que operación necesita saber de la invitación de una persona.
 *
 * Lo que **no** devuelve, y no puede devolver, es el enlace: la base guarda solo la huella
 * del token. Ver `SentInvitation.inviteUrl`.
 */
export async function getInvitationOverview({
  institutionId,
  personId,
  now = new Date(),
}: {
  institutionId: string;
  personId: string;
  now?: Date;
}): Promise<InvitationOverview | null> {
  const db = createTenantClient(institutionId);

  const person = await db.person.findFirst({
    where: { id: personId },
    select: {
      id: true,
      email: true,
      authUserId: true,
      invitations: {
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          createdAt: true,
          expiresAt: true,
          acceptedAt: true,
          createdBy: { select: { givenName: true, familyName: true } },
        },
      },
    },
  });

  if (!person) return null;

  const live = person.invitations.find((i) => i.acceptedAt === null && i.expiresAt > now);
  const accepted = person.invitations.find((i) => i.acceptedAt !== null);

  const state: InvitationOverview['state'] = person.authUserId
    ? 'account'
    : accepted
      ? 'accepted'
      : live
        ? 'pending'
        : person.invitations.length > 0
          ? 'expired'
          : 'none';

  return {
    state,
    hasEmail: Boolean(person.email),
    expiresAt: live ? live.expiresAt.toISOString() : null,
    acceptedAt: accepted?.acceptedAt ? accepted.acceptedAt.toISOString() : null,
    history: person.invitations.map((invitation) => ({
      id: invitation.id,
      sentAt: invitation.createdAt.toISOString(),
      expiresAt: invitation.expiresAt.toISOString(),
      acceptedAt: invitation.acceptedAt ? invitation.acceptedAt.toISOString() : null,
      sentBy: `${invitation.createdBy.givenName} ${invitation.createdBy.familyName}`.trim(),
      dead: invitation.acceptedAt === null && invitation.expiresAt <= now,
    })),
    mailConfigured: isMailConfigured(),
  };
}
