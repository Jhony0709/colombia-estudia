/** @jest-environment node */
/**
 * El servicio de notificaciones.
 * SSOT: plan/06-cohortes-y-personas.md:65-70 (§7), endpoints.md:34.
 */

const mockCreateMany = jest.fn();
const mockUpdateMany = jest.fn();
const mockFindFirst = jest.fn();
const mockCount = jest.fn();
const mockMembershipFindMany = jest.fn();

jest.mock('server-only', () => ({}));

// `jest.mock` se iza por encima de los `const` de arriba, así que la fábrica no puede
// *leer* esas variables al construirse: solo puede envolverlas en funciones que se llaman
// más tarde, cuando ya existen. Leerlas directamente da
// "Cannot access 'mockCreateMany' before initialization".
jest.mock('@/lib/db/tenant', () => ({
  prisma: {
    notification: { createMany: (...args: unknown[]) => mockCreateMany(...args) },
    membership: { findMany: (...args: unknown[]) => mockMembershipFindMany(...args) },
  },
  createTenantClient: jest.fn(() => ({
    notification: {
      createMany: (...args: unknown[]) => mockCreateMany(...args),
      updateMany: (...args: unknown[]) => mockUpdateMany(...args),
      findFirst: (...args: unknown[]) => mockFindFirst(...args),
      count: (...args: unknown[]) => mockCount(...args),
    },
  })),
}));

jest.mock('@/lib/observability/logger', () => ({ logger: { error: jest.fn() } }));

import {
  notify,
  notifyMany,
  markRead,
  markAllRead,
  sendBestEffort,
} from '@/features/notifications/server/notifications.service';

beforeEach(() => jest.clearAllMocks());

describe('notify', () => {
  it('dice que no creó nada cuando el dedupeKey ya existía', async () => {
    mockCreateMany.mockResolvedValue({ count: 0 });

    const result = await notify('inst1', {
      personId: 'p1',
      type: 'reinvite_requested',
      title: 'T',
      body: 'B',
      dedupeKey: 'reinvite:p1:2026-09-17',
    });

    expect(result.created).toBe(false);
    expect(mockCreateMany).toHaveBeenCalledWith(expect.objectContaining({ skipDuplicates: true }));
  });
});

describe('notifyMany', () => {
  it('con una lista vacía no toca la base', async () => {
    const result = await notifyMany('inst1', [], {
      type: 'reinvite_requested',
      title: 'T',
      body: 'B',
    });

    expect(result.created).toBe(0);
    expect(mockCreateMany).not.toHaveBeenCalled();
  });
});

describe('markRead', () => {
  it('filtra por personId: no se puede marcar la de otra persona', async () => {
    mockUpdateMany.mockResolvedValue({ count: 1 });

    await markRead({ institutionId: 'inst1', personId: 'p1', notificationId: 'n1' });

    expect(mockUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: 'n1', personId: 'p1' }),
      })
    );
  });

  it('una notificación ajena responde NOT_FOUND, no "no es tuya"', async () => {
    mockUpdateMany.mockResolvedValue({ count: 0 });
    mockFindFirst.mockResolvedValue(null);

    await expect(
      markRead({ institutionId: 'inst1', personId: 'p1', notificationId: 'de-otra' })
    ).rejects.toThrow('Notification not found');
  });

  it('marcar dos veces la misma no falla', async () => {
    const readAt = new Date('2026-09-17T10:00:00.000Z');
    mockUpdateMany.mockResolvedValue({ count: 0 });
    mockFindFirst.mockResolvedValue({ readAt });

    const result = await markRead({
      institutionId: 'inst1',
      personId: 'p1',
      notificationId: 'n1',
    });

    expect(result.readAt).toBe(readAt.toISOString());
  });
});

describe('markAllRead', () => {
  it('solo toca las no leídas de esa persona', async () => {
    mockUpdateMany.mockResolvedValue({ count: 3 });

    const result = await markAllRead({ institutionId: 'inst1', personId: 'p1' });

    expect(result.marked).toBe(3);
    expect(mockUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { personId: 'p1', readAt: null } })
    );
  });
});

describe('sendBestEffort', () => {
  it('un correo caído no tumba a quien lo llamó', async () => {
    const result = await sendBestEffort(() => Promise.reject(new Error('Resend 503')), {
      type: 'reinvite_requested',
    });

    expect(result.sent).toBe(false);
  });

  it('devuelve sent cuando el envío sale bien', async () => {
    const result = await sendBestEffort(() => Promise.resolve('ok'), { type: 'x' });

    expect(result.sent).toBe(true);
  });
});
