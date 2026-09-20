/**
 * Invitaciones en lote, desde una cohorte.
 * SSOT: plan/06-cohortes-y-personas.md:57-63 (§6).
 *
 * Paso **aparte** de la importación, y aposta: importar se arregla corrigiendo una hoja de
 * cálculo, invitar pone un enlace en el correo de alguien. El plan lo separa y esto lo
 * respeta — nada aquí se dispara solo al terminar una importación.
 *
 * El envío va en lotes con `Promise.allSettled`: un correo rebotado no puede impedir los
 * otros cincuenta y cuatro. Lo que falla se devuelve con su motivo, persona a persona, y
 * se puede reintentar sin duplicar a quien ya la recibió.
 */

import 'server-only';

import { createTenantClient } from '@/lib/db/tenant';
import { APIError } from '@/lib/core/errors';
import { sendInvitation } from '@/features/auth/server/invitations.service';

/** El plan fija veinte (plan:62). Es el límite de ráfaga del proveedor, no un número bonito. */
export const BATCH_SIZE = 20;

/** Por qué alguien de la cohorte no puede recibir invitación. */
export type SkipReason = 'no-email' | 'has-account' | 'pending-invitation';

export interface Candidate {
  personId: string;
  name: string;
  email: string | null;
  skip: SkipReason | null;
}

export interface BulkPlan {
  candidates: Candidate[];
  /** Los que sí recibirían correo si se confirma. */
  sendable: number;
}

export interface BulkResult {
  sent: number;
  failed: Array<{ personId: string; name: string; reason: string }>;
  skipped: number;
}

/**
 * Quién de la cohorte recibiría invitación, y por qué el resto no.
 *
 * Es lo que la pantalla enseña **antes** de la confirmación: "Enviar invitaciones a 55
 * personas" solo se puede decir si antes se ha contado quiénes son.
 */
export async function planBulkInvitations({
  institutionId,
  cohortId,
  now = new Date(),
}: {
  institutionId: string;
  cohortId: string;
  now?: Date;
}): Promise<BulkPlan> {
  const db = createTenantClient(institutionId);

  const cohort = await db.cohort.findFirst({
    where: { id: cohortId },
    select: { id: true },
  });
  if (!cohort) throw new APIError('Cohort not found', 'NOT_FOUND');

  const enrollments = await db.enrollment.findMany({
    where: { cohortId, status: 'ACTIVE' },
    orderBy: { enrolledAt: 'asc' },
    select: {
      student: {
        select: {
          id: true,
          givenName: true,
          familyName: true,
          email: true,
          authUserId: true,
          invitations: {
            where: { acceptedAt: null, expiresAt: { gt: now } },
            select: { id: true },
          },
        },
      },
    },
  });

  const candidates: Candidate[] = enrollments.map(({ student }) => {
    const skip: SkipReason | null = !student.email
      ? 'no-email'
      : student.authUserId
        ? 'has-account'
        : student.invitations.length > 0
          ? 'pending-invitation'
          : null;

    return {
      personId: student.id,
      name: `${student.familyName}, ${student.givenName}`,
      email: student.email,
      skip,
    };
  });

  return { candidates, sendable: candidates.filter((c) => c.skip === null).length };
}

/** Parte una lista en trozos del tamaño del lote. */
export function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

/**
 * Envía a todos los que pueden recibirla, en lotes.
 *
 * `Promise.allSettled` y no `Promise.all`: con `all`, el primer correo rechazado aborta el
 * resto del lote y deja un estado a medias imposible de explicar. Aquí cada persona tiene
 * su resultado y el resumen dice exactamente quién se quedó fuera y por qué.
 *
 * Los lotes van en serie a propósito: veinte a la vez es la ráfaga que aguanta el
 * proveedor; doscientos a la vez es cómo se acaba en una lista de bloqueo.
 */
export async function sendBulkInvitations({
  institution,
  cohortId,
  actorId,
  origin,
  now = new Date(),
}: {
  institution: { id: string; name: string; emailFromName: string; supportEmail: string };
  cohortId: string;
  actorId: string;
  origin: string;
  now?: Date;
}): Promise<BulkResult> {
  const plan = await planBulkInvitations({ institutionId: institution.id, cohortId, now });
  const targets = plan.candidates.filter((c) => c.skip === null);

  if (targets.length === 0) {
    throw new APIError(
      'Nadie de esta cohorte puede recibir invitación ahora mismo',
      'VALIDATION_ERROR'
    );
  }

  let sent = 0;
  const failed: BulkResult['failed'] = [];

  for (const batch of chunk(targets, BATCH_SIZE)) {
    const results = await Promise.allSettled(
      batch.map((candidate) =>
        sendInvitation({
          institution,
          personId: candidate.personId,
          actorId,
          origin,
        })
      )
    );

    results.forEach((result, index) => {
      const candidate = batch[index];
      if (!candidate) return;

      if (result.status === 'fulfilled') {
        sent += 1;
      } else {
        failed.push({
          personId: candidate.personId,
          name: candidate.name,
          reason: result.reason instanceof Error ? result.reason.message : String(result.reason),
        });
      }
    });
  }

  const db = createTenantClient(institution.id);
  await db.auditLog.create({
    data: {
      institutionId: institution.id,
      actorId,
      entity: 'invitation',
      entityId: cohortId,
      action: 'bulk_sent',
      after: {
        cohortId,
        sent,
        failed: failed.length,
        skipped: plan.candidates.length - targets.length,
      },
    },
  });

  return { sent, failed, skipped: plan.candidates.length - targets.length };
}
