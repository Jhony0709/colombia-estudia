/**
 * El push a la app (27/11; reference/03-ui/movil.md, «Push»): la entrega de un aviso de la
 * campana a cada teléfono de la persona, por el servicio de Expo. Usa `prisma` y no el cliente
 * con tenant: el cron envía lo de todas las instituciones; lo de una persona lleva su
 * `institutionId` en el `where`.
 */

import 'server-only';

import { prisma } from '@/lib/db/tenant';
import { logger } from '@/lib/observability/logger';
import { advisorsOpen } from '@/features/messaging/facts';

/** Los avisos que salen por push y su canal de Android. Lo demás, solo la campana. */
export const PUSH_CHANNEL: Record<string, 'mensajes' | 'solicitudes'> = {
  conversation_message: 'mensajes',
  conversation_waiting: 'mensajes',
  enrollment_requested: 'solicitudes',
  unlock_requested: 'solicitudes',
  attempt_requested: 'solicitudes',
};

const EXPO = 'https://exp.host/--/api/v2/push';
/** Lo que Expo admite por petición (docs.expo.dev/push-notifications/sending-notifications). */
const BATCH = 100;
const RECEIPTS = 1000;
export const MAX_ATTEMPTS = 5;
/** Mientras se envía, la fila queda apartada: si el proceso muere, vuelve a salir. */
const LEASE_MS = 2 * 60_000;
/** Expo recomienda leer el recibo a los 15 min y lo borra a las 24 h. */
const RECEIPT_AFTER_MS = 15 * 60_000;
const RECEIPT_GONE_MS = 24 * 60 * 60_000;
const KEEP_MS = 7 * 24 * 60 * 60_000;

const backoff = (attempts: number) => 2 ** attempts * 60_000;

/** El teléfono pasa a ser de quien entra; lo pendiente de quien lo usaba antes no le llega. */
export async function registerDevice({
  institutionId,
  personId,
  token,
  platform,
  now = new Date(),
}: {
  institutionId: string;
  personId: string;
  token: string;
  platform: 'IOS' | 'ANDROID';
  now?: Date;
}): Promise<{ registered: true }> {
  await prisma.$transaction([
    prisma.pushDevice.deleteMany({ where: { token, NOT: { personId } } }),
    prisma.pushDevice.upsert({
      where: { token },
      create: { institutionId, personId, token, platform, lastSeenAt: now },
      update: { platform, lastSeenAt: now },
    }),
  ]);
  return { registered: true };
}

/** Al cerrar sesión. El `personId` va en el `where`: nadie borra el teléfono de otro. */
export async function removeDevice({
  institutionId,
  personId,
  token,
}: {
  institutionId: string;
  personId: string;
  token: string;
}): Promise<{ removed: boolean }> {
  const { count } = await prisma.pushDevice.deleteMany({
    where: { institutionId, personId, token },
  });
  return { removed: count > 0 };
}

/** Una entrega por teléfono de cada persona avisada. Fuera del horario de asesores, ninguna. */
async function enqueue(
  institutionId: string,
  type: string,
  created: { id: string; personId: string }[],
  now: Date
): Promise<number> {
  if (!(type in PUSH_CHANNEL) || created.length === 0 || !advisorsOpen(now)) return 0;
  const notificationOf = new Map(created.map((row) => [row.personId, row.id]));
  const devices = await prisma.pushDevice.findMany({
    where: { institutionId, personId: { in: [...notificationOf.keys()] } },
    select: { id: true, personId: true },
  });
  if (devices.length === 0) return 0;
  const { count } = await prisma.pushDelivery.createMany({
    data: devices.map((device) => ({
      institutionId,
      notificationId: notificationOf.get(device.personId)!,
      deviceId: device.id,
    })),
    skipDuplicates: true,
  });
  return count;
}

/**
 * Tras crear avisos: sus entregas y un primer envío. Nada de aquí llega a quien avisa: una
 * solicitud no puede fallar porque Expo esté caído, y el cron reintenta lo que quede.
 */
export async function pushCreated(
  institutionId: string,
  type: string,
  created: { id: string; personId: string }[],
  now: Date = new Date()
): Promise<void> {
  try {
    if ((await enqueue(institutionId, type, created, now)) > 0) await sendDue(now);
  } catch (error) {
    logger.error({ event: 'push-failed', err: error instanceof Error ? error.message : error });
  }
}

interface Ticket {
  status: 'ok' | 'error';
  id?: string;
  message?: string;
  details?: { error?: string };
}

async function expo<T>(path: string, body: unknown): Promise<T> {
  const token = process.env.EXPO_ACCESS_TOKEN;
  const res = await fetch(`${EXPO}/${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) throw new Error(`expo ${path} ${res.status}`);
  return ((await res.json()) as { data: T }).data;
}

/** Expo da el token de baja: el teléfono ya no tiene la app, y sus entregas se van con él. */
const forget = (deviceId: string) => prisma.pushDevice.deleteMany({ where: { id: deviceId } });

/** Reintenta más tarde, o lo deja por imposible. */
const failed = (id: string, attempts: number, error: string, now: Date, retry = true) =>
  prisma.pushDelivery.updateMany({
    where: { id },
    data:
      retry && attempts < MAX_ATTEMPTS
        ? { error, runAfter: new Date(now.getTime() + backoff(attempts)) }
        : { error, status: 'DEAD' },
  });

interface PushReport {
  sent: number;
  failed: number;
}

/** Envía lo pendiente. Lo llama quien avisa y, cada minuto, el cron. */
export async function sendDue(now: Date = new Date()): Promise<PushReport> {
  const report: PushReport = { sent: 0, failed: 0 };
  const due = await prisma.pushDelivery.findMany({
    where: { status: 'PENDING', runAfter: { lte: now } },
    orderBy: { createdAt: 'asc' },
    take: BATCH,
    select: {
      id: true,
      attempts: true,
      deviceId: true,
      device: { select: { token: true } },
      notification: {
        select: { id: true, type: true, title: true, body: true, href: true },
      },
    },
  });

  // Fila a fila y con la condición en el `where`: si otro envío la tomó antes, aquí cuenta 0.
  const lease = new Date(now.getTime() + LEASE_MS);
  const mine: typeof due = [];
  for (const row of due) {
    const { count } = await prisma.pushDelivery.updateMany({
      where: { id: row.id, status: 'PENDING', runAfter: { lte: now } },
      data: { runAfter: lease, attempts: { increment: 1 } },
    });
    if (count === 1) mine.push({ ...row, attempts: row.attempts + 1 });
  }
  if (mine.length === 0) return report;

  let tickets: Ticket[];
  try {
    tickets = await expo<Ticket[]>(
      'send',
      mine.map(({ device, notification }) => ({
        to: device.token,
        title: notification.title,
        body: notification.body,
        sound: 'default',
        priority: 'high',
        channelId: PUSH_CHANNEL[notification.type],
        data: { href: notification.href, notificationId: notification.id },
      }))
    );
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'expo';
    for (const row of mine) await failed(row.id, row.attempts, reason, now);
    report.failed = mine.length;
    return report;
  }

  for (const [index, row] of mine.entries()) {
    const ticket = tickets[index];
    if (ticket?.status === 'ok' && ticket.id) {
      await prisma.pushDelivery.updateMany({
        where: { id: row.id },
        data: { status: 'SENT', ticketId: ticket.id, sentAt: now, error: null },
      });
      report.sent += 1;
      continue;
    }
    report.failed += 1;
    const reason = ticket?.details?.error ?? ticket?.message ?? 'sin ticket';
    if (reason === 'DeviceNotRegistered') await forget(row.deviceId);
    // Solo el límite de ritmo se arregla esperando; credenciales o tamaño, no.
    else await failed(row.id, row.attempts, reason, now, reason === 'MessageRateExceeded');
  }
  return report;
}

/** El recibo dice si Apple o Google lo aceptaron: ahí es donde llega la mayoría de las bajas. */
export async function checkReceipts(now: Date = new Date()): Promise<{ checked: number }> {
  const sent = await prisma.pushDelivery.findMany({
    where: { status: 'SENT', sentAt: { lte: new Date(now.getTime() - RECEIPT_AFTER_MS) } },
    take: RECEIPTS,
    select: { id: true, ticketId: true, deviceId: true, sentAt: true },
  });
  if (sent.length === 0) return { checked: 0 };

  const receipts = await expo<Record<string, Ticket>>('getReceipts', {
    ids: sent.map((row) => row.ticketId),
  });
  for (const row of sent) {
    const receipt = receipts[row.ticketId!];
    if (receipt?.status === 'ok') {
      await prisma.pushDelivery.updateMany({ where: { id: row.id }, data: { status: 'DONE' } });
    } else if (receipt?.details?.error === 'DeviceNotRegistered') {
      await forget(row.deviceId);
    } else if (receipt || now.getTime() - row.sentAt!.getTime() > RECEIPT_GONE_MS) {
      const error = receipt?.details?.error ?? receipt?.message ?? 'sin recibo';
      await prisma.pushDelivery.updateMany({
        where: { id: row.id },
        data: { status: 'DEAD', error },
      });
    }
  }
  return { checked: sent.length };
}

/** Lo de cada minuto (`/api/jobs/waiting-chats`): reintentos, recibos y limpieza. */
export async function runPushSweep(
  now: Date = new Date()
): Promise<PushReport & { checked: number }> {
  const report = await sendDue(now);
  const { checked } = await checkReceipts(now);
  await prisma.pushDelivery.deleteMany({
    where: {
      status: { in: ['DONE', 'DEAD'] },
      createdAt: { lt: new Date(now.getTime() - KEEP_MS) },
    },
  });
  return { ...report, checked };
}
