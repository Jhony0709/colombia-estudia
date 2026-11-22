import 'server-only';

/**
 * La bandeja `/mensajes` (5/11): conversaciones por contacto, «Tomar chat», responder y cerrar.
 * Quien la toma es el único que responde hasta cerrarla. En WhatsApp solo se puede escribir
 * dentro de las 24 h desde su último mensaje; pasado eso, hace falta una plantilla.
 *
 * Las consultas van por el cliente base y llevan su `institutionId` a mano.
 */

import { createTenantClient, prisma } from '@/lib/db/tenant';
import { APIError } from '@/lib/core/errors';
import { SERVICE_WINDOW_MS, sendButtons, sendTemplate, sendText } from '@/lib/whatsapp/cloud-api';
import { logger } from '@/lib/observability/logger';
import { isBoldConfigured } from '@/lib/billing/bold';
import {
  createStaffLink,
  nextChargeOf,
  type PersonCharge,
} from '@/features/billing/server/account.service';
import { intakeSummary, type IntakeData, type IntakeKind } from '../intake';
import { CHANNEL_FEATURES, type MessagingChannel } from '../channels';
import { CSAT } from '../bot';

// El saludo y la despedida no detienen la acción: si no salen, queda en el log.
const logNotSent = (conversationId: string, err: unknown) =>
  logger.warn({ event: 'conversation-courtesy-not-sent', conversationId, error: String(err) });

export type ConversationView = 'waiting' | 'mine' | 'open' | 'bot' | 'closed';

const isUnattended = (row: { status: string; waitingSince: Date | null }) =>
  row.status === 'CLOSED' && row.waitingSince !== null;

export interface ConversationRow {
  id: string;
  contact: string;
  contactName: string | null;
  personName: string | null;
  status: 'BOT' | 'WAITING' | 'OPEN' | 'CLOSED';
  /** Se cerró sola tras 24 h esperando asesor (19/11): nadie la tomó. */
  unattended: boolean;
  assignedToName: string | null;
  /** ISO */
  lastMessageAt: string;
  lastMessage: { body: string; inbound: boolean } | null;
}

const fullName = (p: { givenName: string; familyName: string } | null) =>
  p ? `${p.givenName} ${p.familyName}` : null;

export async function listConversations({
  institutionId,
  personId,
  view,
}: {
  institutionId: string;
  personId: string;
  view: ConversationView;
}): Promise<ConversationRow[]> {
  const where =
    view === 'waiting'
      ? { status: 'WAITING' as const }
      : view === 'mine'
        ? { status: 'OPEN' as const, assignedToId: personId }
        : view === 'open'
          ? { status: 'OPEN' as const }
          : view === 'bot'
            ? { status: 'BOT' as const }
            : { status: 'CLOSED' as const };
  const rows = await prisma.conversation.findMany({
    where: { institutionId, ...where },
    // Lo que espera, el que más lleva esperando primero; lo demás, lo más reciente primero.
    orderBy: view === 'waiting' ? { waitingSince: 'asc' } : { lastMessageAt: 'desc' },
    take: 100,
    select: {
      id: true,
      contact: true,
      contactName: true,
      status: true,
      waitingSince: true,
      lastMessageAt: true,
      person: { select: { givenName: true, familyName: true } },
      assignedTo: { select: { givenName: true, familyName: true } },
      messages: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: { body: true, direction: true },
      },
    },
  });
  return rows.map((row) => ({
    id: row.id,
    contact: row.contact,
    contactName: row.contactName,
    personName: fullName(row.person),
    status: row.status,
    unattended: isUnattended(row),
    assignedToName: fullName(row.assignedTo),
    lastMessageAt: row.lastMessageAt.toISOString(),
    lastMessage: row.messages[0]
      ? { body: row.messages[0].body, inbound: row.messages[0].direction === 'INBOUND' }
      : null,
  }));
}

/**
 * Una huella barata de la bandeja o de un chat (19/11): la pantalla la consulta cada pocos
 * segundos y solo se vuelve a pedir entera cuando cambia.
 */
export async function conversationsPulse({
  institutionId,
  conversationId,
}: {
  institutionId: string;
  conversationId?: string;
}): Promise<string> {
  if (conversationId) {
    const row = await prisma.conversation.findFirst({
      where: { id: conversationId, institutionId },
      select: { status: true, assignedToId: true, lastMessageAt: true, personId: true },
    });
    return row
      ? [row.status, row.assignedToId, row.personId, row.lastMessageAt.getTime()].join('|')
      : '';
  }
  const [latest, byStatus] = await Promise.all([
    prisma.conversation.aggregate({ where: { institutionId }, _max: { lastMessageAt: true } }),
    prisma.conversation.groupBy({ by: ['status'], where: { institutionId }, _count: true }),
  ]);
  return [
    latest._max.lastMessageAt?.getTime() ?? 0,
    ...byStatus.map((s) => `${s.status}:${s._count}`).sort(),
  ].join('|');
}

export async function countWaitingConversations(institutionId: string): Promise<number> {
  return prisma.conversation.count({ where: { institutionId, status: 'WAITING' } });
}

export interface ConversationDetail extends ConversationRow {
  /** El código de la persona de la plataforma (`/personas/[code]`), si se encontró. */
  personCode: string | null;
  /** Lo que dejó por el chat (inscripción o certificado); `complete` = respondió todo. */
  intake: {
    kind: IntakeKind;
    complete: boolean;
    fields: Array<{ label: string; value: string }>;
    /** Cuándo autorizó el tratamiento de datos por el chat (Ley 1581), ISO. */
    consentAt: string | null;
  } | null;
  assignedToId: string | null;
  /** La próxima cuota de la persona enlazada, para mandarle el link de pago (19/11). */
  charge: (PersonCharge & { hasEmail: boolean }) | null;
  channel: MessagingChannel;
  /** Se le puede escribir libre: escribió en las últimas 24 h. */
  canReply: boolean;
  /** Fuera de las 24 h hay plantilla configurada para retomar la conversación (22/11). */
  canFollowUp: boolean;
  messages: Array<{
    id: string;
    inbound: boolean;
    body: string;
    authorName: string | null;
    fromBot: boolean;
    /** El mensaje que cita, recortado. */
    replyTo: { body: string; inbound: boolean } | null;
    /** Títulos de los botones de respuesta rápida que llevó. */
    buttons: string[];
    /** ISO */
    at: string;
  }>;
}

export async function getConversation({
  institutionId,
  conversationId,
  now = new Date(),
}: {
  institutionId: string;
  conversationId: string;
  now?: Date;
}): Promise<ConversationDetail | null> {
  const row = await prisma.conversation.findFirst({
    where: { id: conversationId, institutionId },
    select: {
      id: true,
      channel: true,
      contact: true,
      contactName: true,
      status: true,
      assignedToId: true,
      waitingSince: true,
      lastInboundAt: true,
      lastMessageAt: true,
      intakeKind: true,
      intakeStep: true,
      intake: true,
      person: { select: { id: true, givenName: true, familyName: true, code: true, email: true } },
      assignedTo: { select: { givenName: true, familyName: true } },
      messages: {
        orderBy: { createdAt: 'desc' },
        take: 200,
        select: {
          id: true,
          direction: true,
          body: true,
          fromBot: true,
          createdAt: true,
          buttons: true,
          author: { select: { givenName: true, familyName: true } },
          replyTo: { select: { body: true, direction: true } },
        },
      },
    },
  });
  if (!row) return null;
  const messages = [...row.messages].reverse();
  const last = messages.at(-1) ?? null;
  const charge =
    row.person && isBoldConfigured()
      ? await nextChargeOf({ institutionId, personId: row.person.id })
      : null;
  return {
    id: row.id,
    contact: row.contact,
    contactName: row.contactName,
    personName: fullName(row.person),
    status: row.status,
    unattended: isUnattended(row),
    personCode: row.person?.code ?? null,
    assignedToId: row.assignedToId,
    assignedToName: fullName(row.assignedTo),
    lastMessageAt: row.lastMessageAt.toISOString(),
    charge: charge ? { ...charge, hasEmail: Boolean(row.person?.email) } : null,
    intake: row.intakeKind
      ? {
          kind: row.intakeKind,
          complete: row.intakeStep === null,
          fields: intakeSummary(row.intakeKind, (row.intake ?? {}) as IntakeData),
          consentAt: ((row.intake ?? {}) as IntakeData)._consentAt ?? null,
        }
      : null,
    lastMessage: last ? { body: last.body, inbound: last.direction === 'INBOUND' } : null,
    channel: row.channel,
    canReply: inWindow(row.lastInboundAt, now),
    canFollowUp: !inWindow(row.lastInboundAt, now) && followUpTemplate(row.channel) !== null,
    messages: messages.map((m) => ({
      id: m.id,
      inbound: m.direction === 'INBOUND',
      body: m.body,
      authorName: fullName(m.author),
      fromBot: m.fromBot,
      replyTo: m.replyTo
        ? { body: m.replyTo.body.slice(0, 160), inbound: m.replyTo.direction === 'INBOUND' }
        : null,
      buttons: buttonTitles(m.buttons),
      at: m.createdAt.toISOString(),
    })),
  };
}

async function phoneNumberIdOf(institutionId: string): Promise<string | null> {
  const institution = await prisma.institution.findUnique({
    where: { id: institutionId },
    select: { whatsappPhoneNumberId: true },
  });
  return institution?.whatsappPhoneNumberId ?? null;
}

const OUT_OF_WINDOW =
  'Pasaron más de 24 horas desde su último mensaje: WhatsApp solo deja escribirle con una plantilla';

const inWindow = (lastInboundAt: Date | null, now: Date) =>
  lastInboundAt !== null && now.getTime() - lastInboundAt.getTime() < SERVICE_WINDOW_MS;

/** La plantilla para retomar un chat fuera de las 24 h; nula si no está configurada. */
const followUpTemplate = (channel: MessagingChannel) =>
  CHANNEL_FEATURES[channel].templates ? process.env.WHATSAPP_TEMPLATE_FOLLOW_UP || null : null;

const buttonTitles = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.flatMap((b) =>
        typeof b === 'object' && b !== null && typeof (b as { title?: unknown }).title === 'string'
          ? [(b as { title: string }).title]
          : []
      )
    : [];

/** Envía por el canal y lo guarda como de `actorId`. Sin enviar, no se guarda. */
async function deliver(
  conversation: { id: string; contact: string; lastInboundAt: Date | null },
  {
    institutionId,
    actorId,
    body,
    now,
    replyToId = null,
    buttons = [],
  }: {
    institutionId: string;
    actorId: string;
    body: string;
    now: Date;
    replyToId?: string | null;
    buttons?: string[];
  }
) {
  if (!inWindow(conversation.lastInboundAt, now)) throw new APIError(OUT_OF_WINDOW, 'CONFLICT');
  const quoted = replyToId
    ? await prisma.conversationMessage.findFirst({
        where: { id: replyToId, conversationId: conversation.id },
        select: { id: true, externalId: true },
      })
    : null;
  if (replyToId && !quoted)
    throw new APIError('Ese mensaje no es de este chat', 'VALIDATION_ERROR');
  const phoneNumberId = await phoneNumberIdOf(institutionId);
  // Los ids `agent:n` no chocan con los del menú del bot.
  const replies = buttons.map((title, i) => ({ id: `agent:${i + 1}`, title }));
  const result = replies.length
    ? await sendButtons(conversation.contact, body, replies, phoneNumberId, quoted?.externalId)
    : await sendText(conversation.contact, body, phoneNumberId, quoted?.externalId);
  if (!result.sent) {
    throw new APIError(`No se pudo enviar por WhatsApp (${result.reason})`, 'INTERNAL');
  }
  await prisma.$transaction([
    prisma.conversationMessage.create({
      data: {
        institutionId,
        conversationId: conversation.id,
        direction: 'OUTBOUND',
        body,
        authorId: actorId,
        externalId: result.id,
        ...(quoted ? { replyToId: quoted.id } : {}),
        ...(replies.length ? { buttons: replies } : {}),
        createdAt: now,
      },
    }),
    prisma.conversation.update({ where: { id: conversation.id }, data: { lastMessageAt: now } }),
  ]);
}

const CONVERSATION_SELECT = {
  id: true,
  channel: true,
  contact: true,
  status: true,
  assignedToId: true,
  lastInboundAt: true,
  assignedTo: { select: { givenName: true, familyName: true } },
} as const;

async function load(institutionId: string, conversationId: string) {
  const row = await prisma.conversation.findFirst({
    where: { id: conversationId, institutionId },
    select: CONVERSATION_SELECT,
  });
  if (!row) throw new APIError('Not found', 'NOT_FOUND');
  return row;
}

/**
 * «Tomar chat»: el primero gana. Se toma una que espera, una del bot o una cerrada; una que ya
 * atiende otra persona no (`CONFLICT` con su nombre). Le avisa a la persona quién la atiende.
 */
export async function takeConversation({
  institutionId,
  actorId,
  conversationId,
  now = new Date(),
}: {
  institutionId: string;
  actorId: string;
  conversationId: string;
  now?: Date;
}): Promise<{ status: 'OPEN' }> {
  const before = await load(institutionId, conversationId);
  if (before.status === 'OPEN' && before.assignedToId === actorId) return { status: 'OPEN' };

  const taken = await prisma.conversation.updateMany({
    where: { id: conversationId, institutionId, status: { in: ['WAITING', 'BOT', 'CLOSED'] } },
    data: { status: 'OPEN', assignedToId: actorId, assignedAt: now },
  });
  if (taken.count === 0) {
    const current = await load(institutionId, conversationId);
    const name = current.assignedTo ? current.assignedTo.givenName : 'otra persona';
    throw new APIError(`Este chat ya lo tomó ${name}`, 'CONFLICT');
  }
  await prisma.auditLog.create({
    data: {
      institutionId,
      actorId,
      entity: 'conversation',
      entityId: conversationId,
      action: 'taken',
      after: { from: before.status },
      occurredAt: now,
    },
  });

  const actor = await prisma.person.findFirst({
    where: { id: actorId, institutionId },
    select: { givenName: true },
  });
  // Dentro de las 24 h se presenta; fuera, no se puede escribir y se queda en la bandeja.
  if (
    before.lastInboundAt !== null &&
    now.getTime() - before.lastInboundAt.getTime() < SERVICE_WINDOW_MS
  ) {
    await deliver(before, {
      institutionId,
      actorId,
      body: `Hola, te escribe ${actor?.givenName ?? 'un asesor'} del equipo. ¿En qué te ayudo?`,
      now,
    }).catch((err: unknown) => logNotSent(conversationId, err));
  }
  return { status: 'OPEN' };
}

/** Responder: solo quien la tomó. Puede citar un mensaje y llevar botones, si el canal los admite. */
export async function replyToConversation({
  institutionId,
  actorId,
  conversationId,
  body,
  replyToId = null,
  buttons = [],
  now = new Date(),
}: {
  institutionId: string;
  actorId: string;
  conversationId: string;
  body: string;
  replyToId?: string | null;
  buttons?: string[];
  now?: Date;
}): Promise<{ sent: true }> {
  const conversation = await load(institutionId, conversationId);
  if (conversation.status !== 'OPEN' || conversation.assignedToId !== actorId) {
    throw new APIError('Solo responde quien tomó el chat', 'CONFLICT');
  }
  const features = CHANNEL_FEATURES[conversation.channel];
  if (replyToId && !features.quote) {
    throw new APIError('Este canal no permite citar mensajes', 'VALIDATION_ERROR');
  }
  const titles = buttons.map((b) => b.trim()).filter(Boolean);
  if (titles.length) {
    const limits = features.buttons;
    if (
      !limits ||
      titles.length > limits.max ||
      titles.some((t) => t.length > limits.titleMax) ||
      new Set(titles).size !== titles.length
    ) {
      throw new APIError('Botones no válidos para este canal', 'VALIDATION_ERROR');
    }
  }
  await deliver(conversation, {
    institutionId,
    actorId,
    body: body.trim(),
    now,
    replyToId,
    buttons: titles,
  });
  return { sent: true };
}

/**
 * Retomar un chat fuera de las 24 h (22/11): la plantilla de `WHATSAPP_TEMPLATE_FOLLOW_UP`, con
 * `{{1}}` = su nombre. Una por día: la ventana se abre cuando responda.
 */
export async function sendFollowUp({
  institutionId,
  actorId,
  conversationId,
  now = new Date(),
}: {
  institutionId: string;
  actorId: string;
  conversationId: string;
  now?: Date;
}): Promise<{ sent: true }> {
  const conversation = await prisma.conversation.findFirst({
    where: { id: conversationId, institutionId },
    select: {
      ...CONVERSATION_SELECT,
      contactName: true,
      person: { select: { givenName: true } },
    },
  });
  if (!conversation) throw new APIError('Not found', 'NOT_FOUND');
  if (conversation.status !== 'OPEN' || conversation.assignedToId !== actorId) {
    throw new APIError('Solo escribe quien tomó el chat', 'CONFLICT');
  }
  if (inWindow(conversation.lastInboundAt, now)) {
    throw new APIError('Escribió hace menos de 24 horas: respóndele normal', 'CONFLICT');
  }
  const template = followUpTemplate(conversation.channel);
  if (!template) throw new APIError('No hay plantilla para retomar chats', 'CONFLICT');
  const recent = await prisma.auditLog.findFirst({
    where: {
      institutionId,
      entity: 'conversation',
      entityId: conversationId,
      action: 'follow_up_sent',
      occurredAt: { gte: new Date(now.getTime() - SERVICE_WINDOW_MS) },
    },
    select: { id: true },
  });
  if (recent)
    throw new APIError('Ya se le envió la plantilla hoy; espera su respuesta', 'CONFLICT');

  const name = conversation.person?.givenName ?? conversation.contactName ?? 'hola';
  const result = await sendTemplate(conversation.contact, template, [name], {
    phoneNumberId: await phoneNumberIdOf(institutionId),
  });
  if (!result.sent) {
    throw new APIError(`No se pudo enviar por WhatsApp (${result.reason})`, 'INTERNAL');
  }
  await prisma.$transaction([
    prisma.conversationMessage.create({
      data: {
        institutionId,
        conversationId,
        direction: 'OUTBOUND',
        body: `Plantilla «${template}» para retomar la conversación.`,
        authorId: actorId,
        externalId: result.id,
        createdAt: now,
      },
    }),
    prisma.conversation.update({ where: { id: conversationId }, data: { lastMessageAt: now } }),
    prisma.auditLog.create({
      data: {
        institutionId,
        actorId,
        entity: 'conversation',
        entityId: conversationId,
        action: 'follow_up_sent',
        after: { template },
        occurredAt: now,
      },
    }),
  ]);
  return { sent: true };
}

/**
 * «Link de pago» (19/11): la próxima cuota de la persona enlazada, por Bold. `email` se lo envía
 * Bold a su correo; `chat` lo deja en WhatsApp, dentro de las 24 h. Solo quien tomó el chat.
 */
export async function sendPaymentLink({
  institutionId,
  actorId,
  conversationId,
  delivery,
  origin,
  now = new Date(),
}: {
  institutionId: string;
  actorId: string;
  conversationId: string;
  delivery: 'email' | 'chat';
  origin: string;
  now?: Date;
}): Promise<{ delivery: 'email' | 'chat'; amount: number }> {
  const conversation = await prisma.conversation.findFirst({
    where: { id: conversationId, institutionId },
    select: { ...CONVERSATION_SELECT, person: { select: { id: true, email: true } } },
  });
  if (!conversation) throw new APIError('Not found', 'NOT_FOUND');
  if (conversation.status !== 'OPEN' || conversation.assignedToId !== actorId) {
    throw new APIError('Solo cobra quien tomó el chat', 'CONFLICT');
  }
  if (!conversation.person) {
    throw new APIError('Este chat no está enlazado a una persona de la plataforma', 'CONFLICT');
  }
  // Antes de crear el link: fuera de las 24 h no habría cómo dejarlo en el chat.
  if (delivery === 'chat' && !inWindow(conversation.lastInboundAt, now)) {
    throw new APIError(OUT_OF_WINDOW, 'CONFLICT');
  }

  const link = await createStaffLink({
    institutionId,
    personId: conversation.person.id,
    delivery,
    payerEmail: conversation.person.email,
    origin,
    now,
  });
  if (delivery === 'chat') {
    await deliver(conversation, {
      institutionId,
      actorId,
      body: `Este es el link para pagar tu cuota ${link.position} ($${link.amount.toLocaleString('es-CO')}). Puedes pagar con tarjeta, PSE o Nequi, y vence en 24 horas:\n${link.url}`,
      now,
    });
  }
  await prisma.auditLog.create({
    data: {
      institutionId,
      actorId,
      entity: 'conversation',
      entityId: conversationId,
      action: 'payment_link_sent',
      after: { delivery, reference: link.reference, installmentId: link.installmentId },
      occurredAt: now,
    },
  });
  return { delivery, amount: link.amount };
}

/** La encuesta de cierre (22/11): tres botones; la respuesta la guarda `inbound.service.ts`. */
async function askRating(
  conversation: { id: string; contact: string; lastInboundAt: Date | null },
  institutionId: string,
  now: Date
) {
  if (!inWindow(conversation.lastInboundAt, now)) return;
  const result = await sendButtons(
    conversation.contact,
    CSAT.ask,
    CSAT.options,
    await phoneNumberIdOf(institutionId)
  );
  if (!result.sent) throw new Error(result.reason);
  await prisma.conversationMessage.create({
    data: {
      institutionId,
      conversationId: conversation.id,
      direction: 'OUTBOUND',
      body: CSAT.ask,
      fromBot: true,
      buttons: CSAT.options,
      externalId: result.id,
      createdAt: now,
    },
  });
}

/** Cerrar: quien la tomó. Se le avisa a la persona y la próxima vez la atiende el bot. */
export async function closeConversation({
  institutionId,
  actorId,
  conversationId,
  now = new Date(),
}: {
  institutionId: string;
  actorId: string;
  conversationId: string;
  now?: Date;
}): Promise<{ status: 'CLOSED' }> {
  const conversation = await load(institutionId, conversationId);
  if (conversation.status !== 'OPEN' || conversation.assignedToId !== actorId) {
    throw new APIError('Solo cierra quien tomó el chat', 'CONFLICT');
  }
  await deliver(conversation, {
    institutionId,
    actorId,
    body: 'Cerramos esta conversación. Si necesitas algo más, escríbenos cuando quieras.',
    now,
  }).catch((err: unknown) => logNotSent(conversationId, err));
  await askRating(conversation, institutionId, new Date(now.getTime() + 1)).catch((err: unknown) =>
    logNotSent(conversationId, err)
  );
  await prisma.$transaction([
    prisma.conversation.update({
      where: { id: conversationId },
      data: { status: 'CLOSED', waitingSince: null },
    }),
    prisma.auditLog.create({
      data: {
        institutionId,
        actorId,
        entity: 'conversation',
        entityId: conversationId,
        action: 'closed',
        occurredAt: now,
      },
    }),
  ]);
  return { status: 'CLOSED' };
}

/**
 * «Crear persona» desde los datos de inscripción del chat (14/11): la ficha en Personas con
 * nombre, correo y teléfono, el rol de estudiante, y la conversación enlazada. Si ya hay una
 * persona con ese correo, solo se enlaza. Después se invita y se matricula desde su ficha.
 */
export async function createPersonFromIntake({
  institutionId,
  actorId,
  conversationId,
}: {
  institutionId: string;
  actorId: string;
  conversationId: string;
}): Promise<{ personCode: string; created: boolean }> {
  const conversation = await prisma.conversation.findFirst({
    where: { id: conversationId, institutionId },
    select: { personId: true, intakeKind: true, intakeStep: true, intake: true },
  });
  if (!conversation) throw new APIError('Conversation not found', 'NOT_FOUND');
  if (conversation.intakeKind !== 'ENROLL' || conversation.intakeStep !== null) {
    throw new APIError('Este chat no tiene datos de inscripción completos', 'CONFLICT');
  }
  const db = createTenantClient(institutionId);
  if (conversation.personId) {
    const linked = await db.person.findUniqueOrThrow({
      where: { id: conversation.personId },
      select: { code: true },
    });
    return { personCode: linked.code, created: false };
  }

  const data = (conversation.intake ?? {}) as IntakeData;
  const email = data.email?.trim().toLowerCase() ?? '';
  const [givenName = '', ...rest] = (data.fullName ?? '').trim().split(/\s+/);
  if (!email || !givenName) throw new APIError('Faltan el nombre o el correo', 'VALIDATION_ERROR');

  const existing = await db.person.findFirst({
    where: { email, anonymizedAt: null },
    select: { id: true, code: true },
  });
  const person =
    existing ??
    (await db.$transaction(async (tx) => {
      const created = await tx.person.create({
        data: {
          institutionId,
          givenName,
          familyName: rest.join(' ') || '—',
          email,
          phone: data.phone ?? null,
        },
        select: { id: true, code: true },
      });
      await tx.membership.create({
        data: { institutionId, personId: created.id, role: 'STUDENT' },
      });
      await tx.auditLog.create({
        data: {
          institutionId,
          actorId,
          entity: 'person',
          entityId: created.id,
          action: 'created_from_whatsapp',
          after: { conversationId },
        },
      });
      return created;
    }));
  await prisma.conversation.update({
    where: { id: conversationId },
    data: { personId: person.id },
  });
  // El código lo asigna un trigger al insertar: se relee si el `create` no lo devolvió.
  const code =
    person.code ||
    (await db.person.findUniqueOrThrow({ where: { id: person.id }, select: { code: true } })).code;
  return { personCode: code, created: !existing };
}
