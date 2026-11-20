/**
 * POST /api/webhooks/bold — eventos de venta de Bold (`SALE_APPROVED`, `SALE_REJECTED`,
 * `VOID_APPROVED`). Autenticado por firma (`x-bold-signature`), no por sesión, así que no pasa
 * por `apiHandler`. SSOT: endpoints.md, developers.bold.co/webhook.
 *
 * Firma inválida → 401; evento mal formado → 400; aprobado que Bold aún no muestra como pagado
 * → 503, para que lo reintente. Lo demás → 200, con el resultado en el cuerpo.
 */

import { NextResponse } from 'next/server';
import { handleBoldEvent } from '@/features/billing/server/account.service';
import { logger } from '@/lib/observability/logger';

export async function POST(req: Request) {
  const raw = await req.text();
  const { outcome, reference } = await handleBoldEvent(raw, req.headers.get('x-bold-signature'));
  logger.info({ event: 'bold-webhook', outcome, reference });

  if (outcome === 'invalid_signature') {
    return NextResponse.json({ error: 'invalid_signature' }, { status: 401 });
  }
  if (outcome === 'invalid_event') {
    return NextResponse.json({ error: 'invalid_event' }, { status: 400 });
  }
  return NextResponse.json({ outcome }, { status: outcome === 'pending' ? 503 : 200 });
}
