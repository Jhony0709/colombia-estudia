/**
 * Cartera: planes, cuotas, pagos en dos pasos, anulaciones y acuerdos.
 * SSOT: plan/09-cartera.md, reference/04-business-logic/acceso-y-cartera.md §4–§6,
 * packages/domain/src/account-status.ts, prisma «Cartera».
 *
 * Las reglas que este archivo no negocia:
 * - **el estado de cuenta se deriva, nunca se escribe** (`deriveAccountStatus` con `now`);
 * - **`Installment.status` se recalcula en la misma transacción** que confirma o anula un
 *   pago, y en ningún otro sitio (`deriveInstallmentStatus`);
 * - **un pago se anula, no se borra**; **todo se audita**;
 * - **nada de esto toca lo académico**: aquí no hay ni una lectura de `Enrollment.status`
 *   con intención de cambiarlo. La mora no toca el acceso de un menor (ni de nadie, hasta
 *   la asesoría jurídica).
 *
 * Montos en pesos enteros: `Decimal(12,0)` en la base, `number` aquí, sin centavos. Wompi
 * pide centavos y `lib/billing/wompi.ts` multiplica por cien allí y solo allí.
 */

import 'server-only';

import {
  deriveAccountStatus,
  deriveInstallmentStatus,
  isInstallmentOverdue,
  type AccountStatus,
} from '@colombia-estudia/domain';
import { createTenantClient } from '@/lib/db/tenant';
import { APIError } from '@/lib/core/errors';
import { toCsv } from '@/lib/csv/serialize';
import { notify } from '@/features/notifications/server/notifications.service';

export type { AccountStatus };
export type PayerType = 'PERSON' | 'PARTNER';
export type PaymentMethod = 'TRANSFER' | 'BRE_B' | 'CASH' | 'GATEWAY';
export type Periodicity = 'MONTHLY' | 'BIWEEKLY' | 'WEEKLY';

export const PAYMENT_METHODS: readonly PaymentMethod[] = ['TRANSFER', 'BRE_B', 'CASH', 'GATEWAY'];
export const PERIODICITIES: readonly Periodicity[] = ['MONTHLY', 'BIWEEKLY', 'WEEKLY'];
export const ACCOUNT_STATUSES: readonly AccountStatus[] = [
  'CURRENT',
  'OVERDUE',
  'IN_AGREEMENT',
  'PARTNER_PAID',
];

export interface InstallmentView {
  id: string;
  position: number;
  amount: number;
  paid: number;
  dueOn: string;
  status: 'OPEN' | 'PARTIALLY_PAID' | 'PAID' | 'VOID';
  overdue: boolean;
  agreementId: string | null;
  externalInvoiceRef: string | null;
}

export interface PaymentView {
  id: string;
  installmentId: string;
  installmentPosition: number;
  amount: number;
  method: PaymentMethod;
  reference: string | null;
  gatewayRef: string | null;
  paidAt: string;
  confirmedAt: string | null;
  confirmedByName: string | null;
  voidedAt: string | null;
  voidReason: string | null;
}

export interface AgreementView {
  id: string;
  status: 'ACTIVE' | 'FULFILLED' | 'CANCELLED';
  signedAt: string;
  notes: string | null;
  signerName: string | null;
  installmentIds: string[];
}

export interface AccountView {
  enrollmentId: string;
  student: { id: string; name: string; isMinor: boolean };
  cohort: { id: string; code: string; name: string };
  plan: {
    id: string;
    payerType: PayerType;
    payerName: string | null;
    partnerName: string | null;
    totalAmount: number;
  } | null;
  status: AccountStatus | null;
  installments: InstallmentView[];
  payments: PaymentView[];
  agreements: AgreementView[];
  summary: {
    paid: number;
    pending: number;
    overdue: number;
    next: { id: string; position: number; amount: number; dueOn: string } | null;
  };
}

const n = (d: { toNumber(): number }) => d.toNumber();
const day = (d: Date) => d.toISOString().slice(0, 10);
const fullName = (p: { givenName: string; familyName: string } | null) =>
  p ? `${p.givenName} ${p.familyName}` : null;

const PLAN_SELECT = {
  id: true,
  payerType: true,
  totalAmount: true,
  payerPerson: { select: { id: true, givenName: true, familyName: true, email: true } },
  partner: { select: { id: true, name: true } },
  installments: {
    orderBy: { position: 'asc' as const },
    select: {
      id: true,
      position: true,
      amount: true,
      dueOn: true,
      status: true,
      agreementId: true,
      externalInvoiceRef: true,
      payments: {
        orderBy: { paidAt: 'desc' as const },
        select: {
          id: true,
          amount: true,
          method: true,
          reference: true,
          gatewayRef: true,
          paidAt: true,
          confirmedAt: true,
          confirmedById: true,
          voidedAt: true,
          voidReason: true,
        },
      },
    },
  },
} as const;

type PlanRow = {
  id: string;
  payerType: string;
  totalAmount: { toNumber(): number };
  payerPerson: { id: string; givenName: string; familyName: string; email: string | null } | null;
  partner: { id: string; name: string } | null;
  installments: Array<{
    id: string;
    position: number;
    amount: { toNumber(): number };
    dueOn: Date;
    status: string;
    agreementId: string | null;
    externalInvoiceRef: string | null;
    payments: Array<{
      id: string;
      amount: { toNumber(): number };
      method: string;
      reference: string | null;
      gatewayRef: string | null;
      paidAt: Date;
      confirmedAt: Date | null;
      confirmedById: string | null;
      voidedAt: Date | null;
      voidReason: string | null;
    }>;
  }>;
};

/** Lo que `deriveAccountStatus` necesita, desde una fila de plan. */
function domainInputs(plan: PlanRow) {
  const installments = plan.installments.map((i) => ({
    id: i.id,
    position: i.position,
    amount: n(i.amount),
    dueOn: i.dueOn,
    status: i.status as 'OPEN' | 'PARTIALLY_PAID' | 'PAID' | 'VOID',
    agreementId: i.agreementId,
  }));
  const payments = plan.installments.flatMap((i) =>
    i.payments.map((p) => ({
      installmentId: i.id,
      amount: n(p.amount),
      confirmedAt: p.confirmedAt,
      voidedAt: p.voidedAt,
    }))
  );
  return { installments, payments };
}

export function statusOf(
  plan: PlanRow,
  agreements: Array<{ id: string; enrollmentId: string; status: string }>,
  now: Date
): AccountStatus {
  const { installments, payments } = domainInputs(plan);
  return deriveAccountStatus({
    payerType: plan.payerType as PayerType,
    installments,
    payments,
    agreements: agreements.map((a) => ({
      id: a.id,
      enrollmentId: a.enrollmentId,
      status: a.status as 'ACTIVE' | 'FULFILLED' | 'CANCELLED',
    })),
    now,
  });
}

// ─────────────────────────── consulta ───────────────────────────

export async function getAccount({
  institutionId,
  enrollmentId,
  now = new Date(),
}: {
  institutionId: string;
  enrollmentId: string;
  now?: Date;
}): Promise<AccountView | null> {
  const db = createTenantClient(institutionId);
  const e = await db.enrollment.findFirst({
    where: { id: enrollmentId },
    select: {
      id: true,
      isMinorAtEnrollment: true,
      student: { select: { id: true, givenName: true, familyName: true } },
      cohort: { select: { id: true, code: true, name: true } },
      paymentPlan: { select: PLAN_SELECT },
      paymentAgreements: {
        orderBy: { signedAt: 'desc' },
        select: {
          id: true,
          enrollmentId: true,
          status: true,
          signedAt: true,
          notes: true,
          payerPerson: { select: { givenName: true, familyName: true } },
          partner: { select: { name: true } },
          installments: { select: { id: true } },
        },
      },
    },
  });
  if (!e) return null;

  const plan = e.paymentPlan;
  const confirmerIds = plan
    ? [
        ...new Set(
          plan.installments
            .flatMap((i) => i.payments.map((p) => p.confirmedById))
            .filter((x): x is string => !!x)
        ),
      ]
    : [];
  const confirmers = confirmerIds.length
    ? await db.person.findMany({
        where: { id: { in: confirmerIds } },
        select: { id: true, givenName: true, familyName: true },
      })
    : [];
  const confirmerName = new Map(confirmers.map((p) => [p.id, `${p.givenName} ${p.familyName}`]));

  const installments: InstallmentView[] = plan
    ? plan.installments.map((i) => {
        const paid = i.payments
          .filter((p) => p.confirmedAt && !p.voidedAt)
          .reduce((sum, p) => sum + n(p.amount), 0);
        return {
          id: i.id,
          position: i.position,
          amount: n(i.amount),
          paid,
          dueOn: day(i.dueOn),
          status: i.status as InstallmentView['status'],
          overdue: isInstallmentOverdue(
            {
              id: i.id,
              position: i.position,
              amount: n(i.amount),
              dueOn: i.dueOn,
              status: i.status as InstallmentView['status'],
              agreementId: i.agreementId,
            },
            now
          ),
          agreementId: i.agreementId,
          externalInvoiceRef: i.externalInvoiceRef,
        };
      })
    : [];

  const payments: PaymentView[] = plan
    ? plan.installments
        .flatMap((i) =>
          i.payments.map((p) => ({
            id: p.id,
            installmentId: i.id,
            installmentPosition: i.position,
            amount: n(p.amount),
            method: p.method as PaymentMethod,
            reference: p.reference,
            gatewayRef: p.gatewayRef,
            paidAt: p.paidAt.toISOString(),
            confirmedAt: p.confirmedAt ? p.confirmedAt.toISOString() : null,
            confirmedByName: p.confirmedById ? (confirmerName.get(p.confirmedById) ?? null) : null,
            voidedAt: p.voidedAt ? p.voidedAt.toISOString() : null,
            voidReason: p.voidReason,
          }))
        )
        .sort((a, b) => b.paidAt.localeCompare(a.paidAt))
    : [];

  const live = installments.filter((i) => i.status !== 'VOID');
  const paidTotal = live.reduce((s, i) => s + Math.min(i.paid, i.amount), 0);
  const pending = live.reduce((s, i) => s + Math.max(0, i.amount - i.paid), 0);
  const overdue = live
    .filter((i) => i.overdue)
    .reduce((s, i) => s + Math.max(0, i.amount - i.paid), 0);
  const next = live.find((i) => i.status !== 'PAID') ?? null;

  return {
    enrollmentId: e.id,
    student: {
      id: e.student.id,
      name: `${e.student.givenName} ${e.student.familyName}`,
      isMinor: e.isMinorAtEnrollment,
    },
    cohort: e.cohort,
    plan: plan
      ? {
          id: plan.id,
          payerType: plan.payerType as PayerType,
          payerName: fullName(plan.payerPerson),
          partnerName: plan.partner?.name ?? null,
          totalAmount: n(plan.totalAmount),
        }
      : null,
    status: plan ? statusOf(plan, e.paymentAgreements, now) : null,
    installments,
    payments,
    agreements: e.paymentAgreements.map((a) => ({
      id: a.id,
      status: a.status as AgreementView['status'],
      signedAt: a.signedAt.toISOString(),
      notes: a.notes,
      signerName: fullName(a.payerPerson) ?? a.partner?.name ?? null,
      installmentIds: a.installments.map((i) => i.id),
    })),
    summary: {
      paid: paidTotal,
      pending,
      overdue,
      next: next
        ? { id: next.id, position: next.position, amount: next.amount, dueOn: next.dueOn }
        : null,
    },
  };
}

export interface BillingRow {
  enrollmentId: string;
  personId: string;
  name: string;
  cohortId: string;
  cohortCode: string;
  partnerName: string | null;
  payerType: PayerType | null;
  status: AccountStatus | null;
  total: number;
  paid: number;
  overdue: number;
  nextDueOn: string | null;
  /** Lo que falta por pagar de la próxima cuota (monto menos abonos). */
  nextAmount: number | null;
  hasAgreement: boolean;
}

export interface BillingFilters {
  cohortId: string | null;
  partnerId: string | null;
  status: AccountStatus | 'NO_PLAN' | null;
  q: string;
}

export async function listBilling({
  institutionId,
  filters,
  now = new Date(),
}: {
  institutionId: string;
  filters: BillingFilters;
  now?: Date;
}): Promise<BillingRow[]> {
  const db = createTenantClient(institutionId);
  const rows = await db.enrollment.findMany({
    where: {
      ...(filters.cohortId ? { cohortId: filters.cohortId } : {}),
      ...(filters.partnerId ? { paymentPlan: { partnerId: filters.partnerId } } : {}),
      ...(filters.q
        ? {
            student: {
              OR: [
                { givenName: { contains: filters.q, mode: 'insensitive' } },
                { familyName: { contains: filters.q, mode: 'insensitive' } },
                { documentNumber: { contains: filters.q } },
              ],
            },
          }
        : {}),
    },
    orderBy: [{ cohort: { code: 'asc' } }, { student: { familyName: 'asc' } }],
    select: {
      id: true,
      student: { select: { id: true, givenName: true, familyName: true } },
      cohort: { select: { id: true, code: true } },
      paymentPlan: { select: PLAN_SELECT },
      paymentAgreements: { select: { id: true, enrollmentId: true, status: true } },
    },
  });

  const out: BillingRow[] = rows.map((e) => {
    const plan = e.paymentPlan;
    if (!plan) {
      return {
        enrollmentId: e.id,
        personId: e.student.id,
        name: `${e.student.familyName}, ${e.student.givenName}`,
        cohortId: e.cohort.id,
        cohortCode: e.cohort.code,
        partnerName: null,
        payerType: null,
        status: null,
        total: 0,
        paid: 0,
        overdue: 0,
        nextDueOn: null,
        nextAmount: null,
        hasAgreement: false,
      };
    }
    const live = plan.installments.filter((i) => i.status !== 'VOID');
    const paidOf = (i: (typeof live)[number]) =>
      i.payments.filter((p) => p.confirmedAt && !p.voidedAt).reduce((s, p) => s + n(p.amount), 0);
    const overdue = live
      .filter((i) =>
        isInstallmentOverdue(
          {
            id: i.id,
            position: i.position,
            amount: n(i.amount),
            dueOn: i.dueOn,
            status: i.status as InstallmentView['status'],
            agreementId: i.agreementId,
          },
          now
        )
      )
      .reduce((s, i) => s + Math.max(0, n(i.amount) - paidOf(i)), 0);
    const next = live.find((i) => i.status !== 'PAID') ?? null;
    return {
      enrollmentId: e.id,
      personId: e.student.id,
      name: `${e.student.familyName}, ${e.student.givenName}`,
      cohortId: e.cohort.id,
      cohortCode: e.cohort.code,
      partnerName: plan.partner?.name ?? null,
      payerType: plan.payerType as PayerType,
      status: statusOf(plan, e.paymentAgreements, now),
      total: n(plan.totalAmount),
      paid: live.reduce((s, i) => s + Math.min(paidOf(i), n(i.amount)), 0),
      overdue,
      nextDueOn: next ? day(next.dueOn) : null,
      // Lo que falta de esa cuota, no su monto nominal: con un abono parcial, «$ 300.000»
      // era mentira (23/9, visto en /cartera con la cuota de IVY-2026-1).
      nextAmount: next ? Math.max(0, n(next.amount) - paidOf(next)) : null,
      hasAgreement: e.paymentAgreements.some((a) => a.status === 'ACTIVE'),
    };
  });

  return out.filter((r) =>
    filters.status === null
      ? true
      : filters.status === 'NO_PLAN'
        ? r.status === null
        : r.status === filters.status
  );
}

export function billingCsv(rows: BillingRow[]): string {
  return toCsv(
    [
      'estudiante',
      'cohorte',
      'pagador',
      'estado',
      'total',
      'pagado',
      'vencido',
      'proxima_cuota',
      'proximo_monto',
      'acuerdo_vigente',
    ],
    rows.map((r) => [
      r.name,
      r.cohortCode,
      r.payerType === 'PARTNER'
        ? (r.partnerName ?? 'aliado')
        : r.payerType === 'PERSON'
          ? 'persona'
          : '',
      r.status ?? 'SIN_PLAN',
      String(r.total),
      String(r.paid),
      String(r.overdue),
      r.nextDueOn ?? '',
      r.nextAmount === null ? '' : String(r.nextAmount),
      r.hasAgreement ? 'si' : 'no',
    ])
  );
}

// ─────────────────────────── planes y cuotas ───────────────────────────

/** Reparte `total` en `count` cuotas enteras; el resto va a la última. */
export function splitAmount(total: number, count: number): number[] {
  const base = Math.floor(total / count);
  const remainder = total - base * count;
  return Array.from({ length: count }, (_, i) => (i === count - 1 ? base + remainder : base));
}

/** Fechas de vencimiento desde la primera, sumando un periodo cada vez (en UTC, `@db.Date`). */
export function scheduleDates(first: Date, count: number, periodicity: Periodicity): Date[] {
  const out: Date[] = [];
  for (let i = 0; i < count; i++) {
    const d = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth(), first.getUTCDate()));
    if (periodicity === 'MONTHLY') d.setUTCMonth(d.getUTCMonth() + i);
    else d.setUTCDate(d.getUTCDate() + i * (periodicity === 'BIWEEKLY' ? 14 : 7));
    out.push(d);
  }
  return out;
}

export interface CreatePlanInput {
  payerType: PayerType;
  payerPersonId: string | null;
  partnerId: string | null;
  totalAmount: number;
  installments: number;
  firstDueOn: Date;
  periodicity: Periodicity;
}

/**
 * Crea el plan de una matrícula (o de todas las de una cohorte de aliado). Una matrícula
 * que ya tiene plan se salta: no hay dos planes para una matrícula (`@unique`).
 */
export async function createPaymentPlans({
  institutionId,
  actorId,
  enrollmentIds,
  input,
  now = new Date(),
}: {
  institutionId: string;
  actorId: string;
  enrollmentIds: string[];
  input: CreatePlanInput;
  now?: Date;
}): Promise<{ created: number; skipped: number }> {
  if (input.totalAmount <= 0)
    throw new APIError('El total tiene que ser mayor que cero', 'VALIDATION_ERROR');
  if (input.installments < 1 || input.installments > 36) {
    throw new APIError('Entre 1 y 36 cuotas', 'VALIDATION_ERROR');
  }
  if (input.payerType === 'PARTNER' && !input.partnerId) {
    throw new APIError('Un plan pagado por un aliado necesita el aliado', 'VALIDATION_ERROR');
  }
  if (input.payerType === 'PERSON' && input.partnerId) {
    throw new APIError('Un plan pagado por una persona no lleva aliado', 'VALIDATION_ERROR');
  }

  const db = createTenantClient(institutionId);
  const enrollments = await db.enrollment.findMany({
    where: { id: { in: enrollmentIds } },
    select: {
      id: true,
      studentId: true,
      isMinorAtEnrollment: true,
      paymentPlan: { select: { id: true } },
    },
  });
  if (enrollments.length === 0) throw new APIError('Not found', 'NOT_FOUND');

  if (input.partnerId) {
    const partner = await db.partner.findFirst({
      where: { id: input.partnerId },
      select: { id: true },
    });
    if (!partner) throw new APIError('El aliado no existe', 'VALIDATION_ERROR');
  }
  if (input.payerPersonId) {
    const payer = await db.person.findFirst({
      where: { id: input.payerPersonId },
      select: { id: true },
    });
    if (!payer) throw new APIError('El pagador no existe', 'VALIDATION_ERROR');
  }

  const amounts = splitAmount(input.totalAmount, input.installments);
  const dates = scheduleDates(input.firstDueOn, input.installments, input.periodicity);

  let created = 0;
  let skipped = 0;
  for (const e of enrollments) {
    if (e.paymentPlan) {
      skipped++;
      continue;
    }
    // El pagador por defecto de un plan PERSON es el estudiante adulto; para un menor hay
    // que decir quién (acudiente), y si no se dice queda sin pagador hasta que se edite.
    const payerPersonId =
      input.payerType === 'PERSON'
        ? (input.payerPersonId ?? (e.isMinorAtEnrollment ? null : e.studentId))
        : null;
    await db.$transaction(async (tx) => {
      const plan = await tx.paymentPlan.create({
        data: {
          institutionId,
          enrollmentId: e.id,
          payerType: input.payerType,
          payerPersonId,
          partnerId: input.partnerId,
          totalAmount: input.totalAmount,
          installments: {
            create: amounts.map((amount, i) => ({
              institutionId,
              position: i + 1,
              amount,
              dueOn: dates[i]!,
              status: 'OPEN',
            })),
          },
        },
        select: { id: true },
      });
      await tx.auditLog.create({
        data: {
          institutionId,
          actorId,
          entity: 'payment',
          entityId: plan.id,
          action: 'plan_created',
          after: {
            enrollmentId: e.id,
            payerType: input.payerType,
            totalAmount: input.totalAmount,
            installments: input.installments,
            periodicity: input.periodicity,
          },
          occurredAt: now,
        },
      });
    });
    created++;
  }
  return { created, skipped };
}

/** Solo montos y fechas de cuotas sin pagos; las pagadas o abonadas no se tocan. Audita. */
export async function updateInstallment({
  institutionId,
  actorId,
  installmentId,
  amount,
  dueOn,
  now = new Date(),
}: {
  institutionId: string;
  actorId: string;
  installmentId: string;
  amount?: number;
  dueOn?: Date;
  now?: Date;
}): Promise<InstallmentView> {
  const db = createTenantClient(institutionId);
  const i = await db.installment.findFirst({
    where: { id: installmentId },
    select: {
      id: true,
      position: true,
      amount: true,
      dueOn: true,
      status: true,
      agreementId: true,
      externalInvoiceRef: true,
    },
  });
  if (!i) throw new APIError('Not found', 'NOT_FOUND');
  if (i.status !== 'OPEN') {
    throw new APIError('Solo se editan cuotas sin pagos', 'CONFLICT');
  }
  if (amount !== undefined && amount <= 0) {
    throw new APIError('El monto tiene que ser mayor que cero', 'VALIDATION_ERROR');
  }
  const updated = await db.$transaction(async (tx) => {
    const row = await tx.installment.update({
      where: { id: i.id },
      data: {
        ...(amount !== undefined ? { amount } : {}),
        ...(dueOn !== undefined ? { dueOn } : {}),
      },
      select: {
        id: true,
        position: true,
        amount: true,
        dueOn: true,
        status: true,
        agreementId: true,
        externalInvoiceRef: true,
      },
    });
    await tx.auditLog.create({
      data: {
        institutionId,
        actorId,
        entity: 'payment',
        entityId: i.id,
        action: 'installment_updated',
        before: { amount: n(i.amount), dueOn: day(i.dueOn) },
        after: { amount: n(row.amount), dueOn: day(row.dueOn) },
        occurredAt: now,
      },
    });
    return row;
  });
  return {
    id: updated.id,
    position: updated.position,
    amount: n(updated.amount),
    paid: 0,
    dueOn: day(updated.dueOn),
    status: updated.status as InstallmentView['status'],
    overdue: isInstallmentOverdue(
      {
        id: updated.id,
        position: updated.position,
        amount: n(updated.amount),
        dueOn: updated.dueOn,
        status: updated.status as InstallmentView['status'],
        agreementId: updated.agreementId,
      },
      now
    ),
    agreementId: updated.agreementId,
    externalInvoiceRef: updated.externalInvoiceRef,
  };
}

// ─────────────────────────── pagos en dos pasos ───────────────────────────

export interface PaymentSummary {
  paymentId: string;
  amount: number;
  method: PaymentMethod;
  reference: string | null;
  paidAt: string;
  installment: {
    id: string;
    position: number;
    amount: number;
    dueOn: string;
    pendingBefore: number;
  };
  studentName: string;
}

/** Paso 1: registra sin confirmar y devuelve el resumen que la pantalla enseña antes de confirmar. */
export async function registerPayment({
  institutionId,
  installmentId,
  amount,
  method,
  reference,
  paidAt,
}: {
  institutionId: string;
  installmentId: string;
  amount: number;
  method: PaymentMethod;
  reference: string | null;
  paidAt: Date;
}): Promise<PaymentSummary> {
  if (amount <= 0) throw new APIError('El monto tiene que ser mayor que cero', 'VALIDATION_ERROR');
  if (method === 'GATEWAY') {
    throw new APIError('Los pagos por pasarela los registra el webhook', 'VALIDATION_ERROR');
  }
  const db = createTenantClient(institutionId);
  const i = await db.installment.findFirst({
    where: { id: installmentId },
    select: {
      id: true,
      position: true,
      amount: true,
      dueOn: true,
      status: true,
      payments: { select: { amount: true, confirmedAt: true, voidedAt: true } },
      paymentPlan: {
        select: {
          enrollment: { select: { student: { select: { givenName: true, familyName: true } } } },
        },
      },
    },
  });
  if (!i) throw new APIError('Not found', 'NOT_FOUND');
  if (i.status === 'VOID') throw new APIError('Esa cuota fue anulada por un acuerdo', 'CONFLICT');
  if (i.status === 'PAID') throw new APIError('Esa cuota ya está pagada', 'CONFLICT');

  const paid = i.payments
    .filter((p) => p.confirmedAt && !p.voidedAt)
    .reduce((s, p) => s + n(p.amount), 0);
  const payment = await db.payment.create({
    data: { institutionId, installmentId: i.id, amount, method, reference, paidAt },
    select: { id: true },
  });
  return {
    paymentId: payment.id,
    amount,
    method,
    reference,
    paidAt: paidAt.toISOString(),
    installment: {
      id: i.id,
      position: i.position,
      amount: n(i.amount),
      dueOn: day(i.dueOn),
      pendingBefore: Math.max(0, n(i.amount) - paid),
    },
    studentName: `${i.paymentPlan.enrollment.student.givenName} ${i.paymentPlan.enrollment.student.familyName}`,
  };
}

/**
 * Recalcula `Installment.status` con los pagos confirmados. **Solo** se llama dentro de la
 * transacción que confirma o anula un pago (acceso-y-cartera.md §4).
 */
type Tx = Omit<
  ReturnType<typeof createTenantClient>,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;

async function recalcInstallment(
  tx: Tx,
  installmentId: string
): Promise<'OPEN' | 'PARTIALLY_PAID' | 'PAID'> {
  const row = await tx.installment.findUniqueOrThrow({
    where: { id: installmentId },
    select: {
      amount: true,
      status: true,
      payments: { select: { amount: true, confirmedAt: true, voidedAt: true } },
    },
  });
  if (row.status === 'VOID') throw new APIError('La cuota está anulada', 'CONFLICT');
  const status = deriveInstallmentStatus({
    amount: n(row.amount),
    payments: row.payments.map((p) => ({
      installmentId,
      amount: n(p.amount),
      confirmedAt: p.confirmedAt,
      voidedAt: p.voidedAt,
    })),
  });
  await tx.installment.update({ where: { id: installmentId }, data: { status } });
  return status;
}

/**
 * Paso 2: confirma. Transacción serializable: dos confirmaciones en paralelo del mismo pago
 * dejan una (`confirmedAt` ya puesto → CONFLICT en la segunda). Recalcula la cuota, audita
 * y avisa al pagador.
 */
export async function confirmPayment({
  institutionId,
  actorId,
  paymentId,
  now = new Date(),
}: {
  institutionId: string;
  actorId: string | null;
  paymentId: string;
  now?: Date;
}): Promise<{ paymentId: string; installmentStatus: string; accountStatus: AccountStatus }> {
  const db = createTenantClient(institutionId);

  const result = await db.$transaction(
    async (tx) => {
      const p = await tx.payment.findFirst({
        where: { id: paymentId },
        select: { id: true, amount: true, confirmedAt: true, voidedAt: true, installmentId: true },
      });
      if (!p) throw new APIError('Not found', 'NOT_FOUND');
      if (p.voidedAt) throw new APIError('El pago está anulado', 'CONFLICT');
      if (p.confirmedAt) throw new APIError('El pago ya estaba confirmado', 'CONFLICT');

      await tx.payment.update({
        where: { id: p.id },
        data: { confirmedAt: now, confirmedById: actorId },
      });
      const installmentStatus = await recalcInstallment(tx, p.installmentId);
      await tx.auditLog.create({
        data: {
          institutionId,
          actorId,
          entity: 'payment',
          entityId: p.id,
          action: 'confirmed',
          after: { amount: n(p.amount), installmentId: p.installmentId, installmentStatus },
          occurredAt: now,
        },
      });
      return { installmentId: p.installmentId, amount: n(p.amount), installmentStatus };
    },
    { isolationLevel: 'Serializable' }
  );

  // Estado derivado y aviso, fuera de la transacción: leer no necesita el candado.
  const installment = await db.installment.findFirstOrThrow({
    where: { id: result.installmentId },
    select: {
      position: true,
      paymentPlan: {
        select: {
          payerPersonId: true,
          enrollment: {
            select: {
              id: true,
              paymentPlan: { select: PLAN_SELECT },
              paymentAgreements: { select: { id: true, enrollmentId: true, status: true } },
            },
          },
        },
      },
    },
  });
  const e = installment.paymentPlan.enrollment;
  const accountStatus = e.paymentPlan
    ? statusOf(e.paymentPlan, e.paymentAgreements, now)
    : 'CURRENT';

  // Un acuerdo con todas sus cuotas pagadas queda cumplido aquí mismo, no solo en el job.
  await settleAgreements({ institutionId, enrollmentId: e.id, now });

  if (installment.paymentPlan.payerPersonId) {
    await notify(institutionId, {
      personId: installment.paymentPlan.payerPersonId,
      type: 'payment_confirmed',
      title: 'Pago confirmado',
      body: `Registramos tu pago de $${result.amount.toLocaleString('es-CO')} a la cuota ${installment.position}. Gracias.`,
      href: '/aprender/mi-cuenta',
      dedupeKey: `payment_confirmed:${paymentId}`,
    });
  }

  return { paymentId, installmentStatus: result.installmentStatus, accountStatus };
}

/** Anula con motivo. Nunca se borra. Recalcula la cuota en la misma transacción. */
export async function voidPayment({
  institutionId,
  actorId,
  paymentId,
  reason,
  now = new Date(),
}: {
  institutionId: string;
  actorId: string;
  paymentId: string;
  reason: string;
  now?: Date;
}): Promise<{ paymentId: string; installmentStatus: string }> {
  const db = createTenantClient(institutionId);
  return db.$transaction(
    async (tx) => {
      const p = await tx.payment.findFirst({
        where: { id: paymentId },
        select: { id: true, amount: true, confirmedAt: true, voidedAt: true, installmentId: true },
      });
      if (!p) throw new APIError('Not found', 'NOT_FOUND');
      if (p.voidedAt) throw new APIError('El pago ya estaba anulado', 'CONFLICT');

      await tx.payment.update({
        where: { id: p.id },
        data: { voidedAt: now, voidedById: actorId, voidReason: reason },
      });
      // Un pago sin confirmar que se anula no cambia la cuota, pero recalcular es inocuo y
      // deja una sola forma de hacerlo.
      const installmentStatus = await recalcInstallment(tx, p.installmentId);
      await tx.auditLog.create({
        data: {
          institutionId,
          actorId,
          entity: 'payment',
          entityId: p.id,
          action: 'voided',
          before: { confirmed: p.confirmedAt !== null },
          after: { reason, installmentStatus },
          occurredAt: now,
        },
      });
      return { paymentId: p.id, installmentStatus };
    },
    { isolationLevel: 'Serializable' }
  );
}

// ─────────────────────────── acuerdos ───────────────────────────

export interface AgreementInstallmentInput {
  amount: number;
  dueOn: Date;
}

export interface AgreementPreview {
  enrollmentId: string;
  studentName: string;
  /** Cuotas pendientes que pasarán a VOID, con lo que les faltaba. */
  voided: Array<{ id: string; position: number; pending: number; dueOn: string }>;
  pendingTotal: number;
  /** Las cuotas nuevas, ya numeradas a continuación del plan. */
  created: Array<{ position: number; amount: number; dueOn: string }>;
  newTotal: number;
  /** La suma de las nuevas tiene que cubrir lo pendiente; si no, se dice y no se firma. */
  covers: boolean;
}

export async function previewAgreement({
  institutionId,
  enrollmentId,
  installments,
}: {
  institutionId: string;
  enrollmentId: string;
  installments: AgreementInstallmentInput[];
}): Promise<AgreementPreview> {
  if (installments.length === 0 || installments.length > 36) {
    throw new APIError('Entre 1 y 36 cuotas', 'VALIDATION_ERROR');
  }
  if (installments.some((i) => i.amount <= 0)) {
    throw new APIError('Cada cuota tiene que ser mayor que cero', 'VALIDATION_ERROR');
  }
  const db = createTenantClient(institutionId);
  const e = await db.enrollment.findFirst({
    where: { id: enrollmentId },
    select: {
      id: true,
      student: { select: { givenName: true, familyName: true } },
      paymentPlan: { select: PLAN_SELECT },
      paymentAgreements: { where: { status: 'ACTIVE' }, select: { id: true } },
    },
  });
  if (!e) throw new APIError('Not found', 'NOT_FOUND');
  if (!e.paymentPlan) throw new APIError('La matrícula no tiene plan de pagos', 'CONFLICT');
  if (e.paymentAgreements.length > 0) {
    throw new APIError('Ya hay un acuerdo vigente; cancélalo antes de firmar otro', 'CONFLICT');
  }

  const pending = e.paymentPlan.installments
    .filter((i) => i.status === 'OPEN' || i.status === 'PARTIALLY_PAID')
    .map((i) => {
      const paid = i.payments
        .filter((p) => p.confirmedAt && !p.voidedAt)
        .reduce((s, p) => s + n(p.amount), 0);
      return {
        id: i.id,
        position: i.position,
        pending: Math.max(0, n(i.amount) - paid),
        dueOn: day(i.dueOn),
      };
    });
  if (pending.length === 0) throw new APIError('No hay cuotas pendientes que acordar', 'CONFLICT');

  const pendingTotal = pending.reduce((s, i) => s + i.pending, 0);
  const lastPosition = Math.max(...e.paymentPlan.installments.map((i) => i.position));
  const sorted = [...installments].sort((a, b) => a.dueOn.getTime() - b.dueOn.getTime());
  const created = sorted.map((i, idx) => ({
    position: lastPosition + idx + 1,
    amount: i.amount,
    dueOn: day(i.dueOn),
  }));
  const newTotal = created.reduce((s, i) => s + i.amount, 0);

  return {
    enrollmentId: e.id,
    studentName: `${e.student.givenName} ${e.student.familyName}`,
    voided: pending,
    pendingTotal,
    created,
    newTotal,
    covers: newTotal >= pendingTotal,
  };
}

/** Firma: anula las pendientes, crea las nuevas con `agreementId`, `ACTIVE`, audita, avisa. */
export async function signAgreement({
  institutionId,
  actorId,
  enrollmentId,
  installments,
  signerPersonId,
  partnerId,
  notes,
  now = new Date(),
}: {
  institutionId: string;
  actorId: string;
  enrollmentId: string;
  installments: AgreementInstallmentInput[];
  signerPersonId: string | null;
  partnerId: string | null;
  notes: string | null;
  now?: Date;
}): Promise<{ agreementId: string }> {
  const preview = await previewAgreement({ institutionId, enrollmentId, installments });
  if (!preview.covers) {
    throw new APIError('Las cuotas del acuerdo no cubren lo pendiente', 'VALIDATION_ERROR');
  }
  const db = createTenantClient(institutionId);
  const plan = await db.paymentPlan.findFirstOrThrow({
    where: { enrollmentId },
    select: { id: true, payerPersonId: true, partnerId: true },
  });
  const payerPersonId = signerPersonId ?? plan.payerPersonId;
  const agreementPartnerId = partnerId ?? plan.partnerId;

  const agreementId = await db.$transaction(
    async (tx) => {
      const agreement = await tx.paymentAgreement.create({
        data: {
          institutionId,
          enrollmentId,
          payerPersonId,
          partnerId: agreementPartnerId,
          status: 'ACTIVE',
          signedAt: now,
          notes,
        },
        select: { id: true },
      });
      await tx.installment.updateMany({
        where: { id: { in: preview.voided.map((v) => v.id) } },
        data: { status: 'VOID' },
      });
      await tx.installment.createMany({
        data: preview.created.map((c) => ({
          institutionId,
          paymentPlanId: plan.id,
          agreementId: agreement.id,
          position: c.position,
          amount: c.amount,
          dueOn: new Date(`${c.dueOn}T00:00:00.000Z`),
          status: 'OPEN',
        })),
      });
      await tx.auditLog.create({
        data: {
          institutionId,
          actorId,
          entity: 'agreement',
          entityId: agreement.id,
          action: 'signed',
          after: {
            enrollmentId,
            voided: preview.voided.map((v) => v.id),
            created: preview.created,
            pendingTotal: preview.pendingTotal,
            newTotal: preview.newTotal,
          },
          occurredAt: now,
        },
      });
      return agreement.id;
    },
    { isolationLevel: 'Serializable' }
  );

  if (payerPersonId) {
    await notify(institutionId, {
      personId: payerPersonId,
      type: 'agreement_signed',
      title: 'Acuerdo de pago registrado',
      body: `Tu acuerdo de pago quedó registrado con ${preview.created.length} cuotas nuevas. Puedes verlas en «Mi cuenta».`,
      href: '/aprender/mi-cuenta',
      dedupeKey: `agreement_signed:${agreementId}`,
    });
  }
  return { agreementId };
}

/** Cancela un acuerdo (cobro externo / incumplimiento): audita; las cuotas del acuerdo siguen vivas. */
export async function cancelAgreement({
  institutionId,
  actorId,
  agreementId,
  reason,
  now = new Date(),
}: {
  institutionId: string;
  actorId: string;
  agreementId: string;
  reason: string;
  now?: Date;
}): Promise<void> {
  const db = createTenantClient(institutionId);
  const a = await db.paymentAgreement.findFirst({
    where: { id: agreementId },
    select: { id: true, status: true, notes: true },
  });
  if (!a) throw new APIError('Not found', 'NOT_FOUND');
  if (a.status !== 'ACTIVE') throw new APIError('El acuerdo no está vigente', 'CONFLICT');
  await db.$transaction(async (tx) => {
    await tx.paymentAgreement.update({
      where: { id: a.id },
      data: {
        status: 'CANCELLED',
        notes: [a.notes, `Cancelado: ${reason}`].filter(Boolean).join('\n'),
      },
    });
    await tx.auditLog.create({
      data: {
        institutionId,
        actorId,
        entity: 'agreement',
        entityId: a.id,
        action: 'cancelled',
        after: { reason },
        occurredAt: now,
      },
    });
  });
}

/** `FULFILLED` cuando todas las cuotas del acuerdo están `PAID`. Lo llama el job y `confirmPayment`. */
export async function settleAgreements({
  institutionId,
  enrollmentId,
  now = new Date(),
}: {
  institutionId: string;
  enrollmentId?: string;
  now?: Date;
}): Promise<number> {
  const db = createTenantClient(institutionId);
  const active = await db.paymentAgreement.findMany({
    where: { status: 'ACTIVE', ...(enrollmentId ? { enrollmentId } : {}) },
    select: { id: true, installments: { select: { status: true } } },
  });
  let fulfilled = 0;
  for (const a of active) {
    if (a.installments.length === 0 || !a.installments.every((i) => i.status === 'PAID')) continue;
    await db.$transaction(async (tx) => {
      await tx.paymentAgreement.update({ where: { id: a.id }, data: { status: 'FULFILLED' } });
      await tx.auditLog.create({
        data: {
          institutionId,
          actorId: null,
          entity: 'agreement',
          entityId: a.id,
          action: 'fulfilled',
          occurredAt: now,
        },
      });
    });
    fulfilled++;
  }
  return fulfilled;
}

export async function activeEnrollmentIdsOfCohort({
  institutionId,
  cohortId,
}: {
  institutionId: string;
  cohortId: string;
}): Promise<string[]> {
  const db = createTenantClient(institutionId);
  const rows = await db.enrollment.findMany({
    where: { cohortId, status: 'ACTIVE' },
    select: { id: true },
  });
  return rows.map((r) => r.id);
}
