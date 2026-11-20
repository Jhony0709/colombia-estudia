import 'server-only';

/**
 * Mientras una conversación espera asesor (14/11): cada 3 minutos sin que nadie la tome, un
 * recordatorio; después del tercero, la propuesta de escribir por correo, y ahí se detiene.
 * Lo corre `/api/jobs/waiting-chats` cada minuto. Mientras espera, la persona acaba de escribir:
 * la ventana de 24 h está abierta y esto no lleva plantilla.
 */

import { prisma } from '@/lib/db/tenant';
import { logger } from '@/lib/observability/logger';
import { SERVICE_WINDOW_MS, sendText } from '@/lib/whatsapp/cloud-api';

export const REMINDER_EVERY_MS = 3 * 60_000;

const REMINDERS = [
  'Seguimos buscando a un asesor disponible para ti ⏳ En un momento te escribimos.',
  'Gracias por tu paciencia 🙏 Tu conversación sigue en la fila y un asesor la verá pronto.',
  'Seguimos aquí. Los asesores están ocupados en este momento, pero no hemos olvidado tu mensaje.',
];

/** El mensaje número `sent` (0, 1, 2 recordatorios; 3 el correo); `null` cuando ya no hay más. */
export function waitingMessage(sent: number, supportEmail: string): string | null {
  if (sent < REMINDERS.length) return REMINDERS[sent]!;
  if (sent === REMINDERS.length) {
    return `Si prefieres, escríbenos a ${supportEmail} con tu consulta y te respondemos por ese medio 📧 Tu conversación sigue abierta aquí por si un asesor se libera.`;
  }
  return null;
}

export interface WaitingReport {
  checked: number;
  sent: number;
  failed: number;
  /** Cerradas sin atender: pasaron las 24 h de WhatsApp y ya no se les puede escribir. */
  closed: number;
}

export async function runWaitingReminders(now: Date = new Date()): Promise<WaitingReport> {
  // Se cierran con `waitingSince` puesto: así la bandeja las muestra como «sin atender».
  const stale = new Date(now.getTime() - SERVICE_WINDOW_MS);
  const closed = await prisma.conversation.updateMany({
    where: {
      status: 'WAITING',
      OR: [{ lastInboundAt: { lt: stale } }, { lastInboundAt: null, waitingSince: { lt: stale } }],
    },
    data: { status: 'CLOSED' },
  });

  const rows = await prisma.conversation.findMany({
    where: {
      status: 'WAITING',
      waitingSince: { not: null, lte: new Date(now.getTime() - REMINDER_EVERY_MS) },
      waitingReminders: { lte: REMINDERS.length },
    },
    select: {
      id: true,
      institutionId: true,
      contact: true,
      waitingSince: true,
      waitingReminders: true,
      institution: { select: { whatsappPhoneNumberId: true, supportEmail: true } },
    },
    take: 200,
  });

  const report: WaitingReport = { checked: rows.length, sent: 0, failed: 0, closed: closed.count };
  for (const row of rows) {
    const due = row.waitingSince!.getTime() + REMINDER_EVERY_MS * (row.waitingReminders + 1);
    if (now.getTime() < due) continue;
    const text = waitingMessage(row.waitingReminders, row.institution.supportEmail);
    if (!text) continue;

    // Si alguien la tomó entre la consulta y aquí, no se cuenta ni se envía.
    const claimed = await prisma.conversation.updateMany({
      where: { id: row.id, status: 'WAITING', waitingReminders: row.waitingReminders },
      data: { waitingReminders: { increment: 1 }, lastMessageAt: now },
    });
    if (claimed.count === 0) continue;

    const result = await sendText(row.contact, text, row.institution.whatsappPhoneNumberId);
    if (!result.sent) {
      report.failed += 1;
      logger.warn({
        event: 'whatsapp-waiting-reminder-failed',
        conversationId: row.id,
        reason: result.reason,
      });
    } else {
      report.sent += 1;
    }
    await prisma.conversationMessage.create({
      data: {
        institutionId: row.institutionId,
        conversationId: row.id,
        direction: 'OUTBOUND',
        body: text,
        fromBot: true,
        externalId: result.sent ? result.id : null,
        createdAt: now,
      },
    });
  }
  return report;
}
