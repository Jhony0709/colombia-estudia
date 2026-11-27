/**
 * Avisos a quien atiende la bandeja (27/11): un mensaje nuevo en el chat que atiende, si no lo
 * tiene abierto, y recordatorios de lo que sigue esperando (sin tomar, o sin respuesta) a los
 * 10 y 30 minutos, en horario de asesores. Campana y, con `WHATSAPP_TEMPLATE_PENDING_MESSAGE`,
 * plantilla a su WhatsApp, que de noche no sale. La campana deduplica: sin aviso nuevo no sale
 * WhatsApp.
 */

import 'server-only';

import { prisma } from '@/lib/db/tenant';
import { logger } from '@/lib/observability/logger';
import { SERVICE_WINDOW_MS, sendTemplate } from '@/lib/whatsapp/cloud-api';
import { notifyMany, staffPersonIds } from '@/features/notifications/server/notifications.service';
import { whatsappIdOf } from '@/features/requests/server/requests.service';
import { advisorsOpen } from '../facts';

/** La bandeja pregunta cada 10 s mientras el chat está a la vista. */
export const SEEN_MS = 30_000;
export const REMIND_AFTER_MIN = [10, 30] as const;
/** Mensajes nuevos de un mismo chat: un aviso cada media hora. */
const MESSAGE_ALERT_MS = 30 * 60_000;

const latest = (a: Date | null, b: Date | null) => (a && b ? (a > b ? a : b) : (a ?? b));

const seen = (agentSeenAt: Date | null, now: Date) =>
  agentSeenAt !== null && now.getTime() - agentSeenAt.getTime() < SEEN_MS;

/** Quien atiende tiene el chat a la vista. Solo cuenta si es suyo. */
export async function markAgentSeen({
  institutionId,
  conversationId,
  actorId,
  now = new Date(),
}: {
  institutionId: string;
  conversationId: string;
  actorId: string;
  now?: Date;
}): Promise<void> {
  await prisma.conversation.updateMany({
    where: { id: conversationId, institutionId, assignedToId: actorId },
    data: { agentSeenAt: now },
  });
}

/** Solo quien sigue en el equipo: a alguien que ya salió no le llegan nombres de contactos. */
async function phonesOf(institutionId: string, personIds: string[]): Promise<string[]> {
  const people = await prisma.person.findMany({
    where: {
      institutionId,
      id: { in: personIds },
      memberships: {
        some: { institutionId, revokedAt: null, role: { in: ['OPERATIONS', 'ADMIN'] } },
      },
    },
    select: { phone: true },
  });
  return people.flatMap((p) => whatsappIdOf(p.phone) ?? []);
}

async function whatsappAgents(
  phones: string[],
  who: string,
  conversationId: string,
  phoneNumberId: string | null
): Promise<void> {
  const template = process.env.WHATSAPP_TEMPLATE_PENDING_MESSAGE;
  if (!template) return;
  // Meta rechaza variables con saltos de línea o muchos espacios: el nombre de perfil es libre.
  const name = who.replace(/\s+/g, ' ').trim().slice(0, 60);
  for (const phone of new Set(phones)) {
    const result = await sendTemplate(phone, template, [name], {
      phoneNumberId,
      urlSuffix: conversationId,
    });
    if (!result.sent) {
      logger.warn({ event: 'whatsapp-agent-alert-failed', conversationId, reason: result.reason });
    }
  }
}

/** Un mensaje nuevo en un chat tomado: a quien lo atiende, si no lo tiene abierto. */
export async function alertAssignedAgent({
  conversation,
  body,
  phoneNumberId,
  now,
}: {
  conversation: {
    id: string;
    institutionId: string;
    contact: string;
    contactName: string | null;
    assignedToId: string | null;
    agentSeenAt: Date | null;
  };
  body: string;
  phoneNumberId: string | null;
  now: Date;
}): Promise<void> {
  const { id, institutionId, assignedToId } = conversation;
  if (!assignedToId || seen(conversation.agentSeenAt, now)) return;
  const who = conversation.contactName ?? `+${conversation.contact}`;
  const { created } = await notifyMany(institutionId, [assignedToId], {
    type: 'conversation_message',
    title: `Mensaje de ${who}`,
    body: body.slice(0, 140),
    href: `/mensajes/${id}`,
    dedupeKey: `conversation_message:${id}:${Math.floor(now.getTime() / MESSAGE_ALERT_MS)}`,
  });
  // De noche, solo la campana: el bot ya le dio el horario y el recordatorio sale al abrir.
  if (created === 0 || !advisorsOpen(now)) return;
  await whatsappAgents(await phonesOf(institutionId, [assignedToId]), who, id, phoneNumberId);
}

export interface AgentReminderReport {
  waiting: number;
  unanswered: number;
}

/** Lo que sigue esperando a los 10 y 30 min. Lo corre `/api/jobs/waiting-chats` cada minuto. */
export async function runAgentReminders(now: Date = new Date()): Promise<AgentReminderReport> {
  const report: AgentReminderReport = { waiting: 0, unanswered: 0 };
  if (!advisorsOpen(now)) return report;

  const first = new Date(now.getTime() - REMIND_AFTER_MIN[0] * 60_000);
  const rows = await prisma.conversation.findMany({
    where: {
      OR: [
        { status: 'WAITING', waitingSince: { lte: first } },
        {
          status: 'OPEN',
          assignedToId: { not: null },
          lastInboundAt: { lte: first, gte: new Date(now.getTime() - SERVICE_WINDOW_MS) },
        },
      ],
    },
    select: {
      id: true,
      institutionId: true,
      status: true,
      contact: true,
      contactName: true,
      assignedToId: true,
      agentSeenAt: true,
      waitingSince: true,
      lastInboundAt: true,
      assignedAt: true,
      institution: { select: { whatsappPhoneNumberId: true, whatsappAgentPhones: true } },
      // El aviso del bot fuera de horario no cuenta como respuesta.
      messages: {
        where: { fromBot: false },
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: { direction: true },
      },
    },
    // Los más recientes primero: con más de 200, lo viejo espera y lo nuevo no.
    orderBy: { lastMessageAt: 'desc' },
    take: 200,
  });

  for (const row of rows) {
    const waiting = row.status === 'WAITING';
    // Tomado: cuenta desde su último mensaje, o desde que lo tomó si fue después.
    const since = waiting ? row.waitingSince : latest(row.lastInboundAt, row.assignedAt);
    if (!since) continue;
    // Tomado: solo si lo último es de la persona y quien lo atiende no lo tiene a la vista.
    if (!waiting && (row.messages[0]?.direction !== 'INBOUND' || seen(row.agentSeenAt, now))) {
      continue;
    }
    const minutes = Math.floor((now.getTime() - since.getTime()) / 60_000);
    const stage = REMIND_AFTER_MIN.filter((m) => minutes >= m).length;
    if (stage === 0) continue;

    const who = row.contactName ?? `+${row.contact}`;
    const people = waiting
      ? await staffPersonIds(row.institutionId, ['OPERATIONS', 'ADMIN'])
      : [row.assignedToId!];
    const { created } = await notifyMany(row.institutionId, people, {
      type: waiting ? 'conversation_waiting' : 'conversation_message',
      title: waiting ? 'Chat sin tomar' : `${who} sigue esperando respuesta`,
      body: waiting
        ? `${who} lleva ${minutes} min esperando asesor por WhatsApp.`
        : `Su último mensaje lleva ${minutes} min sin respuesta.`,
      href: `/mensajes/${row.id}`,
      dedupeKey: `conversation_reminder:${row.id}:${since.getTime()}:${stage}`,
    });
    if (created === 0) continue;

    await whatsappAgents(
      waiting ? row.institution.whatsappAgentPhones : await phonesOf(row.institutionId, people),
      who,
      row.id,
      row.institution.whatsappPhoneNumberId
    );
    report[waiting ? 'waiting' : 'unanswered'] += 1;
  }
  return report;
}
