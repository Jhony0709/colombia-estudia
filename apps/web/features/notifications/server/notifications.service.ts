/**
 * Notificaciones: crear, listar, marcar leída.
 * SSOT: plan/06-cohortes-y-personas.md:65-70 (§7), endpoints.md:34, plan/11-ux.md:77-80.
 *
 * `notify` es el único sitio donde se escribe una `Notification`. Antes había un
 * `createMany` suelto dentro de `requestNewInvitation`, y así es como dos avisos acaban
 * con formatos distintos y uno de los dos sin `dedupeKey`.
 *
 * Sobre el correo: el plan dice "envío inmediato, best effort, con reintento en el job".
 * El job es de una fase posterior, así que aquí está la mitad que existe — el envío
 * inmediato que **nunca** tumba la operación que lo disparó. Una matrícula no puede
 * fallar porque Resend esté caído.
 */

import 'server-only';

import type { Role } from '@colombia-estudia/domain';
import { prisma, createTenantClient } from '@/lib/db/tenant';
import { logger } from '@/lib/observability/logger';
import { APIError } from '@/lib/core/errors';

/**
 * Los tipos que el producto conoce. `Notification.type` es `String` en el schema, así que
 * esta unión es la única barrera contra que cada sitio invente el suyo.
 */
export const NOTIFICATION_TYPES = [
  'reinvite_requested',
  'invitation_failed',
  'enrollment_created',
  'submission_returned',
  'submission_received',
  'submission_approved',
  'attempt_graded',
  'certificate_issued',
  'problem_reported',
  'payment_confirmed',
  'payment_failed',
  'agreement_signed',
  'overdue_reminder',
  'agreement_overdue',
  'live_session_soon',
] as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export interface NotifyInput {
  personId: string;
  type: NotificationType;
  title: string;
  body: string;
  href?: string | null;
  /**
   * Evita el aviso repetido. `@@unique([personId, dedupeKey])` lo garantiza en la base;
   * sin él, un job que corre cada hora deja veinticuatro avisos iguales al día.
   */
  dedupeKey?: string | null;
}

export interface NotificationListItem {
  id: string;
  type: string;
  title: string;
  body: string;
  href: string | null;
  readAt: string | null;
  createdAt: string;
}

/** Crea el aviso. Devuelve `false` si el `dedupeKey` ya existía y no se creó nada. */
export async function notify(
  institutionId: string,
  input: NotifyInput
): Promise<{ created: boolean }> {
  const db = createTenantClient(institutionId);

  const result = await db.notification.createMany({
    data: [
      {
        institutionId,
        personId: input.personId,
        type: input.type,
        title: input.title,
        body: input.body,
        href: input.href ?? null,
        dedupeKey: input.dedupeKey ?? null,
      },
    ],
    skipDuplicates: true,
  });

  return { created: result.count > 0 };
}

/** El mismo aviso para varias personas: el caso de avisar a todo el equipo de operaciones. */
export async function notifyMany(
  institutionId: string,
  personIds: string[],
  input: Omit<NotifyInput, 'personId'>
): Promise<{ created: number }> {
  if (personIds.length === 0) return { created: 0 };

  const db = createTenantClient(institutionId);

  const result = await db.notification.createMany({
    data: personIds.map((personId) => ({
      institutionId,
      personId,
      type: input.type,
      title: input.title,
      body: input.body,
      href: input.href ?? null,
      dedupeKey: input.dedupeKey ?? null,
    })),
    skipDuplicates: true,
  });

  return { created: result.count };
}

/**
 * Las personas de la institución con uno de esos roles, para avisar al equipo.
 *
 * Usa `prisma` y no el cliente con tenant porque hay un llamador público sin sesión
 * (`requestNewInvitation`), así que el `institutionId` viaja explícito en el `where`.
 */
export async function staffPersonIds(
  institutionId: string,
  roles: readonly Role[]
): Promise<string[]> {
  const memberships = await prisma.membership.findMany({
    where: { institutionId, role: { in: [...roles] }, revokedAt: null },
    select: { personId: true },
  });

  return [...new Set(memberships.map((m) => m.personId))];
}

/** Igual que `notifyMany`, para el flujo público que no tiene contexto de petición. */
export async function notifyManyWithoutContext(
  institutionId: string,
  personIds: string[],
  input: Omit<NotifyInput, 'personId'>
): Promise<{ created: number }> {
  if (personIds.length === 0) return { created: 0 };

  const result = await prisma.notification.createMany({
    data: personIds.map((personId) => ({
      institutionId,
      personId,
      type: input.type,
      title: input.title,
      body: input.body,
      href: input.href ?? null,
      dedupeKey: input.dedupeKey ?? null,
    })),
    skipDuplicates: true,
  });

  return { created: result.count };
}

const iso = (date: Date) => date.toISOString();

/**
 * Los avisos de una persona, los nuevos primero.
 *
 * Sin paginación: el centro de notificaciones no es un archivo histórico. Se devuelven
 * los últimos `limit` y se acabó; lo que importa de verdad ya tiene su pantalla.
 */
export async function listNotifications({
  institutionId,
  personId,
  limit = 50,
}: {
  institutionId: string;
  personId: string;
  limit?: number;
}): Promise<{ items: NotificationListItem[]; unread: number }> {
  const db = createTenantClient(institutionId);

  const [rows, unread] = await Promise.all([
    db.notification.findMany({
      where: { personId },
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 100),
      select: {
        id: true,
        type: true,
        title: true,
        body: true,
        href: true,
        readAt: true,
        createdAt: true,
      },
    }),
    db.notification.count({ where: { personId, readAt: null } }),
  ]);

  return {
    items: rows.map((row) => ({
      id: row.id,
      type: row.type,
      title: row.title,
      body: row.body,
      href: row.href,
      readAt: row.readAt ? iso(row.readAt) : null,
      createdAt: iso(row.createdAt),
    })),
    unread,
  };
}

export async function countUnread({
  institutionId,
  personId,
}: {
  institutionId: string;
  personId: string;
}): Promise<number> {
  const db = createTenantClient(institutionId);
  return db.notification.count({ where: { personId, readAt: null } });
}

/**
 * Marca una notificación como leída.
 *
 * El `where` lleva el `personId` además del id: sin él, cualquiera con una sesión válida
 * podría marcar leída la notificación de otra persona pasando su id. No audita — marcar
 * leído es del dueño y sobre sí mismo.
 */
export async function markRead({
  institutionId,
  personId,
  notificationId,
  now = new Date(),
}: {
  institutionId: string;
  personId: string;
  notificationId: string;
  now?: Date;
}): Promise<{ readAt: string }> {
  const db = createTenantClient(institutionId);

  const result = await db.notification.updateMany({
    where: { id: notificationId, personId, readAt: null },
    data: { readAt: now },
  });

  if (result.count === 0) {
    // Ya estaba leída, o no es suya. No se distinguen: decir "esa no es tuya" confirma
    // que existe.
    const exists = await db.notification.findFirst({
      where: { id: notificationId, personId },
      select: { readAt: true },
    });
    if (!exists) throw new APIError('Notification not found', 'NOT_FOUND');
    return { readAt: iso(exists.readAt ?? now) };
  }

  return { readAt: iso(now) };
}

/** Marca leídas todas las de la persona. */
export async function markAllRead({
  institutionId,
  personId,
  now = new Date(),
}: {
  institutionId: string;
  personId: string;
  now?: Date;
}): Promise<{ marked: number }> {
  const db = createTenantClient(institutionId);

  const result = await db.notification.updateMany({
    where: { personId, readAt: null },
    data: { readAt: now },
  });

  return { marked: result.count };
}

/**
 * Envío de correo que no puede tumbar a quien lo llama.
 *
 * Se registra el fallo y se sigue. Cuando exista el job de reintentos (fase posterior)
 * este es el punto donde encolar en vez de tragarse el error.
 */
export async function sendBestEffort(
  send: () => Promise<unknown>,
  context: Record<string, string>
): Promise<{ sent: boolean }> {
  try {
    await send();
    return { sent: true };
  } catch (error) {
    logger.error(
      { ...context, err: error instanceof Error ? error.message : String(error) },
      'notification email failed'
    );
    return { sent: false };
  }
}
