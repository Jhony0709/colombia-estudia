import 'server-only';

/**
 * Lo que llega por WhatsApp (5/11). Todo mensaje queda en la conversación de ese contacto; luego:
 *
 * - con el código de una solicitud de otra oportunidad, lo enlaza `handleInboundMessage`;
 * - si la atiende el bot (`BOT`, o `CLOSED` y vuelve a escribir), saluda con el menú o responde
 *   la opción; «Hablar con un asesor» la pasa a `WAITING` y avisa a quienes atienden;
 * - si espera o la atiende alguien, solo se guarda: se responde desde `/mensajes`.
 */

import { JSON_NULL } from '@/lib/db/prisma';
import { createTenantClient, prisma } from '@/lib/db/tenant';
import { isUniqueViolation } from '@/lib/db/errors';
import { logger } from '@/lib/observability/logger';
import {
  markRead,
  sendButtons,
  sendList,
  sendTemplate,
  sendText,
  type InboundMessage,
  type SendResult,
} from '@/lib/whatsapp/cloud-api';
import { notifyMany, staffPersonIds } from '@/features/notifications/server/notifications.service';
import { handleInboundMessage } from '@/features/requests/server/whatsapp.service';
import { whatsappIdOf } from '@/features/requests/server/requests.service';
import {
  answerFor,
  asksForMenu,
  CSAT,
  greeting,
  intentFor,
  MEDIA_REPLY,
  NOT_UNDERSTOOD,
  RESEND_ACCOUNT,
  TOPICS,
} from '../bot';
import { createAccountFromChat, resendAccountEmail } from './chat-account.service';
import { botContext } from './facts.service';
import { ADVISOR_HOURS_TEXT } from '../facts';
import {
  cancelsIntake,
  intakeAnswer,
  isIntakeChoice,
  type IntakeData,
  type IntakeKind,
  type IntakeReply,
} from '../intake';

export type InboundOutcome =
  | 'unknown_number'
  | 'duplicate'
  | 'attempt_request'
  | 'menu'
  | 'answered'
  | 'intake'
  | 'waiting'
  | 'stored';

type Conversation = { id: string; institutionId: string; status: string; contact: string };

const NO_INTAKE = { intakeKind: null, intakeStep: null, intake: JSON_NULL };

/** Envía y lo deja en la conversación como del bot. */
async function botSays(
  conversation: Conversation,
  send: () => Promise<SendResult>,
  body: string,
  now: Date
) {
  const result = await send();
  // Después del mensaje que responde: `now` viene en segundos y empataba con él al ordenar.
  const at = new Date(Math.max(Date.now(), now.getTime() + 1));
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
      createdAt: at,
    },
  });
  await prisma.conversation.update({
    where: { id: conversation.id },
    data: { lastMessageAt: at },
  });
}

/** Lo que dice el bot: texto, con botones o con lista; en el hilo queda con sus opciones. */
function say(
  conversation: Conversation,
  to: string,
  reply: IntakeReply,
  phoneNumberId: string,
  now: Date
) {
  const { text, buttons, list } = reply;
  const send = () =>
    list
      ? sendList(to, { body: text, ...list }, phoneNumberId)
      : buttons
        ? sendButtons(to, text, buttons, phoneNumberId)
        : sendText(to, text, phoneNumberId);
  const options = list?.options ?? buttons;
  const body = options ? `${text} [${options.map((o) => o.title).join(' · ')}]` : text;
  return botSays(conversation, send, body, now);
}

/** Pasa a esperar asesor: los recordatorios (`waiting.service.ts`) cuentan desde aquí. */
const waiting = (now: Date) => ({
  status: 'WAITING' as const,
  waitingSince: now,
  waitingReminders: 0,
  assignedToId: null,
  assignedAt: null,
});

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

/** El chat está enlazado a una persona con rol de estudiante (23/11: certificados). */
async function linkedStudent(institutionId: string, conversationId: string): Promise<boolean> {
  const row = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: { personId: true },
  });
  if (!row?.personId) return false;
  const membership = await prisma.membership.findFirst({
    where: { institutionId, personId: row.personId, role: 'STUDENT', revokedAt: null },
    select: { id: true },
  });
  return membership !== null;
}

/** Avisa a quienes atienden: plantilla a sus WhatsApp y aviso en la plataforma. */
async function callAdvisors(
  institution: { id: string; whatsappAgentPhones: string[] },
  phoneNumberId: string,
  conversation: Conversation & { contactName: string | null },
  waitingSince: Date,
  intake: IntakeKind | null = null
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
    body:
      intake === 'ENROLL'
        ? `${who} dejó sus datos de inscripción por WhatsApp.`
        : intake === 'CERTIFICATE'
          ? `${who} pidió un certificado por WhatsApp.`
          : intake === 'ACCOUNT'
            ? `${who} quiso crear su cuenta por WhatsApp y necesita ayuda.`
            : `${who} pidió hablar con un asesor por WhatsApp.`,
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
    intakeKind: true,
    intakeStep: true,
    intake: true,
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

  // Si respondió citando un mensaje del chat, se enlaza para mostrar la cita en la bandeja.
  const quoted = message.replyToExternalId
    ? await prisma.conversationMessage.findFirst({
        where: { conversationId: conversation.id, externalId: message.replyToExternalId },
        select: { id: true },
      })
    : null;

  try {
    await prisma.conversationMessage.create({
      data: {
        institutionId: institution.id,
        conversationId: conversation.id,
        direction: 'INBOUND',
        body: message.text,
        externalId: message.id,
        ...(quoted ? { replyToId: quoted.id } : {}),
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

  // La encuesta al cerrar (22/11): se guarda y se agradece; no reabre el bot.
  if (conversation.status === 'CLOSED' && message.choiceId?.startsWith('csat_')) {
    await prisma.auditLog.create({
      data: {
        institutionId: institution.id,
        actorId: null,
        entity: 'conversation',
        entityId: conversation.id,
        action: 'rated',
        after: {
          score: Number(message.choiceId.slice('csat_'.length)),
          assignedToId: conversation.assignedToId,
        },
        occurredAt: now,
      },
    });
    await say(conversation, message.from, { text: CSAT.thanks }, phoneNumberId, now);
    return 'answered';
  }

  // Doble check azul y «escribiendo…» mientras el bot prepara la respuesta (22/11).
  await markRead(message.id, phoneNumberId);

  // BOT, o CLOSED que vuelve a escribir: lo atiende el bot.
  if (conversation.status === 'CLOSED') {
    await prisma.conversation.update({
      where: { id: conversation.id },
      data: {
        ...NO_INTAKE,
        status: 'BOT',
        assignedToId: null,
        assignedAt: null,
        waitingSince: null,
      },
    });
  }

  const ctx = await botContext(institution.id);

  // En medio de un formulario: lo que escribe responde la pregunta en curso. Sus botones también;
  // otra opción del menú, «cancelar» o «menú» lo sacan.
  const { intakeKind, intakeStep } = conversation;
  if (intakeKind && intakeStep !== null && conversation.status !== 'CLOSED') {
    const leaves = message.choiceId
      ? !isIntakeChoice(message.choiceId)
      : cancelsIntake(message.text) || asksForMenu(message.text);
    if (leaves) {
      await prisma.conversation.update({ where: { id: conversation.id }, data: NO_INTAKE });
    } else {
      const data = (conversation.intake ?? {}) as IntakeData;
      const step = intakeAnswer(
        intakeKind,
        intakeStep,
        data,
        { text: message.text, choiceId: message.choiceId },
        { waId: message.from, now, policyUrl: ctx.policyUrl, siteUrl: ctx.siteUrl }
      );
      if (step.status === 'retry') {
        await say(conversation, message.from, step.reply, phoneNumberId, now);
        return 'intake';
      }
      if (step.status === 'cancel') {
        await prisma.conversation.update({ where: { id: conversation.id }, data: NO_INTAKE });
        // Un menor (Ley 1581): lo que escribió desde la autorización sale del hilo.
        if (step.forget && data._consentAt) {
          await prisma.conversationMessage.updateMany({
            where: {
              conversationId: conversation.id,
              direction: 'INBOUND',
              createdAt: { gte: new Date(data._consentAt) },
            },
            data: { body: '[Dato retirado: menor de edad]' },
          });
        }
        await say(conversation, message.from, step.reply, phoneNumberId, now);
        return 'answered';
      }
      if (step.status === 'next') {
        await prisma.conversation.update({
          where: { id: conversation.id },
          data: { intake: step.data, intakeStep: step.step },
        });
        await say(conversation, message.from, step.reply, phoneNumberId, now);
        return 'intake';
      }
      if (intakeKind === 'ACCOUNT') {
        return accountDone(institution, phoneNumberId, conversation, message.from, step, ctx, now);
      }
      await prisma.conversation.update({
        where: { id: conversation.id },
        data: { intake: step.data, intakeStep: null, ...waiting(now) },
      });
      const hours = ctx.advisorsOpen ? '' : `\n\nNuestros asesores atienden ${ADVISOR_HOURS_TEXT}.`;
      await say(
        conversation,
        message.from,
        { ...step.reply, text: step.reply.text + hours },
        phoneNumberId,
        now
      );
      await callAdvisors(institution, phoneNumberId, conversation, now, intakeKind);
      return 'waiting';
    }
  }

  // Un audio o una foto fuera de un formulario: todavía no se entienden.
  if (!message.choiceId && /^\[(audio|voice|image|video|document)\]$/.test(message.text)) {
    await say(conversation, message.from, MEDIA_REPLY, phoneNumberId, now);
    return 'answered';
  }

  if (message.choiceId === RESEND_ACCOUNT) {
    const resent = await resendAccountEmail({
      institutionId: institution.id,
      conversationId: conversation.id,
    });
    const text =
      resent === 'sent'
        ? 'Listo 📧 Te reenviamos el correo. Ábrelo y toca «Confirmar mi correo».'
        : resent === 'has_account'
          ? `Ya confirmaste tu correo 🙌 Entra en ${ctx.siteUrl}/ingresar`
          : 'No pude reenviarlo 😕 Escribe *asesor* y te ayudamos.';
    await say(conversation, message.from, { text }, phoneNumberId, now);
    return 'answered';
  }

  const choice = message.choiceId ?? (asksForMenu(message.text) ? null : intentFor(message.text));
  logger.info({
    event: 'whatsapp-intent',
    conversationId: conversation.id,
    source: message.choiceId ? 'choice' : 'text',
    choice: choice ?? 'none',
  });
  const student =
    choice === TOPICS.certificateRequest
      ? await linkedStudent(institution.id, conversation.id)
      : false;
  const reply = answerFor(choice, { ...ctx, student });

  if (reply?.handoff) {
    await prisma.conversation.update({ where: { id: conversation.id }, data: waiting(now) });
    await say(conversation, message.from, reply, phoneNumberId, now);
    await callAdvisors(institution, phoneNumberId, conversation, now);
    return 'waiting';
  }

  if (reply?.intake) {
    await prisma.conversation.update({
      where: { id: conversation.id },
      data: { intakeKind: reply.intake, intakeStep: 0, intake: {} },
    });
    await say(conversation, message.from, reply, phoneNumberId, now);
    return 'intake';
  }

  if (reply) {
    await say(conversation, message.from, reply, phoneNumberId, now);
    return 'answered';
  }

  // Dos veces seguidas sin entender: mejor una persona que otro saludo.
  const last =
    asksForMenu(message.text) || message.choiceId
      ? null
      : await prisma.conversationMessage.findFirst({
          where: { conversationId: conversation.id, direction: 'OUTBOUND', fromBot: true },
          orderBy: { createdAt: 'desc' },
          select: { body: true },
        });
  const hello = greeting(institution.name);
  const again = last?.body.startsWith(hello.text) || last?.body.startsWith(NOT_UNDERSTOOD.text);
  await say(conversation, message.from, again ? NOT_UNDERSTOOD : hello, phoneNumberId, now);
  return 'menu';
}

/** Terminó de pedir los datos de la cuenta (22/11): se crea y se le dice qué sigue. */
async function accountDone(
  institution: { id: string; whatsappAgentPhones: string[] },
  phoneNumberId: string,
  conversation: Conversation & { contactName: string | null },
  to: string,
  step: { data: IntakeData; reply: IntakeReply },
  ctx: { siteUrl: string },
  now: Date
): Promise<InboundOutcome> {
  await prisma.conversation.update({
    where: { id: conversation.id },
    data: { intake: { ...step.data, _accountAt: now.toISOString() }, intakeStep: null },
  });
  await say(conversation, to, step.reply, phoneNumberId, now);
  const result = await createAccountFromChat({
    institutionId: institution.id,
    conversationId: conversation.id,
    data: step.data,
    now,
  });
  const more = { id: 'opciones', title: 'Más opciones' };
  if (result.status === 'sent') {
    await say(
      conversation,
      to,
      {
        text: `Listo ✅ Te enviamos un correo a ${result.email}. Ábrelo y toca «Confirmar mi correo» para crear tu contraseña.${result.enrolled ? ' Al entrar ya tienes la etapa de introducción abierta para empezar.' : ''}\n\nSi no te llega en unos minutos, revisa la carpeta de spam o escríbenos por aquí.`,
        buttons: [more],
      },
      phoneNumberId,
      new Date(now.getTime() + 1)
    );
    return 'answered';
  }
  if (result.status === 'has_account') {
    await say(
      conversation,
      to,
      {
        text: `Ya tienes una cuenta con ese correo 🙌 Entra en ${ctx.siteUrl}/ingresar. Si no recuerdas la contraseña: ${ctx.siteUrl}/auth/recuperar`,
        buttons: [{ id: 'asesor', title: 'Hablar con asesor' }, more],
      },
      phoneNumberId,
      new Date(now.getTime() + 1)
    );
    return 'answered';
  }
  // Ficha sin cuenta o un fallo: lo resuelve una persona.
  await prisma.conversation.update({ where: { id: conversation.id }, data: waiting(now) });
  await say(
    conversation,
    to,
    {
      text:
        result.status === 'has_profile'
          ? 'Ese correo ya está registrado con nosotros. Un asesor te escribe por aquí para enviarte tu enlace de acceso.'
          : result.status === 'not_delivered'
            ? 'Creamos tu cuenta, pero no pudimos enviarte el correo 😕 Un asesor te escribe por aquí con tu enlace.'
            : 'No pudimos crear tu cuenta en este momento 😕 Un asesor te escribe por aquí para ayudarte.',
    },
    phoneNumberId,
    new Date(now.getTime() + 1)
  );
  await callAdvisors(institution, phoneNumberId, conversation, now, 'ACCOUNT');
  return 'waiting';
}
