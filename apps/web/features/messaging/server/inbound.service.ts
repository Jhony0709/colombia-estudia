import 'server-only';

/**
 * Lo que llega por WhatsApp (5/11). Todo mensaje queda en la conversación de ese contacto; luego:
 *
 * - con el código de una solicitud de otra oportunidad, lo enlaza `handleInboundMessage`;
 * - si la atiende el bot (`BOT`, o `CLOSED` y vuelve a escribir), saluda con el menú o responde
 *   la opción; «Hablar con un asesor» la pasa a `WAITING` y avisa a quienes atienden;
 * - si espera o la atiende alguien, solo se guarda: se responde desde `/mensajes`.
 */

import { createTenantClient, prisma } from '@/lib/db/tenant';
import { isUniqueViolation } from '@/lib/db/errors';
import { logger } from '@/lib/observability/logger';
import { siteUrl } from '@/lib/seo/site-url';
import {
  sendList,
  sendTemplate,
  sendText,
  type InboundMessage,
  type SendResult,
} from '@/lib/whatsapp/cloud-api';
import { notifyMany, staffPersonIds } from '@/features/notifications/server/notifications.service';
import { handleInboundMessage } from '@/features/requests/server/whatsapp.service';
import { whatsappIdOf } from '@/features/requests/server/requests.service';
import { answerFor, asksForMenu, CHOICES, menu } from '../bot';

export type InboundOutcome =
  'unknown_number' | 'duplicate' | 'attempt_request' | 'menu' | 'answered' | 'waiting' | 'stored';

type Conversation = { id: string; institutionId: string; status: string; contact: string };

/** Envía y lo deja en la conversación como del bot. */
async function botSays(
  conversation: Conversation,
  send: () => Promise<SendResult>,
  body: string,
  now: Date
) {
  const result = await send();
  if (!result.sent) {
    logger.warn({
      event: 'whatsapp-bot-send-failed',
      conversationId: conversation.id,
      reason: result.reason,
    });
  }
  await prisma.conversationMessage.create({
    data: {
      institutionId: conversation.institutionId,
      conversationId: conversation.id,
      direction: 'OUTBOUND',
      body,
      fromBot: true,
      externalId: result.sent ? result.id : null,
      createdAt: now,
    },
  });
  await prisma.conversation.update({
    where: { id: conversation.id },
    data: { lastMessageAt: now },
  });
}

/** La persona de la plataforma con ese WhatsApp, si hay una sola. */
async function personFor(institutionId: string, waId: string): Promise<string | null> {
  const db = createTenantClient(institutionId);
  const candidates = await db.person.findMany({
    where: { phone: { contains: waId.slice(-4) } },
    select: { id: true, phone: true },
    take: 20,
  });
  const matches = candidates.filter((p) => whatsappIdOf(p.phone) === waId);
  return matches.length === 1 ? matches[0]!.id : null;
}

/** Avisa a quienes atienden: plantilla a sus WhatsApp y aviso en la plataforma. */
async function callAdvisors(
  institution: { id: string; whatsappAgentPhones: string[] },
  phoneNumberId: string,
  conversation: Conversation & { contactName: string | null },
  waitingSince: Date
) {
  const who = conversation.contactName ?? `+${conversation.contact}`;
  const template = process.env.WHATSAPP_TEMPLATE_NEW_CHAT;
  if (template) {
    for (const phone of institution.whatsappAgentPhones) {
      const result = await sendTemplate(phone, template, [who, `+${conversation.contact}`], {
        phoneNumberId,
        urlSuffix: conversation.id,
      });
      if (!result.sent) {
        logger.warn({
          event: 'whatsapp-advisor-alert-failed',
          conversationId: conversation.id,
          reason: result.reason,
        });
      }
    }
  }
  const staff = await staffPersonIds(institution.id, ['OPERATIONS', 'ADMIN']);
  await notifyMany(institution.id, staff, {
    type: 'conversation_waiting',
    title: 'Chat esperando asesor',
    body: `${who} pidió hablar con un asesor por WhatsApp.`,
    href: `/mensajes/${conversation.id}`,
    dedupeKey: `conversation_waiting:${conversation.id}:${waitingSince.getTime()}`,
  });
}

export async function handleWhatsAppMessage(message: InboundMessage): Promise<InboundOutcome> {
  const institution = message.phoneNumberId
    ? await prisma.institution.findUnique({
        where: { whatsappPhoneNumberId: message.phoneNumberId },
        select: { id: true, name: true, whatsappAgentPhones: true },
      })
    : null;
  if (!institution || !message.phoneNumberId) {
    // Sin institución no hay bandeja; el código de una solicitud sí se puede enlazar.
    const linked = await handleInboundMessage(message);
    return linked === 'no_code' || linked === 'unknown_code' ? 'unknown_number' : 'attempt_request';
  }
  const phoneNumberId = message.phoneNumberId;
  const now = message.at;

  const key = {
    institutionId_channel_contact: {
      institutionId: institution.id,
      channel: 'WHATSAPP' as const,
      contact: message.from,
    },
  };
  const select = {
    id: true,
    institutionId: true,
    status: true,
    contact: true,
    contactName: true,
    assignedToId: true,
  } as const;
  const touch = {
    ...(message.name ? { contactName: message.name } : {}),
    lastInboundAt: now,
    lastMessageAt: now,
  };
  const existing = await prisma.conversation.findUnique({ where: key, select: { id: true } });
  // Solo la primera vez se busca a la persona: después ya está enlazada (o no la hay).
  const conversation = existing
    ? await prisma.conversation.update({ where: key, data: touch, select })
    : await prisma.conversation
        .create({
          data: {
            institutionId: institution.id,
            channel: 'WHATSAPP',
            contact: message.from,
            contactName: message.name,
            personId: await personFor(institution.id, message.from),
            lastInboundAt: now,
            lastMessageAt: now,
          },
          select,
        })
        .catch(async (err: unknown) => {
          // Dos mensajes seguidos de alguien nuevo: el otro la creó primero.
          if (!isUniqueViolation(err)) throw err;
          return prisma.conversation.update({ where: key, data: touch, select });
        });

  try {
    await prisma.conversationMessage.create({
      data: {
        institutionId: institution.id,
        conversationId: conversation.id,
        direction: 'INBOUND',
        body: message.text,
        externalId: message.id,
        createdAt: now,
      },
    });
  } catch (err) {
    // Meta reintenta lo que no recibió 200 a tiempo: lo ya guardado no se contesta otra vez.
    if (isUniqueViolation(err)) return 'duplicate';
    throw err;
  }

  if ((await handleInboundMessage(message)) === 'linked') return 'attempt_request';

  if (conversation.status === 'WAITING') return 'stored';
  if (conversation.status === 'OPEN') {
    if (conversation.assignedToId) {
      await notifyMany(institution.id, [conversation.assignedToId], {
        type: 'conversation_message',
        title: `Mensaje de ${conversation.contactName ?? `+${conversation.contact}`}`,
        body: message.text.slice(0, 140),
        href: `/mensajes/${conversation.id}`,
        // Uno por conversación cada media hora: avisa sin llenar la campana.
        dedupeKey: `conversation_message:${conversation.id}:${Math.floor(now.getTime() / 1_800_000)}`,
      });
    }
    return 'stored';
  }

  // BOT, o CLOSED que vuelve a escribir: lo atiende el bot.
  if (conversation.status === 'CLOSED') {
    await prisma.conversation.update({
      where: { id: conversation.id },
      data: { status: 'BOT', assignedToId: null, assignedAt: null },
    });
  }

  if (message.choiceId === CHOICES.advisor) {
    await prisma.conversation.update({
      where: { id: conversation.id },
      data: { status: 'WAITING', waitingSince: now, assignedToId: null, assignedAt: null },
    });
    const text = answerFor(CHOICES.advisor, siteUrl())!;
    await botSays(conversation, () => sendText(message.from, text, phoneNumberId), text, now);
    await callAdvisors(institution, phoneNumberId, conversation, now);
    return 'waiting';
  }

  const answer = asksForMenu(message.text) ? null : answerFor(message.choiceId, siteUrl());
  if (answer) {
    await botSays(conversation, () => sendText(message.from, answer, phoneNumberId), answer, now);
    return 'answered';
  }

  const greeting = menu(institution.name);
  await botSays(
    conversation,
    () => sendList(message.from, greeting, phoneNumberId),
    `${greeting.body} [menú]`,
    now
  );
  return 'menu';
}
