/** @jest-environment node */
/**
 * Anonimizar borra también los archivos del chat (27/11): van antes de la base, y si Storage
 * falla no se toca nada. SSOT: features/people/server/anonymize.service.ts.
 */

const tx = {
  person: { update: jest.fn() },
  membership: { updateMany: jest.fn() },
  invitation: { updateMany: jest.fn() },
  conversation: { deleteMany: jest.fn() },
  accessRequest: { updateMany: jest.fn() },
  auditLog: { create: jest.fn() },
};
const db = {
  person: { findFirst: jest.fn() },
  $transaction: jest.fn(async (fn: (t: typeof tx) => unknown) => fn(tx)),
};
const mockRemoveChatMedia = jest.fn();
const mockDeleteUser = jest.fn();

jest.mock('server-only', () => ({}));
jest.mock('@/lib/db/tenant', () => ({ createTenantClient: () => db }));
jest.mock('@/lib/observability/logger', () => ({ logger: { error: jest.fn() } }));
jest.mock('@/lib/auth/supabase-server', () => ({
  getSupabaseAdmin: () => ({ auth: { admin: { deleteUser: mockDeleteUser } } }),
}));
jest.mock('@/features/messaging/server/chat-media.service', () => ({
  removeChatMedia: (...args: unknown[]) => mockRemoveChatMedia(...args),
}));

import { anonymizePerson } from '@/features/people/server/anonymize.service';

const BASE = { institutionId: 'inst-1', actorId: 'admin-1', personId: 'per-1', reason: 'Lo pidió' };

beforeEach(() => {
  jest.clearAllMocks();
  db.person.findFirst.mockResolvedValue({ id: 'per-1', authUserId: 'auth-1', anonymizedAt: null });
});

describe('anonymizePerson: archivos del chat', () => {
  it('borra los archivos de sus chats antes de borrar los chats', async () => {
    const order: string[] = [];
    mockRemoveChatMedia.mockImplementation(async () => void order.push('media'));
    tx.conversation.deleteMany.mockImplementation(async () => void order.push('chats'));

    await anonymizePerson(BASE);

    expect(mockRemoveChatMedia).toHaveBeenCalledWith('inst-1', { personId: 'per-1' });
    expect(tx.conversation.deleteMany).toHaveBeenCalledWith({
      where: { institutionId: 'inst-1', personId: 'per-1' },
    });
    expect(order).toEqual(['media', 'chats']);
  });

  it('si Storage falla, no anonimiza nada y se puede repetir', async () => {
    mockRemoveChatMedia.mockRejectedValue(new Error('storage caído'));

    await expect(anonymizePerson(BASE)).rejects.toThrow('storage caído');
    expect(db.$transaction).not.toHaveBeenCalled();
    expect(mockDeleteUser).not.toHaveBeenCalled();
  });
});
