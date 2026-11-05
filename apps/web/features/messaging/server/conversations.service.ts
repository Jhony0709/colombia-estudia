import 'server-only';

/**
 * La bandeja `/mensajes` (5/11): conversaciones por contacto, «Tomar chat», responder y cerrar.
 * Quien la toma es el único que responde hasta cerrarla. En WhatsApp solo se puede escribir
 * dentro de las 24 h desde su último mensaje; pasado eso, hace falta una plantilla.
 *
 * `Conversation` y `ConversationMessage` todavía no están en `TENANT_SCOPED_MODELS`: cada
 * consulta lleva su `institutionId` a mano.
 */

import { prisma } from '@/lib/db/tenant';
import { APIError } from '@/lib/core/errors';
import { SERVICE_WINDOW_MS, sendText } from '@/lib/whatsapp/cloud-api';
import { logger } from '@/lib/observability/logger';

// El saludo y la despedida no detienen la acción: si no salen, queda en el log.
const logNotSent = (conversationId: string, err: unknown) =>
  logger.warn({ event: 'conversation-courtesy-not-sent', conversationId, error: String(err) });

export type ConversationView = 'waiting' | 'mine' | 'open' | 'bot' | 'closed';

export interface ConversationRow {
  id: string;
  contact: string;
  contactName: string | null;
  personName: string | null;
  status: 'BOT' | 'WAITING' | 'OPEN' | 'CLOSED';
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
    assignedToName: fullName(row.assignedTo),
    lastMessageAt: row.lastMessageAt.toISOString(),
    lastMessage: row.messages[0]
      ? { body: row.messages[0].body, inbound: row.messages[0].direction === 'INBOUND' }
      : null,
  }));
}

export async function countWaitingConversations(institutionId: string): Promise<number> {
  return prisma.conversation.count({ where: { institutionId, status: 'WAITING' } });
}

export interface ConversationDetail extends ConversationRow {
  /** El código de la persona de la plataforma (`/personas/[code]`), si se encontró. */
  personCode: string | null;
  assignedToId: string | null;
  /** Se le puede escribir libre: escribió en las últimas 24 h. */
  canReply: boolean;
  messages: Array<{
    id: string;
    inbound: boolean;
    body: string;
    authorName: string | null;
    fromBot: boolean;
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
      contact: true,
      contactName: true,
      status: true,
      assignedToId: true,
      lastInboundAt: true,
      lastMessageAt: true,
      person: { select: { givenName: true, familyName: true, code: true } },
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
          author: { select: { givenName: true, familyName: true } },
        },
      },
    },
  });
  if (!row) return null;
  const messages = [...row.messages].reverse();
  const last = messages.at(-1) ?? null;
  return {
    id: row.id,
    contact: row.contact,
    contactName: row.contactName,
    personName: fullName(row.person),
    status: row.status,
    personCode: row.person?.code ?? null,
    assignedToId: row.assignedToId,
    assignedToName: fullName(row.assignedTo),
    lastMessageAt: row.lastMessageAt.toISOString(),
    lastMessage: last ? { body: last.body, inbound: last.direction === 'INBOUND' } : null,
    canReply:
      row.lastInboundAt !== null && now.getTime() - row.lastInboundAt.getTime() < SERVICE_WINDOW_MS,
    messages: messages.map((m) => ({
      id: m.id,
      inbound: m.direction === 'INBOUND',
      body: m.body,
      authorName: fullName(m.author),
      fromBot: m.fromBot,
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

/** Envía por el canal y lo guarda como de `actorId`. Sin enviar, no se guarda. */
async function deliver(
  conversation: { id: string; contact: string; lastInboundAt: Date | null },
  {
    institutionId,
    actorId,
    body,
    now,
  }: { institutionId: string; actorId: string; body: string; now: Date }
) {
  if (
    conversation.lastInboundAt === null ||
    now.getTime() - conversation.lastInboundAt.getTime() >= SERVICE_WINDOW_MS
  ) {
    throw new APIError(
      'Pasaron más de 24 horas desde su último mensaje: WhatsApp solo deja escribirle con una plantilla',
      'CONFLICT'
    );
  }
  const result = await sendText(conversation.contact, body, await phoneNumberIdOf(institutionId));
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
        createdAt: now,
      },
    }),
    prisma.conversation.update({ where: { id: conversation.id }, data: { lastMessageAt: now } }),
  ]);
}

const CONVERSATION_SELECT = {
  id: true,
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

/** Responder: solo quien la tomó. */
export async function replyToConversation({
  institutionId,
  actorId,
  conversationId,
  body,
  now = new Date(),
}: {
  institutionId: string;
  actorId: string;
  conversationId: string;
  body: string;
  now?: Date;
}): Promise<{ sent: true }> {
  const conversation = await load(institutionId, conversationId);
  if (conversation.status !== 'OPEN' || conversation.assignedToId !== actorId) {
    throw new APIError('Solo responde quien tomó el chat', 'CONFLICT');
  }
  await deliver(conversation, { institutionId, actorId, body: body.trim(), now });
  return { sent: true };
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
