/** @jest-environment node */
/**
 * La retención de mensajería del job diario (27/11): antes de borrar las conversaciones viejas
 * se borran sus archivos del chat; si Storage falla, no se borra nada y se reintenta mañana.
 */

const mockDeleteMany = jest.fn();
const mockRemoveChatMedia = jest.fn();
const mockWarn = jest.fn();

// Lo demás del job no importa aquí: cualquier consulta devuelve vacío.
const anyModel = () =>
  new Proxy({}, { get: () => jest.fn(async () => []) }) as Record<string, jest.Mock>;
const mockDb = new Proxy(
  {},
  {
    get: (_t, model: string) =>
      model === 'conversation' ? { deleteMany: mockDeleteMany } : anyModel(),
  }
);

jest.mock('server-only', () => ({}));
jest.mock('@/lib/db/tenant', () => ({
  prisma: { institution: { findMany: async () => [{ id: 'inst-1', name: 'ALBA' }] } },
  createTenantClient: () => mockDb,
}));
jest.mock('@/lib/mail', () => ({ getMailer: jest.fn(), isMailConfigured: () => false }));
jest.mock('@/lib/mail/templates/overdue', () => ({ renderOverdueEmail: jest.fn() }));
jest.mock('@/lib/observability/logger', () => ({
  logger: { warn: (...a: unknown[]) => mockWarn(...a), info: jest.fn(), error: jest.fn() },
}));
jest.mock('@/features/learn/server/attempt.service', () => ({ expireIfDue: jest.fn() }));
jest.mock('@/features/certificates/server/certificates.service', () => ({
  issueDueCertificates: async () => ({ issued: 0, completedEnrollments: 0 }),
}));
jest.mock('@/features/billing/server/billing.service', () => ({
  settleAgreements: async () => ({ fulfilled: 0, overdue: [] }),
  confirmPayment: jest.fn(),
}));
jest.mock('@/features/billing/server/account.service', () => ({
  syncOpenPaymentLinks: async () => ({ reconciled: 0 }),
}));
jest.mock('@/features/notifications/server/notifications.service', () => ({
  notify: jest.fn(),
  notifyMany: jest.fn(),
  staffPersonIds: async () => [],
}));
jest.mock('@/features/admin/server/policies.service', () => ({ getPolicy: async () => ({}) }));
jest.mock('@/features/content/server/media.service', () => ({
  sweepUnusedMedia: async () => ({ swept: 0, failed: 0 }),
}));
jest.mock('@/features/messaging/server/chat-media.service', () => ({
  removeChatMedia: (...args: unknown[]) => mockRemoveChatMedia(...args),
}));

import { runDailyJob } from '@/features/jobs/server/daily.service';

const NOW = new Date('2026-11-27T10:00:00.000Z');
const stale = { personId: null, lastMessageAt: { lt: new Date('2025-11-27T10:00:00.000Z') } };

beforeEach(() => jest.clearAllMocks());

describe('runDailyJob: retención de mensajería', () => {
  it('borra los archivos y luego las conversaciones de 12 meses sin escribir', async () => {
    const order: string[] = [];
    mockRemoveChatMedia.mockImplementation(async () => void order.push('media'));
    mockDeleteMany.mockImplementation(async () => {
      order.push('chats');
      return { count: 2 };
    });

    const [report] = await runDailyJob({ now: NOW });

    expect(mockRemoveChatMedia).toHaveBeenCalledWith('inst-1', stale);
    expect(mockDeleteMany).toHaveBeenCalledWith({ where: stale });
    expect(order).toEqual(['media', 'chats']);
    expect(report?.conversationsPurged).toBe(2);
  });

  it('si Storage falla no borra las conversaciones: mañana se reintenta', async () => {
    mockRemoveChatMedia.mockRejectedValue(new Error('storage caído'));

    const [report] = await runDailyJob({ now: NOW });

    expect(mockDeleteMany).not.toHaveBeenCalled();
    expect(report?.conversationsPurged).toBe(0);
    expect(mockWarn).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'job-conversation-purge-failed' })
    );
  });
});
