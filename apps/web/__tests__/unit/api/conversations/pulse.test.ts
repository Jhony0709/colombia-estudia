/** @jest-environment node */
/**
 * GET /api/conversations/pulse (27/11): con `id`, marca que quien lo atiende tiene el chat a la
 * vista; sin `id` (la bandeja), no marca nada.
 */

import { NextRequest } from 'next/server';

const mockPulse = jest.fn();
const mockMarkSeen = jest.fn();

jest.mock('server-only', () => ({}));
jest.mock('@/lib/authz/request-context', () => ({
  getRequestContext: async () => ({
    institution: { id: 'inst-1' },
    person: { id: 'staff-1' },
    capabilities: new Map([['cohort.manage', [{ institution: true }]]]),
  }),
}));
jest.mock('@/features/messaging/server/conversations.service', () => ({
  conversationsPulse: (...args: unknown[]) => mockPulse(...args),
}));
jest.mock('@/features/messaging/server/agent-alerts.service', () => ({
  markAgentSeen: (...args: unknown[]) => mockMarkSeen(...args),
}));

import { GET } from '@/app/api/conversations/pulse/route';

const call = (query = '') =>
  GET(new NextRequest(new URL(`/api/conversations/pulse${query}`, 'http://localhost')), {});

beforeEach(() => {
  jest.clearAllMocks();
  mockPulse.mockResolvedValue('stamp-1');
});

it('con el chat abierto marca que lo ve quien pregunta y devuelve la huella', async () => {
  const res = await call('?id=conv-1');
  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({ data: { stamp: 'stamp-1' } });
  expect(mockMarkSeen).toHaveBeenCalledWith({
    institutionId: 'inst-1',
    conversationId: 'conv-1',
    actorId: 'staff-1',
  });
});

it('la bandeja (sin id) no marca ningún chat', async () => {
  await call();
  expect(mockMarkSeen).not.toHaveBeenCalled();
  expect(mockPulse).toHaveBeenCalledWith({ institutionId: 'inst-1' });
});
