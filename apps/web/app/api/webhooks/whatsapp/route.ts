/**
 * /api/webhooks/whatsapp — el webhook de WhatsApp Cloud API (5/11). GET responde el reto de
 * suscripción; POST recibe los mensajes: van a la conversación del contacto y los atiende el bot
 * o la bandeja (`handleWhatsAppMessage`). Autenticado por firma, no por sesión: no pasa por
 * `apiHandler`. SSOT: reference/02-api/endpoints.md (Webhooks).
 *
 * Firma inválida → 401. Lo demás → 200 siempre: Meta reintenta lo que no recibe 200 y un
 * mensaje que no se pudo enlazar no mejora reintentándolo.
 */

import { NextResponse } from 'next/server';
import { handleWhatsAppMessage } from '@/features/messaging/server/inbound.service';
import { inboundMessages, verifyChallenge, verifySignature } from '@/lib/whatsapp/cloud-api';
import { logger } from '@/lib/observability/logger';

export async function GET(req: Request) {
  const challenge = verifyChallenge(new URL(req.url).searchParams);
  if (challenge === null) return new NextResponse('forbidden', { status: 403 });
  return new NextResponse(challenge, { status: 200, headers: { 'Content-Type': 'text/plain' } });
}

export async function POST(req: Request) {
  const raw = await req.text();
  if (!verifySignature(raw, req.headers.get('x-hub-signature-256'))) {
    return NextResponse.json({ error: 'invalid_signature' }, { status: 401 });
  }
  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const outcomes = [];
  for (const message of inboundMessages(payload)) {
    try {
      outcomes.push(await handleWhatsAppMessage(message));
    } catch (err) {
      logger.error({ event: 'whatsapp-webhook-error', messageId: message.id, err });
      outcomes.push('error');
    }
  }
  logger.info({ event: 'whatsapp-webhook', outcomes });
  return NextResponse.json({ outcomes }, { status: 200 });
}
