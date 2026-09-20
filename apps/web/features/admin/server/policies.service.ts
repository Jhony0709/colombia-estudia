/**
 * `RestrictionPolicy`: qué hace la institución con la mora. Dos banderas, todo apagado por
 * defecto, auditado. SSOT: plan/09 §7, acceso-y-cartera.md §2, prisma `RestrictionPolicy`.
 *
 * Lo que este archivo no tiene y no va a tener hasta la asesoría jurídica: una bandera que
 * suspenda contenido. Ninguna política toca el acceso académico de un menor, y para los
 * adultos la columna no existe (acceso-y-cartera.md §2).
 */

import 'server-only';

import { createTenantClient } from '@/lib/db/tenant';

export interface PolicyView {
  requireAgreementForNextCohort: boolean;
  notifyPayerOnOverdue: boolean;
  updatedAt: string | null;
}

export async function getPolicy({ institutionId }: { institutionId: string }): Promise<PolicyView> {
  const db = createTenantClient(institutionId);
  const row = await db.restrictionPolicy.findFirst({ where: { institutionId } });
  return row
    ? {
        requireAgreementForNextCohort: row.requireAgreementForNextCohort,
        notifyPayerOnOverdue: row.notifyPayerOnOverdue,
        updatedAt: row.updatedAt.toISOString(),
      }
    : { requireAgreementForNextCohort: false, notifyPayerOnOverdue: false, updatedAt: null };
}

export async function updatePolicy({
  institutionId,
  actorId,
  input,
  now = new Date(),
}: {
  institutionId: string;
  actorId: string;
  input: { requireAgreementForNextCohort: boolean; notifyPayerOnOverdue: boolean };
  now?: Date;
}): Promise<PolicyView> {
  const db = createTenantClient(institutionId);
  const before = await getPolicy({ institutionId });
  const row = await db.$transaction(async (tx) => {
    const updated = await tx.restrictionPolicy.upsert({
      where: { institutionId },
      create: { institutionId, updatedById: actorId, ...input },
      update: { updatedById: actorId, ...input },
    });
    await tx.auditLog.create({
      data: {
        institutionId,
        actorId,
        entity: 'policy',
        entityId: institutionId,
        action: 'updated',
        before: {
          requireAgreementForNextCohort: before.requireAgreementForNextCohort,
          notifyPayerOnOverdue: before.notifyPayerOnOverdue,
        },
        after: input,
        occurredAt: now,
      },
    });
    return updated;
  });
  return {
    requireAgreementForNextCohort: row.requireAgreementForNextCohort,
    notifyPayerOnOverdue: row.notifyPayerOnOverdue,
    updatedAt: row.updatedAt.toISOString(),
  };
}
