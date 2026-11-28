/** @jest-environment node */
/**
 * El push a la app (27/11; reference/03-ui/movil.md, «Push»): qué avisos salen, a qué teléfonos,
 * y qué pasa con lo que Expo acepta, rechaza o da de baja.
 */

const db = {
  pushDevice: { findMany: jest.fn(), deleteMany: jest.fn(), upsert: jest.fn() },
  pushDelivery: {
    createMany: jest.fn(),
    findMany: jest.fn(),
    updateMany: jest.fn(),
    deleteMany: jest.fn(),
  },
  $transaction: jest.fn(async (steps: unknown[]) => steps),
};

jest.mock('server-only', () => ({}));
// Un getter: la fábrica se iza por encima de `db` y no puede leerlo al construirse.
jest.mock('@/lib/db/tenant', () => ({
  get prisma() {
    return db;
  },
}));
jest.mock('@/lib/observability/logger', () => ({ logger: { error: jest.fn() } }));

import { logger } from '@/lib/observability/logger';
import { NOTIFICATION_TYPES } from '@/features/notifications/server/notifications.service';
import {
  MAX_ATTEMPTS,
  PUSH_CHANNEL,
  checkReceipts,
  pushCreated,
  registerDevice,
  removeDevice,
  sendDue,
} from '@/features/notifications/server/push.service';

// Jueves 26/11 a las 10:00 de Bogotá: hay asesores. A las 23:00, no.
const OPEN = new Date('2026-11-26T15:00:00.000Z');
const NIGHT = new Date('2026-11-27T04:00:00.000Z');
const created = [{ id: 'n-1', personId: 'p-1' }];
const due = (over: Record<string, unknown> = {}) => ({
  id: 'd-1',
  attempts: 0,
  deviceId: 'dev-1',
  device: { token: 'ExponentPushToken[a]' },
  notification: {
    id: 'n-1',
    type: 'conversation_message',
    title: 'Mensaje de Ana',
    body: 'Hola',
    href: '/mensajes/c-1',
  },
  ...over,
});
const expoAnswers = (data: unknown, ok = true) =>
  jest.fn(async () => ({ ok, status: ok ? 200 : 503, json: async () => ({ data }) }));
const sentBody = (fetchMock: jest.Mock) => JSON.parse(fetchMock.mock.calls[0][1].body);

beforeEach(() => {
  jest.clearAllMocks();
  db.pushDevice.findMany.mockResolvedValue([{ id: 'dev-1', personId: 'p-1' }]);
  db.pushDelivery.createMany.mockResolvedValue({ count: 1 });
  db.pushDelivery.findMany.mockResolvedValue([due()]);
  db.pushDelivery.updateMany.mockResolvedValue({ count: 1 });
  global.fetch = expoAnswers([{ status: 'ok', id: 't-1' }]) as unknown as typeof fetch;
  delete process.env.EXPO_ACCESS_TOKEN;
});

describe('PUSH_CHANNEL', () => {
  it('only names notification types that exist', () => {
    for (const type of Object.keys(PUSH_CHANNEL)) expect(NOTIFICATION_TYPES).toContain(type);
  });
});

describe('pushCreated', () => {
  it('queues one delivery per phone of whoever was told, and sends it', async () => {
    await pushCreated('inst-1', 'conversation_message', created, OPEN);
    expect(db.pushDevice.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { institutionId: 'inst-1', personId: { in: ['p-1'] } } })
    );
    expect(db.pushDelivery.createMany).toHaveBeenCalledWith({
      data: [{ institutionId: 'inst-1', notificationId: 'n-1', deviceId: 'dev-1' }],
      skipDuplicates: true,
    });
    expect(sentBody(global.fetch as jest.Mock)).toEqual([
      {
        to: 'ExponentPushToken[a]',
        title: 'Mensaje de Ana',
        body: 'Hola',
        sound: 'default',
        priority: 'high',
        channelId: 'mensajes',
        data: { href: '/mensajes/c-1', notificationId: 'n-1' },
      },
    ]);
  });

  it('sends nothing outside the hours of the advisors', async () => {
    await pushCreated('inst-1', 'conversation_message', created, NIGHT);
    expect(db.pushDelivery.createMany).not.toHaveBeenCalled();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('leaves the other notices to the bell', async () => {
    await pushCreated('inst-1', 'payment_confirmed', created, OPEN);
    expect(db.pushDevice.findMany).not.toHaveBeenCalled();
  });

  it('never fails whoever notified', async () => {
    db.pushDevice.findMany.mockRejectedValue(new Error('db down'));
    await expect(
      pushCreated('inst-1', 'conversation_message', created, OPEN)
    ).resolves.toBeUndefined();
    expect(logger.error).toHaveBeenCalled();
  });
});

describe('sendDue', () => {
  it('marks what Expo took as sent, with its ticket', async () => {
    expect(await sendDue(OPEN)).toEqual({ sent: 1, failed: 0 });
    expect(db.pushDelivery.updateMany).toHaveBeenLastCalledWith({
      where: { id: 'd-1' },
      data: { status: 'SENT', ticketId: 't-1', sentAt: OPEN, error: null },
    });
  });

  it('does not send a row another sender claimed first', async () => {
    db.pushDelivery.updateMany.mockResolvedValue({ count: 0 });
    expect(await sendDue(OPEN)).toEqual({ sent: 0, failed: 0 });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('retries later when Expo is down', async () => {
    global.fetch = expoAnswers(null, false) as unknown as typeof fetch;
    expect(await sendDue(OPEN)).toEqual({ sent: 0, failed: 1 });
    // Primer intento: dos minutos después.
    expect(db.pushDelivery.updateMany).toHaveBeenLastCalledWith({
      where: { id: 'd-1' },
      data: { error: 'expo send 503', runAfter: new Date(OPEN.getTime() + 2 * 60_000) },
    });
  });

  it('gives up after the last attempt', async () => {
    db.pushDelivery.findMany.mockResolvedValue([due({ attempts: MAX_ATTEMPTS - 1 })]);
    global.fetch = expoAnswers(null, false) as unknown as typeof fetch;
    await sendDue(OPEN);
    expect(db.pushDelivery.updateMany).toHaveBeenLastCalledWith({
      where: { id: 'd-1' },
      data: { error: 'expo send 503', status: 'DEAD' },
    });
  });

  it('forgets a phone Expo no longer knows', async () => {
    global.fetch = expoAnswers([
      { status: 'error', message: 'gone', details: { error: 'DeviceNotRegistered' } },
    ]) as unknown as typeof fetch;
    expect(await sendDue(OPEN)).toEqual({ sent: 0, failed: 1 });
    expect(db.pushDevice.deleteMany).toHaveBeenCalledWith({ where: { id: 'dev-1' } });
  });

  it('does not retry what waiting will not fix', async () => {
    global.fetch = expoAnswers([
      { status: 'error', message: 'bad', details: { error: 'InvalidCredentials' } },
    ]) as unknown as typeof fetch;
    await sendDue(OPEN);
    expect(db.pushDelivery.updateMany).toHaveBeenLastCalledWith({
      where: { id: 'd-1' },
      data: { error: 'InvalidCredentials', status: 'DEAD' },
    });
  });

  it('sends the access token when there is one', async () => {
    process.env.EXPO_ACCESS_TOKEN = 'test-token';
    await sendDue(OPEN);
    const headers = (global.fetch as jest.Mock).mock.calls[0][1].headers;
    expect(headers.authorization).toBe('Bearer test-token');
  });
});

describe('checkReceipts', () => {
  const sent = { id: 'd-1', ticketId: 't-1', deviceId: 'dev-1', sentAt: new Date(OPEN) };
  const later = new Date(OPEN.getTime() + 20 * 60_000);

  it('closes what the phone service accepted', async () => {
    db.pushDelivery.findMany.mockResolvedValue([sent]);
    global.fetch = expoAnswers({ 't-1': { status: 'ok' } }) as unknown as typeof fetch;
    expect(await checkReceipts(later)).toEqual({ checked: 1 });
    expect(sentBody(global.fetch as jest.Mock)).toEqual({ ids: ['t-1'] });
    expect(db.pushDelivery.updateMany).toHaveBeenCalledWith({
      where: { id: 'd-1' },
      data: { status: 'DONE' },
    });
  });

  it('forgets the phone when the receipt says it is gone', async () => {
    db.pushDelivery.findMany.mockResolvedValue([sent]);
    global.fetch = expoAnswers({
      't-1': { status: 'error', details: { error: 'DeviceNotRegistered' } },
    }) as unknown as typeof fetch;
    await checkReceipts(later);
    expect(db.pushDevice.deleteMany).toHaveBeenCalledWith({ where: { id: 'dev-1' } });
  });

  it('waits for a receipt that is not there yet, up to a day', async () => {
    db.pushDelivery.findMany.mockResolvedValue([sent]);
    global.fetch = expoAnswers({}) as unknown as typeof fetch;
    await checkReceipts(later);
    expect(db.pushDelivery.updateMany).not.toHaveBeenCalled();
    await checkReceipts(new Date(OPEN.getTime() + 25 * 60 * 60_000));
    expect(db.pushDelivery.updateMany).toHaveBeenCalledWith({
      where: { id: 'd-1' },
      data: { status: 'DEAD', error: 'sin recibo' },
    });
  });
});

describe('devices', () => {
  it('takes the phone away from whoever used it before', async () => {
    await registerDevice({
      institutionId: 'inst-1',
      personId: 'p-1',
      token: 'ExponentPushToken[a]',
      platform: 'IOS',
      now: OPEN,
    });
    expect(db.pushDevice.deleteMany).toHaveBeenCalledWith({
      where: { token: 'ExponentPushToken[a]', NOT: { personId: 'p-1' } },
    });
    expect(db.pushDevice.upsert).toHaveBeenCalledWith({
      where: { token: 'ExponentPushToken[a]' },
      create: {
        institutionId: 'inst-1',
        personId: 'p-1',
        token: 'ExponentPushToken[a]',
        platform: 'IOS',
        lastSeenAt: OPEN,
      },
      update: { platform: 'IOS', lastSeenAt: OPEN },
    });
  });

  it('only removes the phone of whoever asks', async () => {
    db.pushDevice.deleteMany.mockResolvedValue({ count: 0 });
    const result = await removeDevice({ institutionId: 'inst-1', personId: 'p-2', token: 't' });
    expect(result).toEqual({ removed: false });
    expect(db.pushDevice.deleteMany).toHaveBeenCalledWith({
      where: { institutionId: 'inst-1', personId: 'p-2', token: 't' },
    });
  });
});
