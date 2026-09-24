/**
 * La cuenta del estudiante (o del acudiente que paga): `/aprender/mi-cuenta`, el checkout de
 * Wompi y el webhook que confirma. SSOT: plan/09-cartera.md §4 y §6, endpoints.md:50-51,101.
 *
 * Quién ve qué: `billing.read.own` con alcance de matrícula (el estudiante adulto que paga)
 * o de aliado (su contacto). Un plan `PARTNER_PAID` no tiene cuenta para el estudiante
 * (endpoints.md:50: 404).
 *
 * El webhook nunca confía en el evento: verifica el checksum, **consulta la transacción** en
 * la API y solo con `APPROVED` y el monto igual al de la cuota registra y confirma el pago
 * (`gatewayRef` único → el evento repetido es no-op). Un monto distinto se registra sin
 * confirmar y se avisa a operación. Siempre 200 tras registrar, para que Wompi no reintente.
 */

import 'server-only';

import type { Scope } from '@colombia-estudia/domain';
import { createTenantClient, prisma } from '@/lib/db/tenant';
import { APIError } from '@/lib/core/errors';
import {
  buildCheckoutUrl,
  buildReference,
  fetchTransaction,
  isWompiConfigured,
  parseReference,
  verifyEventChecksum,
  type WompiEvent,
} from '@/lib/billing/wompi';
import {
  notify,
  notifyMany,
  staffPersonIds,
} from '@/features/notifications/server/notifications.service';
import { getAccount, confirmPayment, type AccountView } from './billing.service';

/** Las matrículas cuya cartera puede ver esta persona con `billing.read.own`. */
export async function listOwnAccounts({
  institutionId,
  scopes,
  now = new Date(),
}: {
  institutionId: string;
  scopes: readonly Scope[];
  now?: Date;
}): Promise<AccountView[]> {
  const enrollmentIds = scopes.flatMap((s) => ('enrollmentId' in s ? [s.enrollmentId] : []));
  const partnerIds = scopes.flatMap((s) => ('partnerId' in s ? [s.partnerId] : []));
  const db = createTenantClient(institutionId);
  const partnerEnrollments = partnerIds.length
    ? await db.paymentPlan.findMany({
        where: { partnerId: { in: partnerIds } },
        select: { enrollmentId: true },
      })
    : [];
  const ids = [...new Set([...enrollmentIds, ...partnerEnrollments.map((p) => p.enrollmentId)])];
  const accounts: AccountView[] = [];
  for (const id of ids) {
    const a = await getAccount({ institutionId, enrollmentId: id, now });
    // Al estudiante, un plan pagado por el aliado no le da `billing.read.own` (capabilities.ts),
    // así que su matrícula ni siquiera llega aquí: decisión 8, resuelta antes.
    if (a && a.plan) accounts.push(a);
  }
  return accounts;
}

/** Crea la URL del Web Checkout para una cuota de una matrícula que la persona puede pagar. */
export async function startCheckout({
  institutionId,
  installmentId,
  scopes,
  origin,
  customerEmail,
  returnPath = '/aprender/mi-cuenta',
}: {
  institutionId: string;
  installmentId: string;
  scopes: readonly Scope[];
  origin: string;
  customerEmail: string | null;
  /** Adónde vuelve Wompi (Fase C, 23/9): el acudiente paga desde `/familia/[enrollmentId]`. */
  returnPath?: string;
}): Promise<{ url: string; reference: string; amount: number }> {
  if (!isWompiConfigured()) {
    throw new APIError('El pago en línea no está habilitado en esta institución', 'CONFLICT');
  }
  const db = createTenantClient(institutionId);
  const i = await db.installment.findFirst({
    where: { id: installmentId },
    select: {
      id: true,
      amount: true,
      status: true,
      payments: { select: { amount: true, confirmedAt: true, voidedAt: true, gatewayRef: true } },
      paymentPlan: { select: { enrollmentId: true, partnerId: true, payerType: true } },
    },
  });
  if (!i) throw new APIError('Not found', 'NOT_FOUND');
  const allowed = scopes.some(
    (s) =>
      ('enrollmentId' in s && s.enrollmentId === i.paymentPlan.enrollmentId) ||
      ('partnerId' in s && s.partnerId === i.paymentPlan.partnerId)
  );
  if (!allowed) throw new APIError('Not found', 'NOT_FOUND');
  if (i.status === 'PAID' || i.status === 'VOID') {
    throw new APIError('Esa cuota no admite pagos', 'CONFLICT');
  }
  const paid = i.payments
    .filter((p) => p.confirmedAt && !p.voidedAt)
    .reduce((s, p) => s + p.amount.toNumber(), 0);
  const pending = i.amount.toNumber() - paid;
  if (pending <= 0) throw new APIError('Esa cuota ya está cubierta', 'CONFLICT');

  // n = intento: cada clic en «Pagar» genera una referencia nueva; Wompi no admite dos
  // transacciones con la misma.
  const attempt = i.payments.filter((p) => p.gatewayRef).length + 1;
  const reference = buildReference(i.id, attempt);
  const url = buildCheckoutUrl({
    reference,
    amountCop: pending,
    redirectUrl: `${origin}${returnPath}?pago=${encodeURIComponent(reference)}`,
    customerEmail,
  });
  return { url, reference, amount: pending };
}

export type WebhookOutcome =
  | 'ignored'
  | 'invalid_signature'
  | 'unknown_reference'
  | 'duplicate'
  | 'confirmed'
  | 'amount_mismatch'
  | 'declined'
  | 'pending';

/**
 * Procesa un evento de Wompi. Sin contexto de petición: el webhook no tiene sesión, y la
 * institución se resuelve por la cuota de la referencia (cliente base + `institutionId`
 * de la fila).
 */
export async function handleWompiEvent(
  event: WompiEvent,
  now = new Date()
): Promise<WebhookOutcome> {
  if (event.event !== 'transaction.updated') return 'ignored';
  if (!verifyEventChecksum(event)) return 'invalid_signature';

  const ref = parseReference(event.data.transaction.reference ?? '');
  if (!ref) return 'unknown_reference';

  const installment = await prisma.installment.findFirst({
    where: { id: ref.installmentId },
    select: {
      id: true,
      institutionId: true,
      amount: true,
      position: true,
      payments: { select: { amount: true, confirmedAt: true, voidedAt: true, gatewayRef: true } },
      paymentPlan: { select: { payerPersonId: true, enrollment: { select: { id: true } } } },
    },
  });
  if (!isRow(installment)) return 'unknown_reference';
  const institutionId = installment.institutionId;
  const db = createTenantClient(institutionId);

  // Lo que dice el evento no vale hasta que la API lo confirme.
  const tx = (await fetchTransaction(event.data.transaction.id)) ?? null;
  if (!tx) return 'pending';

  if (await db.payment.findFirst({ where: { gatewayRef: tx.id }, select: { id: true } }))
    return 'duplicate';

  const paid = installment.payments
    .filter((p) => p.confirmedAt && !p.voidedAt)
    .reduce((s, p) => s + p.amount.toNumber(), 0);
  const pending = installment.amount.toNumber() - paid;
  const amountCop = Math.round(tx.amount_in_cents / 100);
  const payerId = installment.paymentPlan.payerPersonId;

  if (tx.status === 'PENDING') return 'pending';

  if (tx.status !== 'APPROVED') {
    if (payerId) {
      await notify(institutionId, {
        personId: payerId,
        type: 'payment_failed',
        title: 'El pago en línea no se completó',
        body: `Tu pago de la cuota ${installment.position} no se completó (${tx.status}). Puedes intentarlo de nuevo o pagar por transferencia.`,
        href: '/aprender/mi-cuenta',
        dedupeKey: `payment_failed:${tx.id}`,
      });
    }
    return 'declined';
  }

  // APPROVED: se registra siempre; se confirma solo si el monto cuadra con lo pendiente.
  const payment = await db.payment.create({
    data: {
      institutionId,
      installmentId: installment.id,
      amount: amountCop,
      method: 'GATEWAY',
      reference: tx.reference,
      gatewayRef: tx.id,
      paidAt: now,
    },
    select: { id: true },
  });

  if (amountCop !== pending) {
    const ops = await staffPersonIds(institutionId, ['OPERATIONS', 'ADMIN']);
    await notifyMany(institutionId, ops, {
      type: 'payment_failed',
      title: 'Pago en línea con monto distinto',
      body: `Wompi aprobó $${amountCop.toLocaleString('es-CO')} para la cuota ${installment.position}, que tenía pendiente $${pending.toLocaleString('es-CO')}. Quedó registrado sin confirmar: revísalo en cartera.`,
      href: `/cartera/${installment.paymentPlan.enrollment.id}`,
      dedupeKey: `payment_mismatch:${tx.id}`,
    });
    return 'amount_mismatch';
  }

  await confirmPayment({ institutionId, actorId: null, paymentId: payment.id, now });
  return 'confirmed';
}

function isRow<T>(row: T | null): row is T {
  return row !== null;
}
