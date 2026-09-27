import 'server-only';

/**
 * La lista de precios de un programa (25/9, fase de negocio 1).
 * SSOT: prisma/schema.prisma (`ProgramPrice`, `PaymentPlan.priceId`), PRODUCT_DECISIONS.md
 * 2026-09-25 («el precio es un dato del programa, no del plan»).
 *
 * Los clientes venden «grado 6 a 8: $120.000 c/m; 9 a 11: $90.000 c/m». Un precio es un
 * monto, un periodo (una vez, por mes, por componente), un rango de grados opcional y una
 * vigencia. El plan de pagos de una matrícula referencia el precio del que salió su total,
 * y así Cartera puede decir de dónde viene cada número. Un precio no se borra: se archiva,
 * porque los planes viejos lo referencian.
 *
 * Montos en pesos enteros (`Decimal(12,0)` en la base, `number` aquí), como en
 * `billing.service.ts`.
 */

import { dateOnly } from '@colombia-estudia/domain';
import { createTenantClient } from '@/lib/db/tenant';
import { APIError } from '@/lib/core/errors';

export type PricePeriod = 'ONE_TIME' | 'MONTHLY' | 'PER_MODULE';

export interface ProgramPriceView {
  id: string;
  programId: string;
  gradeFrom: number | null;
  gradeTo: number | null;
  amount: number;
  period: PricePeriod;
  /** `YYYY-MM-DD`. */
  validFrom: string;
  validTo: string | null;
  archived: boolean;
  /** Cuántos planes de pago lo referencian: con alguno, archivar en vez de tocar. */
  planCount: number;
}

export const toProgramPriceView = (p: {
  id: string;
  programId: string;
  gradeFrom: number | null;
  gradeTo: number | null;
  amount: { toNumber(): number };
  period: PricePeriod;
  validFrom: Date;
  validTo: Date | null;
  archivedAt: Date | null;
  _count: { paymentPlans: number };
}): ProgramPriceView => ({
  id: p.id,
  programId: p.programId,
  gradeFrom: p.gradeFrom,
  gradeTo: p.gradeTo,
  amount: p.amount.toNumber(),
  period: p.period,
  validFrom: dateOnly(p.validFrom),
  validTo: p.validTo ? dateOnly(p.validTo) : null,
  archived: p.archivedAt !== null,
  planCount: p._count.paymentPlans,
});

export const PROGRAM_PRICE_SELECT = {
  id: true,
  programId: true,
  gradeFrom: true,
  gradeTo: true,
  amount: true,
  period: true,
  validFrom: true,
  validTo: true,
  archivedAt: true,
  _count: { select: { paymentPlans: true } },
} as const;

/** Los precios de un programa, vigentes primero; los archivados solo si se piden. */
export async function listProgramPrices({
  institutionId,
  programId,
  includeArchived = false,
}: {
  institutionId: string;
  programId: string;
  includeArchived?: boolean;
}): Promise<ProgramPriceView[]> {
  const db = createTenantClient(institutionId);
  const prices = await db.programPrice.findMany({
    where: { programId, ...(includeArchived ? {} : { archivedAt: null }) },
    orderBy: [{ gradeFrom: 'asc' }, { validFrom: 'desc' }],
    select: PROGRAM_PRICE_SELECT,
  });
  return prices.map(toProgramPriceView);
}

/**
 * El precio que aplica hoy a una matrícula del programa, para un grado (o sin grado).
 * Con varios candidatos gana el más específico (con rango) y, a igualdad, el más reciente.
 */
export async function currentPriceFor({
  institutionId,
  programId,
  grade,
  on = new Date(),
}: {
  institutionId: string;
  programId: string;
  grade: number | null;
  on?: Date;
}): Promise<ProgramPriceView | null> {
  const db = createTenantClient(institutionId);
  const candidates = await db.programPrice.findMany({
    where: {
      programId,
      archivedAt: null,
      validFrom: { lte: on },
      OR: [{ validTo: null }, { validTo: { gte: on } }],
    },
    orderBy: { validFrom: 'desc' },
    select: PROGRAM_PRICE_SELECT,
  });
  const applies = candidates.filter((p) => {
    if (p.gradeFrom === null && p.gradeTo === null) return true;
    if (grade === null) return false;
    return (p.gradeFrom ?? -Infinity) <= grade && grade <= (p.gradeTo ?? Infinity);
  });
  const specific = applies.find((p) => p.gradeFrom !== null || p.gradeTo !== null);
  const chosen = specific ?? applies[0];
  return chosen ? toProgramPriceView(chosen) : null;
}

export async function createProgramPrice({
  institutionId,
  actorId,
  programId,
  input,
}: {
  institutionId: string;
  actorId: string | null;
  programId: string;
  input: {
    gradeFrom: number | null;
    gradeTo: number | null;
    amount: number;
    period: PricePeriod;
    validFrom: string;
    validTo: string | null;
  };
}): Promise<{ id: string }> {
  if (!Number.isInteger(input.amount) || input.amount <= 0) {
    throw new APIError('El precio tiene que ser un entero mayor que cero', 'VALIDATION_ERROR');
  }
  if (input.gradeFrom !== null && input.gradeTo !== null && input.gradeFrom > input.gradeTo) {
    throw new APIError('El grado inicial no puede ser mayor que el final', 'VALIDATION_ERROR');
  }
  if (input.validTo !== null && input.validTo < input.validFrom) {
    throw new APIError('La vigencia termina antes de empezar', 'VALIDATION_ERROR');
  }

  const db = createTenantClient(institutionId);
  const program = await db.program.findFirst({
    where: { id: programId, archivedAt: null },
    select: { id: true },
  });
  if (!program) throw new APIError('Program not found', 'NOT_FOUND');

  return db.$transaction(async (tx) => {
    const price = await tx.programPrice.create({
      data: {
        institutionId,
        programId,
        gradeFrom: input.gradeFrom,
        gradeTo: input.gradeTo,
        amount: input.amount,
        period: input.period,
        validFrom: new Date(`${input.validFrom}T00:00:00.000Z`),
        validTo: input.validTo ? new Date(`${input.validTo}T00:00:00.000Z`) : null,
        createdById: actorId,
      },
      select: { id: true },
    });
    await tx.auditLog.create({
      data: {
        institutionId,
        actorId,
        entity: 'program_price',
        entityId: price.id,
        action: 'created',
        after: { programId, ...input },
      },
    });
    return price;
  });
}

/** Archiva un precio: deja de ofrecerse; los planes que lo referencian lo conservan. */
export async function archiveProgramPrice({
  institutionId,
  actorId,
  priceId,
}: {
  institutionId: string;
  actorId: string | null;
  priceId: string;
}): Promise<{ id: string }> {
  const db = createTenantClient(institutionId);
  const price = await db.programPrice.findFirst({
    where: { id: priceId, archivedAt: null },
    select: { id: true, programId: true },
  });
  if (!price) throw new APIError('Price not found', 'NOT_FOUND');

  await db.$transaction(async (tx) => {
    await tx.programPrice.update({ where: { id: priceId }, data: { archivedAt: new Date() } });
    await tx.auditLog.create({
      data: {
        institutionId,
        actorId,
        entity: 'program_price',
        entityId: priceId,
        action: 'archived',
        before: { programId: price.programId },
      },
    });
  });
  return { id: priceId };
}
