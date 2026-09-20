/**
 * POST /api/webhooks/wompi — el evento `transaction.updated`. Autenticado por firma, no por
 * sesión, así que no pasa por `apiHandler` (que rechazaría el origen cruzado).
 * SSOT: endpoints.md:101, plan/09 §4.
 *
 * Firma inválida → 401. Lo demás → 200 siempre, con el resultado en el cuerpo, para que
 * Wompi no reintente lo que ya se registró.
 */

import { NextResponse } from 'next/server';
import { handleWompiEvent } from '@/features/billing/server/account.service';
import type { WompiEvent } from '@/lib/billing/wompi';
import { logger } from '@/lib/observability/logger';

export async function POST(req: Request) {
  let event: WompiEvent;
  try {
    event = (await req.json()) as WompiEvent;
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  if (!event || typeof event !== 'object' || !event.signature || !event.data?.transaction) {
    return NextResponse.json({ error: 'invalid_event' }, { status: 400 });
  }

  const outcome = await handleWompiEvent(event);
  logger.info({ event: 'wompi-webhook', outcome, reference: event.data.transaction.reference });

  if (outcome === 'invalid_signature') {
    return NextResponse.json({ error: 'invalid_signature' }, { status: 401 });
  }
  return NextResponse.json({ outcome }, { status: 200 });
}
