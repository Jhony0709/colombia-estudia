import 'server-only';

/**
 * La lista de precios de un programa (25/9, fase de negocio 1).
 * SSOT: prisma/schema.prisma (`ProgramPrice`, `PaymentPlan.priceId`), PRODUCT_DECISIONS.md
 * 2026-09-25 («el precio es un dato del programa, no del plan»).
 *
 * Los clientes venden «grado 6 a 8: $120.000 c/m; 9 a 11: $90.000 c/m». Un precio es un
 * monto, un periodo (una vez, por mes, por componente), un rango de grados opcional y una
 * vigencia. El plan de pagos de una matrícula referencia el precio del que salió su total,
 * y así Cartera puede decir de dónde viene cada número. Por eso un precio que ya usa algún plan
 * no se edita ni se borra: se archiva y se crea otro. Uno que nadie usa sí (8/10): corregir
 * un error de digitación no puede dejar basura archivada.
 *
 * Las fechas son días de Bogotá (reference/04-business-logic/acceso-y-cartera.md:98): «vigente
 * hasta el 31» incluye todo el 31.
 *
 * Montos en pesos enteros (`Decimal(12,0)` en la base, `number` aquí), como en
 * `billing.service.ts`.
 */

import { bogotaDate, dateOnly } from '@colombia-estudia/domain';
import { createTenantClient, type TenantClient } from '@/lib/db/tenant';
import { APIError } from '@/lib/core/errors';

export type PricePeriod = 'ONE_TIME' | 'MONTHLY' | 'PER_MODULE';

/**
 * Cómo está hoy: `CURRENT` se cobra; `SCHEDULED` empieza más adelante; `REPLACED` lo tapa otro
 * más reciente para los mismos grados; `EXPIRED` ya terminó. `null` si está archivado.
 */
export type PriceState = 'CURRENT' | 'SCHEDULED' | 'REPLACED' | 'EXPIRED';

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
  createdAt: string;
  state: PriceState | null;
}

export interface PriceInput {
  gradeFrom: number | null;
  gradeTo: number | null;
  amount: number;
  period: PricePeriod;
  validFrom: string;
  validTo: string | null;
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
  createdAt: Date;
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
  createdAt: p.createdAt.toISOString(),
  state: null,
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
  createdAt: true,
  _count: { select: { paymentPlans: true } },
} as const;

const sameRange = (
  a: { gradeFrom: number | null; gradeTo: number | null },
  b: { gradeFrom: number | null; gradeTo: number | null }
) => a.gradeFrom === b.gradeFrom && a.gradeTo === b.gradeTo;

/** El estado de cada precio el día `on` en Bogotá (ver `PriceState`). */
export function withPriceStates(
  prices: ProgramPriceView[],
  on: Date = new Date()
): ProgramPriceView[] {
  const today = bogotaDate(on);
  const live = (p: ProgramPriceView) =>
    !p.archived && p.validFrom <= today && (p.validTo === null || p.validTo >= today);
  const newer = (a: ProgramPriceView, b: ProgramPriceView) =>
    a.validFrom > b.validFrom || (a.validFrom === b.validFrom && a.createdAt > b.createdAt);
  return prices.map((p) => ({
    ...p,
    state: p.archived
      ? null
      : p.validFrom > today
        ? 'SCHEDULED'
        : p.validTo !== null && p.validTo < today
          ? 'EXPIRED'
          : prices.some((q) => q.id !== p.id && live(q) && sameRange(p, q) && newer(q, p))
            ? 'REPLACED'
            : 'CURRENT',
  }));
}

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
    orderBy: [{ gradeFrom: 'asc' }, { validFrom: 'desc' }, { createdAt: 'desc' }],
    select: PROGRAM_PRICE_SELECT,
  });
  return withPriceStates(prices.map(toProgramPriceView));
}

/**
 * El precio que aplica hoy (día de Bogotá) a una matrícula del programa, para un grado (o sin
 * grado). Con varios candidatos gana el más específico (con rango) y, a igualdad, el más
 * reciente; a igual fecha, el último creado.
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
  // `@db.Date` llega como medianoche UTC: se compara contra el día de Bogotá a esa hora.
  const day = new Date(`${bogotaDate(on)}T00:00:00.000Z`);
  const candidates = await db.programPrice.findMany({
    where: {
      programId,
      archivedAt: null,
      validFrom: { lte: day },
      OR: [{ validTo: null }, { validTo: { gte: day } }],
    },
    orderBy: [{ validFrom: 'desc' }, { createdAt: 'desc' }],
    select: PROGRAM_PRICE_SELECT,
  });
  const applies = candidates.filter((p) => {
    if (p.gradeFrom === null && p.gradeTo === null) return true;
    if (grade === null) return false;
    return (p.gradeFrom ?? -Infinity) <= grade && grade <= (p.gradeTo ?? Infinity);
  });
  const specific = applies.find((p) => p.gradeFrom !== null || p.gradeTo !== null);
  const chosen = specific ?? applies[0];
  return chosen ? { ...toProgramPriceView(chosen), state: 'CURRENT' } : null;
}

function validate(input: PriceInput) {
  if (!Number.isInteger(input.amount) || input.amount <= 0) {
    throw new APIError('El precio tiene que ser un entero mayor que cero', 'VALIDATION_ERROR');
  }
  if (input.gradeFrom !== null && input.gradeTo !== null && input.gradeFrom > input.gradeTo) {
    throw new APIError('El grado inicial no puede ser mayor que el final', 'VALIDATION_ERROR');
  }
  if (input.validTo !== null && input.validTo < input.validFrom) {
    throw new APIError('La vigencia termina antes de empezar', 'VALIDATION_ERROR');
  }
}

const asDate = (day: string) => new Date(`${day}T00:00:00.000Z`);

const snapshot = (p: {
  programId: string;
  gradeFrom: number | null;
  gradeTo: number | null;
  amount: { toNumber(): number };
  period: PricePeriod;
  validFrom: Date;
  validTo: Date | null;
}) => ({
  programId: p.programId,
  gradeFrom: p.gradeFrom,
  gradeTo: p.gradeTo,
  amount: p.amount.toNumber(),
  period: p.period,
  validFrom: dateOnly(p.validFrom),
  validTo: p.validTo ? dateOnly(p.validTo) : null,
});

type Tx = Pick<TenantClient, 'programPrice'>;

/** Dos precios para los mismos grados desde el mismo día: no se sabría cuál cobrar. */
async function assertNoTwin(db: Tx, programId: string, input: PriceInput, exceptId: string | null) {
  const twin = await db.programPrice.findFirst({
    where: {
      programId,
      archivedAt: null,
      gradeFrom: input.gradeFrom,
      gradeTo: input.gradeTo,
      validFrom: asDate(input.validFrom),
      ...(exceptId ? { id: { not: exceptId } } : {}),
    },
    select: { id: true },
  });
  if (twin) {
    throw new APIError(
      'Ya hay un precio para esos grados desde ese día: edítalo o elige otra fecha',
      'CONFLICT'
    );
  }
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
  input: PriceInput;
}): Promise<{ id: string }> {
  validate(input);

  const db = createTenantClient(institutionId);
  const program = await db.program.findFirst({
    where: { id: programId, archivedAt: null },
    select: { id: true, pricing: true },
  });
  if (!program) throw new APIError('Program not found', 'NOT_FOUND');
  if (program.pricing === 'FREE') {
    throw new APIError(
      'Un programa gratuito no lleva precio: márcalo como de pago antes',
      'VALIDATION_ERROR'
    );
  }
  await assertNoTwin(db, programId, input, null);

  return db.$transaction(async (tx) => {
    const price = await tx.programPrice.create({
      data: {
        institutionId,
        programId,
        gradeFrom: input.gradeFrom,
        gradeTo: input.gradeTo,
        amount: input.amount,
        period: input.period,
        validFrom: asDate(input.validFrom),
        validTo: input.validTo ? asDate(input.validTo) : null,
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

/** El precio vivo de ese programa; los que ya usa un plan solo se archivan. */
async function findEditable(
  db: TenantClient,
  programId: string,
  priceId: string,
  verb: 'edita' | 'borra'
) {
  const price = await db.programPrice.findFirst({
    where: { id: priceId, programId, archivedAt: null },
    select: {
      programId: true,
      gradeFrom: true,
      gradeTo: true,
      amount: true,
      period: true,
      validFrom: true,
      validTo: true,
      _count: { select: { paymentPlans: true } },
    },
  });
  if (!price) throw new APIError('Price not found', 'NOT_FOUND');
  if (price._count.paymentPlans > 0) {
    throw new APIError(
      `Este precio ya está en ${price._count.paymentPlans} plan(es) de pagos y no se ${verb}: archívalo y crea uno nuevo desde la fecha en que cambia`,
      'CONFLICT'
    );
  }
  return price;
}

/** Corrige un precio que ningún plan usa (8/10). */
export async function updateProgramPrice({
  institutionId,
  actorId,
  programId,
  priceId,
  input,
}: {
  institutionId: string;
  actorId: string | null;
  programId: string;
  priceId: string;
  input: PriceInput;
}): Promise<{ id: string }> {
  validate(input);
  const db = createTenantClient(institutionId);
  const before = await findEditable(db, programId, priceId, 'edita');
  await assertNoTwin(db, programId, input, priceId);

  await db.$transaction(async (tx) => {
    await tx.programPrice.update({
      where: { id: priceId },
      data: {
        gradeFrom: input.gradeFrom,
        gradeTo: input.gradeTo,
        amount: input.amount,
        period: input.period,
        validFrom: asDate(input.validFrom),
        validTo: input.validTo ? asDate(input.validTo) : null,
      },
    });
    await tx.auditLog.create({
      data: {
        institutionId,
        actorId,
        entity: 'program_price',
        entityId: priceId,
        action: 'updated',
        before: snapshot(before),
        after: { programId, ...input },
      },
    });
  });
  return { id: priceId };
}

/** Borra un precio que ningún plan usa (8/10); queda en la auditoría. */
export async function deleteProgramPrice({
  institutionId,
  actorId,
  programId,
  priceId,
}: {
  institutionId: string;
  actorId: string | null;
  programId: string;
  priceId: string;
}): Promise<{ id: string }> {
  const db = createTenantClient(institutionId);
  const before = await findEditable(db, programId, priceId, 'borra');

  await db.$transaction(async (tx) => {
    await tx.programPrice.delete({ where: { id: priceId } });
    await tx.auditLog.create({
      data: {
        institutionId,
        actorId,
        entity: 'program_price',
        entityId: priceId,
        action: 'deleted',
        before: snapshot(before),
      },
    });
  });
  return { id: priceId };
}

/** Archiva un precio: deja de ofrecerse; los planes que lo referencian lo conservan. */
export async function archiveProgramPrice({
  institutionId,
  actorId,
  programId,
  priceId,
}: {
  institutionId: string;
  actorId: string | null;
  programId: string;
  priceId: string;
}): Promise<{ id: string }> {
  const db = createTenantClient(institutionId);
  const price = await db.programPrice.findFirst({
    where: { id: priceId, programId, archivedAt: null },
    select: {
      programId: true,
      gradeFrom: true,
      gradeTo: true,
      amount: true,
      period: true,
      validFrom: true,
      validTo: true,
    },
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
        before: snapshot(price),
      },
    });
  });
  return { id: priceId };
}
