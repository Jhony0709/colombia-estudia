/**
 * Bold: link de pago por API, firma del webhook y consulta del link. Reemplaza a Wompi (18/11).
 * SSOT: developers.bold.co (API Link de pagos, Webhook).
 *
 * - `BOLD_API_KEY` (llave de identidad) crea y consulta links: `Authorization: x-api-key …`;
 * - `BOLD_SECRET_KEY` (llave secreta) verifica `x-bold-signature`: HMAC-SHA256 en hex del cuerpo
 *   en Base64. Con las llaves de prueba (`BOLD_SANDBOX=true`) Bold firma con llave vacía, y por
 *   eso el modo de pruebas nunca se acepta en producción.
 *
 * Los montos van en pesos enteros, como en el resto del sistema.
 */

import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';

const API_URL = process.env.BOLD_API_URL || 'https://integrations.api.bold.co';
const TIMEOUT_MS = 8000;

// Bold caído o lento no deja colgada la página ni el webhook: sin respuesta, `null`.
async function call(path: string, init: RequestInit = {}): Promise<Response | null> {
  try {
    return await fetch(`${API_URL}${path}`, {
      ...init,
      headers: headers(),
      cache: 'no-store',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    return null;
  }
}

export const isBoldSandbox = () =>
  process.env.BOLD_SANDBOX === 'true' && process.env.VERCEL_ENV !== 'production';

export function isBoldConfigured(): boolean {
  return Boolean(process.env.BOLD_API_KEY && (isBoldSandbox() || process.env.BOLD_SECRET_KEY));
}

const headers = () => ({
  Authorization: `x-api-key ${process.env.BOLD_API_KEY ?? ''}`,
  'Content-Type': 'application/json',
});

export interface PaymentLinkParams {
  reference: string;
  amountCop: number;
  description: string;
  callbackUrl?: string | null;
  /** Con correo, Bold le envía el link a esa dirección. */
  payerEmail?: string | null;
  /** Cuánto dura el link. Bold no deja cancelarlo: la vigencia es el único límite. */
  ttlMs: number;
  now?: Date;
}

/** Crea un link de un solo pago por el monto exacto. `null` si Bold no lo crea. */
export async function createPaymentLink({
  reference,
  amountCop,
  description,
  callbackUrl,
  payerEmail,
  ttlMs,
  now = new Date(),
}: PaymentLinkParams): Promise<{ id: string; url: string; expiresAt: Date } | null> {
  const expiresAt = new Date(now.getTime() + ttlMs);
  const body = {
    amount_type: 'CLOSE',
    amount: { currency: 'COP', total_amount: amountCop, tip_amount: 0 },
    reference,
    description: description.slice(0, 100),
    // Nanosegundos desde la época Unix (comprobado el 19/11: en milisegundos responde PL_000).
    expiration_date: expiresAt.getTime() * 1_000_000,
    ...(callbackUrl?.startsWith('https://') ? { callback_url: callbackUrl } : {}),
    ...(payerEmail ? { payer_email: payerEmail } : {}),
  };
  const res = await call('/online/link/v1', { method: 'POST', body: JSON.stringify(body) });
  const json = (await res?.json().catch(() => null)) as {
    payload?: { payment_link?: string; url?: string };
  } | null;
  const link = json?.payload;
  if (!res?.ok || !link?.payment_link || !link.url) return null;
  return { id: link.payment_link, url: link.url, expiresAt };
}

export type BoldLinkStatus =
  'ACTIVE' | 'PROCESSING' | 'PAID' | 'REJECTED' | 'CANCELLED' | 'EXPIRED';

export interface BoldLink {
  status: BoldLinkStatus;
  amountCop: number;
  /** El id de la transacción que lo pagó; nulo mientras no se pague. */
  transactionId: string | null;
}

/** El estado del link en Bold: la única fuente para dar un pago por hecho. `null` si no se lee. */
export async function fetchPaymentLink(id: string): Promise<BoldLink | null> {
  if (!process.env.BOLD_API_KEY) return null;
  const res = await call(`/online/link/v1/${encodeURIComponent(id)}`);
  if (!res?.ok) return null;
  const body = (await res.json().catch(() => null)) as {
    status?: BoldLinkStatus;
    total?: number;
    transaction_id?: string | null;
    is_sandbox?: boolean;
  } | null;
  if (!body?.status || typeof body.total !== 'number') return null;
  // Un link de pruebas no cobra: fuera del modo de pruebas no cuenta como pago.
  if (body.is_sandbox && !isBoldSandbox()) return null;
  return {
    status: body.status,
    amountCop: Math.round(body.total),
    transactionId: body.transaction_id ?? null,
  };
}

export type BoldEventType = 'SALE_APPROVED' | 'SALE_REJECTED' | 'VOID_APPROVED' | 'VOID_REJECTED';

export interface BoldEvent {
  id: string;
  type: BoldEventType | string;
  data: {
    payment_id: string;
    amount?: { total?: number };
    metadata?: { reference?: string | null } | null;
  };
}

/** Verifica `x-bold-signature` sobre el cuerpo crudo. Comparación en tiempo constante. */
export function verifySignature(rawBody: string, signature: string | null): boolean {
  const secret = isBoldSandbox() ? '' : process.env.BOLD_SECRET_KEY;
  if (secret === undefined || !signature) return false;
  if (!secret && !isBoldSandbox()) return false;
  const encoded = Buffer.from(rawBody, 'utf8').toString('base64');
  const expected = createHmac('sha256', secret).update(encoded).digest('hex');
  const given = signature.trim().toLowerCase();
  if (given.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(given, 'utf8'), Buffer.from(expected, 'utf8'));
}

/** `ce-{installmentId}-{intento}`: la referencia del link. Bold pide una por link. */
export function buildReference(installmentId: string, now = new Date()): string {
  return `ce-${installmentId}-${now.getTime().toString(36)}`;
}
