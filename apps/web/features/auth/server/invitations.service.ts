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
import { getMailer } from '@/lib/mail';
import { renderInvitationEmail } from '@/lib/mail/templates/invitation';
import { bogotaDate } from '@colombia-estudia/domain';

// ─────────────────────────── Send / reinvite ───────────────────────────

interface SendInvitationInput {
  institution: { id: string; name: string; emailFromName: string; supportEmail: string };
  personId: string;
  actorId: string;
  /** Origin of the request that creates the invitation (never a configured default). */
  origin: string;
  reinvite?: boolean;
}

/**
 * Invalidates pending invitations, creates a new one, sends the email and audits
 * `invitation.sent`. The raw token only ever travels inside the email.
 */
export async function sendInvitation(
  input: SendInvitationInput
): Promise<{ invitationId: string }> {
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

  const email = renderInvitationEmail({
    givenName: person.givenName,
    institutionName: institution.name,
    inviteUrl: `${origin}/invitacion/${token}`,
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

  return { invitationId: invitation.id };
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
      person: { select: { givenName: true, familyName: true, email: true } },
    },
  });

  if (!invitation) return;
  // Pending and valid: the person can still use the link.
  if (!invitation.acceptedAt && invitation.expiresAt > new Date()) return;

  const staffMembers = await prisma.membership.findMany({
    where: {
      institutionId: invitation.institutionId,
      role: { in: ['ADMIN', 'OPERATIONS'] },
      revokedAt: null,
    },
    select: { personId: true },
  });
  if (staffMembers.length === 0) return;

  const today = bogotaDate(new Date());
  const personName = `${invitation.person.givenName} ${invitation.person.familyName}`;

  await prisma.notification.createMany({
    data: staffMembers.map((member) => ({
      institutionId: invitation.institutionId,
      personId: member.personId,
      type: 'reinvite_requested' as const,
      title: 'Solicitud de nueva invitación',
      body: `${personName} (${invitation.person.email ?? 'sin correo'}) solicitó una nueva invitación.`,
      // routes.md:51: personas e invitaciones viven en /personas (grupo staff).
      href: `/personas/${invitation.personId}`,
      dedupeKey: `reinvite:${invitation.personId}:${today}`,
    })),
    skipDuplicates: true,
  });
}
