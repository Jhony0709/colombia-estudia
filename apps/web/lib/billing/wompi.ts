/**
 * Wompi: firma de integridad del checkout, verificación del checksum de eventos y consulta
 * de una transacción. SSOT: plan/09-cartera.md §4, docs.wompi.co.
 *
 * Tres cosas y nada más, cada una con su secreto:
 * - `WOMPI_INTEGRITY_SECRET` firma lo que va al Web Checkout (referencia + centavos +
 *   moneda + secreto → SHA-256);
 * - `WOMPI_EVENTS_SECRET` verifica lo que vuelve por el webhook (checksum sobre las
 *   propiedades que el evento declara, en su orden, + timestamp + secreto → SHA-256);
 * - `WOMPI_PRIVATE_KEY` consulta la transacción en la API antes de confiar en el evento.
 *
 * Centavos solo aquí: el resto del sistema habla en pesos enteros.
 */

import { createHash, timingSafeEqual } from 'node:crypto';

const API_URL = process.env.WOMPI_API_URL || 'https://sandbox.wompi.co/v1';
const CHECKOUT_URL = process.env.WOMPI_CHECKOUT_URL || 'https://checkout.wompi.co/p/';

export function isWompiConfigured(): boolean {
  return Boolean(
    process.env.WOMPI_PUBLIC_KEY &&
    process.env.WOMPI_INTEGRITY_SECRET &&
    process.env.WOMPI_EVENTS_SECRET
  );
}

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

export interface CheckoutParams {
  reference: string;
  amountCop: number;
  redirectUrl: string;
  customerEmail?: string | null;
}

/** La URL del Web Checkout con la firma de integridad. */
export function buildCheckoutUrl({
  reference,
  amountCop,
  redirectUrl,
  customerEmail,
}: CheckoutParams): string {
  const secret = process.env.WOMPI_INTEGRITY_SECRET ?? '';
  const publicKey = process.env.WOMPI_PUBLIC_KEY ?? '';
  const amountInCents = amountCop * 100;
  const currency = 'COP';
  const signature = sha256(`${reference}${amountInCents}${currency}${secret}`);
  const params = new URLSearchParams({
    'public-key': publicKey,
    currency,
    'amount-in-cents': String(amountInCents),
    reference,
    'signature:integrity': signature,
    'redirect-url': redirectUrl,
  });
  if (customerEmail) params.set('customer-data:email', customerEmail);
  return `${CHECKOUT_URL}?${params.toString()}`;
}

export interface WompiEvent {
  event: string;
  data: { transaction: WompiTransaction };
  signature: { properties: string[]; checksum: string };
  timestamp: number;
}

export interface WompiTransaction {
  id: string;
  reference: string;
  status: 'APPROVED' | 'DECLINED' | 'VOIDED' | 'ERROR' | 'PENDING';
  amount_in_cents: number;
  currency: string;
  payment_method_type?: string;
  customer_email?: string | null;
}

/** Lee `data.transaction.x` según la ruta que el evento declara en `signature.properties`. */
function readProperty(data: unknown, path: string): string {
  let cur: unknown = data;
  for (const part of path.split('.')) {
    if (typeof cur !== 'object' || cur === null) return '';
    cur = (cur as Record<string, unknown>)[part];
  }
  return cur === undefined || cur === null ? '' : String(cur);
}

/** Verifica el checksum del evento con `WOMPI_EVENTS_SECRET`. Comparación en tiempo constante. */
export function verifyEventChecksum(event: WompiEvent): boolean {
  const secret = process.env.WOMPI_EVENTS_SECRET;
  if (!secret) return false;
  const concatenated = event.signature.properties.map((p) => readProperty(event.data, p)).join('');
  const expected = sha256(`${concatenated}${event.timestamp}${secret}`);
  const given = (event.signature.checksum ?? '').toLowerCase();
  if (given.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(given, 'utf8'), Buffer.from(expected, 'utf8'));
}

/** Consulta la transacción en la API de Wompi. `null` si no se puede leer. */
export async function fetchTransaction(id: string): Promise<WompiTransaction | null> {
  const key = process.env.WOMPI_PRIVATE_KEY;
  if (!key) return null;
  const res = await fetch(`${API_URL}/transactions/${encodeURIComponent(id)}`, {
    headers: { Authorization: `Bearer ${key}` },
    cache: 'no-store',
  });
  if (!res.ok) return null;
  const body = (await res.json().catch(() => null)) as { data?: WompiTransaction } | null;
  return body?.data ?? null;
}

/** `ce-{installmentId}-{n}`: la referencia del checkout. */
export function buildReference(installmentId: string, attempt: number): string {
  return `ce-${installmentId}-${attempt}`;
}

export function parseReference(
  reference: string
): { installmentId: string; attempt: number } | null {
  const m = /^ce-([a-z0-9]+)-(\d+)$/.exec(reference);
  return m ? { installmentId: m[1]!, attempt: Number(m[2]) } : null;
}
