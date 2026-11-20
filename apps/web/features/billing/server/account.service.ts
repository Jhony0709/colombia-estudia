/**
 * La cuenta del estudiante (o del acudiente que paga): `/aprender/mi-cuenta`, el link de pago
 * de Bold y el webhook que confirma. SSOT: plan/09-cartera.md §4 y §6, endpoints.md:50-51,101.
 *
 * Quién ve qué: `billing.read.own` con alcance de matrícula (el estudiante adulto que paga)
 * o de aliado (su contacto). Un plan `PARTNER_PAID` no tiene cuenta para el estudiante
 * (endpoints.md:50: 404).
 *
 * Cada link queda en `PaymentLink` (19/11). Un pago solo se da por hecho cuando **Bold dice que
 * el link está pagado** (`fetchPaymentLink`): el webhook firmado, la vuelta del pago (`?pago=`) y
 * el job diario son tres avisos para ir a preguntarlo, y el paso del link a `PAID` hace que el
 * pago se registre una sola vez. Con el monto igual a lo pendiente se confirma; con otro monto
 * queda sin confirmar y se avisa a operación.
 */

import 'server-only';

import type { Scope } from '@colombia-estudia/domain';
import { createTenantClient, prisma } from '@/lib/db/tenant';
import { APIError } from '@/lib/core/errors';
import {
  buildReference,
  createPaymentLink,
  fetchPaymentLink,
  isBoldConfigured,
  verifySignature,
  type BoldEvent,
} from '@/lib/billing/bold';
import { logger } from '@/lib/observability/logger';
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

/**
 * Cómo llega el link (19/11): `redirect` lleva al pagador ya mismo y dura 1 hora; `email` lo
 * envía Bold a su correo y `chat` lo deja el asesor en WhatsApp, y esos duran 24 horas.
 */
export type LinkDelivery = 'redirect' | 'email' | 'chat';

const HOUR_MS = 3600 * 1000;
const LINK_TTL_MS: Record<LinkDelivery, number> = {
  redirect: HOUR_MS,
  email: 24 * HOUR_MS,
  chat: 24 * HOUR_MS,
};
/** Lo mínimo que le debe quedar a un link para volver a entregarlo. */
const REUSE_MARGIN_MS: Record<LinkDelivery, number> = {
  redirect: 10 * 60 * 1000,
  email: 0,
  // El mensaje del chat dice «vence en 24 horas»: solo vale uno recién creado.
  chat: 23 * HOUR_MS,
};
const EMAIL_EVERY_MS = 5 * 60 * 1000;
const SYNC_AFTER_MS = 10 * 60 * 1000;

const pendingOf = (i: {
  amount: { toNumber(): number };
  payments: Array<{
    amount: { toNumber(): number };
    confirmedAt: Date | null;
    voidedAt: Date | null;
  }>;
}) =>
  i.amount.toNumber() -
  i.payments
    .filter((p) => p.confirmedAt && !p.voidedAt)
    .reduce((sum, p) => sum + p.amount.toNumber(), 0);

/** El link de una cuota por lo pendiente: reutiliza el vigente o crea uno en Bold y lo guarda. */
async function linkFor({
  institutionId,
  installment,
  pending,
  delivery,
  callbackUrl,
  payerEmail,
  now,
}: {
  institutionId: string;
  installment: { id: string; position: number };
  pending: number;
  delivery: LinkDelivery;
  callbackUrl: (reference: string) => string;
  payerEmail: string | null;
  now: Date;
}): Promise<{ url: string; reference: string }> {
  if (!isBoldConfigured()) {
    throw new APIError('El pago en línea no está habilitado en esta institución', 'CONFLICT');
  }
  const db = createTenantClient(institutionId);
  // Un link vigente por el mismo monto se reutiliza: pulsar dos veces no deja dos cobros
  // abiertos. Por correo no: Bold solo lo envía al crearlo.
  if (delivery === 'email') {
    // Cada link por correo es uno nuevo en Bold: uno cada 5 minutos por cuota, no uno por clic.
    const recent = await db.paymentLink.findFirst({
      where: {
        installmentId: installment.id,
        status: 'ACTIVE',
        createdAt: { gt: new Date(now.getTime() - EMAIL_EVERY_MS) },
        expiresAt: { gt: new Date(now.getTime() + REUSE_MARGIN_MS.chat) },
      },
      select: { id: true },
    });
    if (recent) {
      throw new APIError(
        'Ya se envió un link hace unos minutos. Revisa el correo, también en no deseados',
        'CONFLICT'
      );
    }
  } else {
    const open = await db.paymentLink.findFirst({
      where: {
        installmentId: installment.id,
        status: 'ACTIVE',
        amount: pending,
        expiresAt: { gt: new Date(now.getTime() + REUSE_MARGIN_MS[delivery]) },
      },
      orderBy: { createdAt: 'desc' },
      select: { url: true, reference: true },
    });
    if (open) return open;
  }

  const reference = buildReference(installment.id, now);
  const link = await createPaymentLink({
    reference,
    amountCop: pending,
    description: `Cuota ${installment.position} del plan de pago`,
    callbackUrl: callbackUrl(reference),
    payerEmail: delivery === 'email' ? payerEmail : null,
    ttlMs: LINK_TTL_MS[delivery],
    now,
  });
  if (!link) throw new APIError('Bold no creó el link de pago', 'INTERNAL');
  try {
    await db.paymentLink.create({
      data: {
        institutionId,
        installmentId: installment.id,
        reference,
        providerId: link.id,
        url: link.url,
        amount: pending,
        expiresAt: link.expiresAt,
      },
    });
  } catch (err) {
    // El link ya existe en Bold (y por correo ya salió): que quede rastro para ubicarlo.
    logger.error({ event: 'bold-link-orphan', reference, providerId: link.id, error: String(err) });
    throw err;
  }
  return { url: link.url, reference };
}

const returnUrl = (origin: string, path: string) => (reference: string) =>
  `${origin}${path}?pago=${encodeURIComponent(reference)}`;

/**
 * «Pagar en línea» desde la cuenta: el link de una cuota de una matrícula que la persona puede
 * pagar. Con `delivery: 'email'` no redirige: Bold se lo envía a su correo.
 */
export async function startCheckout({
  institutionId,
  installmentId,
  scopes,
  origin,
  customerEmail,
  returnPath = '/aprender/mi-cuenta',
  delivery = 'redirect',
  now = new Date(),
}: {
  institutionId: string;
  installmentId: string;
  scopes: readonly Scope[];
  origin: string;
  customerEmail: string | null;
  /** Adónde vuelve el pago (Fase C, 23/9): el acudiente paga desde `/familia/[enrollmentId]`. */
  returnPath?: string;
  delivery?: 'redirect' | 'email';
  now?: Date;
}): Promise<{ url: string; reference: string; amount: number; delivery: 'redirect' | 'email' }> {
  const db = createTenantClient(institutionId);
  const i = await db.installment.findFirst({
    where: { id: installmentId },
    select: {
      id: true,
      amount: true,
      status: true,
      position: true,
      payments: { select: { amount: true, confirmedAt: true, voidedAt: true } },
      paymentPlan: { select: { enrollmentId: true, partnerId: true } },
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
  const pending = pendingOf(i);
  if (pending <= 0) throw new APIError('Esa cuota ya está cubierta', 'CONFLICT');
  if (delivery === 'email' && !customerEmail) {
    throw new APIError('No tienes un correo registrado para enviarte el link', 'CONFLICT');
  }

  const link = await linkFor({
    institutionId,
    installment: i,
    pending,
    delivery,
    callbackUrl: returnUrl(origin, returnPath),
    payerEmail: customerEmail,
    now,
  });
  return { ...link, amount: pending, delivery };
}

export interface PersonCharge {
  installmentId: string;
  position: number;
  /** Lo que falta por pagar de esa cuota, en pesos. */
  amount: number;
  /** Día de vencimiento, `YYYY-MM-DD`. */
  dueOn: string;
}

/**
 * La próxima cuota que paga esa persona (la suya o la de quien tiene a cargo), para cobrarla
 * desde una conversación. Los planes que paga un aliado no cuentan.
 */
export async function nextChargeOf({
  institutionId,
  personId,
}: {
  institutionId: string;
  personId: string;
}): Promise<PersonCharge | null> {
  const db = createTenantClient(institutionId);
  const rows = await db.installment.findMany({
    where: {
      status: { in: ['OPEN', 'PARTIALLY_PAID'] },
      paymentPlan: {
        partnerId: null,
        OR: [{ payerPersonId: personId }, { enrollment: { studentId: personId } }],
      },
    },
    orderBy: [{ dueOn: 'asc' }, { position: 'asc' }],
    take: 5,
    select: {
      id: true,
      position: true,
      amount: true,
      dueOn: true,
      payments: { select: { amount: true, confirmedAt: true, voidedAt: true } },
    },
  });
  for (const row of rows) {
    const amount = pendingOf(row);
    if (amount > 0) {
      return {
        installmentId: row.id,
        position: row.position,
        amount,
        dueOn: row.dueOn.toISOString().slice(0, 10),
      };
    }
  }
  return null;
}

/** El link de la próxima cuota de una persona, pedido por el personal: por correo o para el chat. */
export async function createStaffLink({
  institutionId,
  personId,
  delivery,
  payerEmail,
  origin,
  now = new Date(),
}: {
  institutionId: string;
  personId: string;
  delivery: 'email' | 'chat';
  payerEmail: string | null;
  origin: string;
  now?: Date;
}): Promise<PersonCharge & { url: string; reference: string }> {
  const charge = await nextChargeOf({ institutionId, personId });
  if (!charge) throw new APIError('Esta persona no tiene cuotas por pagar', 'CONFLICT');
  if (delivery === 'email' && !payerEmail) {
    throw new APIError('Esta persona no tiene correo registrado', 'CONFLICT');
  }
  const link = await linkFor({
    institutionId,
    installment: { id: charge.installmentId, position: charge.position },
    pending: charge.amount,
    delivery,
    callbackUrl: returnUrl(origin, '/aprender/mi-cuenta'),
    payerEmail,
    now,
  });
  return { ...charge, ...link };
}

const LINK_SELECT = {
  id: true,
  institutionId: true,
  installmentId: true,
  reference: true,
  providerId: true,
  amount: true,
  status: true,
  expiresAt: true,
} as const;

interface LinkRow {
  id: string;
  institutionId: string;
  installmentId: string;
  reference: string;
  providerId: string;
  amount: { toNumber(): number };
  status: 'ACTIVE' | 'PAID' | 'EXPIRED';
  expiresAt: Date;
}

type LinkOutcome =
  'confirmed' | 'amount_mismatch' | 'duplicate' | 'pending' | 'expired' | 'rejected' | 'unreadable';

/** Pregunta a Bold por el link y, si está pagado, registra el pago una sola vez. */
async function syncLink(link: LinkRow, now: Date): Promise<LinkOutcome> {
  if (link.status === 'PAID') return 'duplicate';
  const bold = await fetchPaymentLink(link.providerId);
  if (!bold) return 'unreadable';

  const institutionId = link.institutionId;
  const db = createTenantClient(institutionId);
  if (bold.status !== 'PAID') {
    const rejected = bold.status === 'REJECTED' || bold.status === 'CANCELLED';
    const over = rejected || bold.status === 'EXPIRED' || link.expiresAt <= now;
    if (!over || bold.status === 'PROCESSING') return 'pending';
    // Deja de ofrecerse; si Bold lo cobra después, el paso a `PAID` sigue abierto.
    await db.paymentLink.updateMany({
      where: { id: link.id, status: 'ACTIVE' },
      data: { status: 'EXPIRED' },
    });
    return rejected ? 'rejected' : 'expired';
  }

  const installment = await db.installment.findFirst({
    where: { id: link.installmentId },
    select: {
      amount: true,
      position: true,
      payments: { select: { amount: true, confirmedAt: true, voidedAt: true } },
      paymentPlan: { select: { enrollment: { select: { id: true } } } },
    },
  });
  if (!isRow(installment)) return 'unreadable';

  const payment = await db.$transaction(async (tx) => {
    // Webhook, vuelta del pago y job compiten por esta fila: solo uno la pasa a `PAID`.
    const claimed = await tx.paymentLink.updateMany({
      where: { id: link.id, status: { not: 'PAID' } },
      data: { status: 'PAID' },
    });
    if (claimed.count === 0) return null;
    return tx.payment.create({
      data: {
        institutionId,
        installmentId: link.installmentId,
        amount: bold.amountCop,
        method: 'GATEWAY',
        reference: link.reference,
        gatewayRef: bold.transactionId ?? link.providerId,
        paidAt: now,
      },
      select: { id: true },
    });
  });
  if (!payment) return 'duplicate';

  const pending = pendingOf(installment);
  if (bold.amountCop !== pending) {
    const ops = await staffPersonIds(institutionId, ['OPERATIONS', 'ADMIN']);
    await notifyMany(institutionId, ops, {
      type: 'payment_failed',
      title: 'Pago en línea con monto distinto',
      body: `Bold cobró $${bold.amountCop.toLocaleString('es-CO')} para la cuota ${installment.position}, que tenía pendiente $${pending.toLocaleString('es-CO')}. Quedó registrado sin confirmar: revísalo en cartera.`,
      href: `/cartera/${installment.paymentPlan.enrollment.id}`,
      dedupeKey: `payment_mismatch:${link.id}`,
    });
    return 'amount_mismatch';
  }

  await confirmPayment({ institutionId, actorId: null, paymentId: payment.id, now });
  return 'confirmed';
}

export type ReturnedPayment = 'paid' | 'review' | 'pending' | 'failed';

/**
 * La vuelta del pago (`?pago=`): se le pregunta a Bold ya, sin esperar el webhook. Solo para
 * links de cuotas que esa persona puede pagar; cualquier otra referencia no dice nada.
 */
export async function checkReturnedPayment({
  institutionId,
  reference: raw,
  scopes,
  now = new Date(),
}: {
  institutionId: string;
  reference: string;
  scopes: readonly Scope[];
  now?: Date;
}): Promise<ReturnedPayment | null> {
  // Por si Bold pega sus propios parámetros detrás de la referencia.
  const reference = /^[A-Za-z0-9_-]+/.exec(raw)?.[0];
  if (!reference) return null;
  const db = createTenantClient(institutionId);
  const link = await db.paymentLink.findFirst({
    where: { reference },
    select: {
      ...LINK_SELECT,
      installment: {
        select: { paymentPlan: { select: { enrollmentId: true, partnerId: true } } },
      },
    },
  });
  if (!link) return null;
  const plan = link.installment.paymentPlan;
  const allowed = scopes.some(
    (s) =>
      ('enrollmentId' in s && s.enrollmentId === plan.enrollmentId) ||
      ('partnerId' in s && s.partnerId === plan.partnerId)
  );
  if (!allowed) return null;

  let outcome: LinkOutcome = 'unreadable';
  try {
    outcome = await syncLink(link, now);
  } catch (err) {
    logger.warn({ event: 'bold-return-failed', reference, error: String(err) });
  }
  if (outcome === 'confirmed') return 'paid';
  if (outcome === 'amount_mismatch') return 'review';
  if (outcome === 'rejected' || outcome === 'expired') return 'failed';
  if (outcome !== 'duplicate') return 'pending';
  const payment = await db.payment.findFirst({
    where: { reference, method: 'GATEWAY', voidedAt: null },
    select: { confirmedAt: true },
  });
  return payment?.confirmedAt ? 'paid' : 'review';
}

/** Job diario: links abiertos que Bold ya cobró (webhook perdido) o que ya vencieron. */
export async function syncOpenPaymentLinks({
  institutionId,
  now = new Date(),
}: {
  institutionId: string;
  now?: Date;
}): Promise<number> {
  const db = createTenantClient(institutionId);
  const open = await db.paymentLink.findMany({
    where: { status: 'ACTIVE', createdAt: { lt: new Date(now.getTime() - SYNC_AFTER_MS) } },
    orderBy: { createdAt: 'asc' },
    take: 100,
    select: LINK_SELECT,
  });
  let settled = 0;
  for (const link of open) {
    try {
      const outcome = await syncLink(link, now);
      if (outcome === 'confirmed' || outcome === 'amount_mismatch') settled++;
    } catch (err) {
      logger.warn({ event: 'bold-sync-failed', reference: link.reference, error: String(err) });
    }
  }
  return settled;
}

export type WebhookOutcome =
  | 'ignored'
  | 'invalid_signature'
  | 'invalid_event'
  | 'unknown_reference'
  | 'duplicate'
  | 'confirmed'
  | 'amount_mismatch'
  | 'declined'
  | 'voided'
  | 'pending';

/**
 * Procesa un evento de Bold con su cuerpo crudo (la firma va sobre el texto exacto). Sin
 * contexto de petición: la institución sale del link de la referencia. El evento no se cree:
 * solo dispara la consulta del link.
 */
export async function handleBoldEvent(
  rawBody: string,
  signature: string | null,
  now = new Date()
): Promise<{ outcome: WebhookOutcome; reference: string | null }> {
  if (!verifySignature(rawBody, signature))
    return { outcome: 'invalid_signature', reference: null };
  let event: BoldEvent;
  try {
    event = JSON.parse(rawBody) as BoldEvent;
  } catch {
    return { outcome: 'invalid_event', reference: null };
  }
  if (!event?.data?.payment_id) return { outcome: 'invalid_event', reference: null };
  const reference = event.data.metadata?.reference ?? null;
  return { outcome: await applyBoldEvent(event, reference, now), reference };
}

async function applyBoldEvent(
  event: BoldEvent,
  reference: string | null,
  now: Date
): Promise<WebhookOutcome> {
  if (!['SALE_APPROVED', 'SALE_REJECTED', 'VOID_APPROVED'].includes(event.type)) return 'ignored';
  if (!reference) return 'unknown_reference';

  // Bold devuelve la referencia que mandamos o, si no la trae, el id del link.
  const link = await prisma.paymentLink.findFirst({
    where: { OR: [{ reference }, { providerId: reference }] },
    select: LINK_SELECT,
  });
  if (!isRow(link)) return 'unknown_reference';

  if (event.type === 'SALE_APPROVED') {
    const outcome = await syncLink(link, now);
    return outcome === 'confirmed' || outcome === 'amount_mismatch' || outcome === 'duplicate'
      ? outcome
      : 'pending';
  }

  const institutionId = link.institutionId;
  const installment = await createTenantClient(institutionId).installment.findFirst({
    where: { id: link.installmentId },
    select: {
      position: true,
      paymentPlan: { select: { payerPersonId: true, enrollment: { select: { id: true } } } },
    },
  });
  if (!isRow(installment)) return 'unknown_reference';

  // Bold devolvió el dinero: el pago se anula a mano en cartera, con su motivo.
  if (event.type === 'VOID_APPROVED') {
    const ops = await staffPersonIds(institutionId, ['OPERATIONS', 'ADMIN']);
    await notifyMany(institutionId, ops, {
      type: 'payment_failed',
      title: 'Bold anuló un pago en línea',
      body: `Bold anuló el pago de $${link.amount.toNumber().toLocaleString('es-CO')} de la cuota ${installment.position} (${event.data.payment_id}). Anúlalo en cartera.`,
      href: `/cartera/${installment.paymentPlan.enrollment.id}`,
      dedupeKey: `payment_voided:${event.data.payment_id}`,
    });
    return 'voided';
  }

  const payerId = installment.paymentPlan.payerPersonId;
  if (payerId && link.status !== 'PAID') {
    await notify(institutionId, {
      personId: payerId,
      type: 'payment_failed',
      title: 'El pago en línea no se completó',
      body: `Tu pago de la cuota ${installment.position} no se completó. Puedes intentarlo de nuevo o pagar por transferencia.`,
      href: '/aprender/mi-cuenta',
      dedupeKey: `payment_failed:${event.data.payment_id}`,
    });
  }
  return 'declined';
}

function isRow<T>(row: T | null): row is T {
  return row !== null;
}
