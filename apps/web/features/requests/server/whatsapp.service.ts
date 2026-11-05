import 'server-only';

/**
 * Lo que llega por WhatsApp al número del negocio (5/11). El botón «Pedir otra oportunidad»
 * abre el chat con el código de la solicitud ya escrito; al llegar, la solicitud guarda desde
 * qué WhatsApp escribió, para avisarle ahí cuando operación la conceda (`grantAttempt`).
 *
 * Sin código no se hace nada: esa conversación la atiende el asesor desde WhatsApp.
 */

import { createTenantClient, prisma } from '@/lib/db/tenant';
import { logger } from '@/lib/observability/logger';
import { sendText, type InboundMessage } from '@/lib/whatsapp/cloud-api';

/** El código es el id de la solicitud (cuid): `c` y 24 letras o cifras. */
const CODE = /\b(c[a-z0-9]{24})\b/;

export type InboundOutcome = 'linked' | 'no_code' | 'unknown_code' | 'closed';

export async function handleInboundMessage(message: InboundMessage): Promise<InboundOutcome> {
  const code = CODE.exec(message.text)?.[1];
  if (!code) return 'no_code';

  // Sin sesión ni institución: la solicitud dice de cuál es, como la cuota en Wompi.
  const found = await prisma.accessRequest.findFirst({
    where: { id: code },
    select: { id: true, institutionId: true, status: true },
  });
  if (!found) return 'unknown_code';
  if (found.status !== 'PENDING') {
    await sendText(
      message.from,
      'Esta solicitud ya se resolvió. Si necesitas algo más, cuéntanos por aquí.',
      message.phoneNumberId
    );
    return 'closed';
  }

  const db = createTenantClient(found.institutionId);
  await db.accessRequest.update({
    where: { id: found.id },
    data: { whatsappId: message.from, whatsappAt: message.at },
  });
  const ack = await sendText(
    message.from,
    'Recibimos tu solicitud. Un asesor la revisa y te avisamos por aquí cuando tengas otra oportunidad.',
    message.phoneNumberId
  );
  if (!ack.sent)
    logger.warn({ event: 'whatsapp-ack-failed', requestId: found.id, reason: ack.reason });
  return 'linked';
}
