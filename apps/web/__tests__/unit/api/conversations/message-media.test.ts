/** @jest-environment node */
/**
 * GET /api/conversations/[conversationId]/messages/[messageId]/media (27/11): solo el equipo, y
 * redirige a una URL firmada recién hecha, sin caché.
 */

import { NextRequest } from 'next/server';

const mockChatMediaUrl = jest.fn();

jest.mock('server-only', () => ({}));
jest.mock('@/lib/authz/request-context', () => ({ getRequestContext: jest.fn() }));
jest.mock('@/features/messaging/server/chat-media.service', () => ({
  chatMediaUrl: (...args: unknown[]) => mockChatMediaUrl(...args),
}));

import { getRequestContext } from '@/lib/authz/request-context';
import { APIError } from '@/lib/core/errors';
import { GET } from '@/app/api/conversations/[conversationId]/messages/[messageId]/media/route';

const mockContext = getRequestContext as jest.Mock;
const params = { params: Promise.resolve({ conversationId: 'conv-1', messageId: 'm-1' }) };
const request = () =>
  new NextRequest(new URL('/api/conversations/conv-1/messages/m-1/media', 'http://localhost'));
const ctx = (capabilities: Map<string, unknown[]>) => ({
  institution: { id: 'inst-1' },
  person: { id: 'staff-1' },
  capabilities,
});

beforeEach(() => jest.clearAllMocks());

describe('GET …/messages/[messageId]/media', () => {
  it('con cohort.manage redirige a la URL firmada, sin caché', async () => {
    mockContext.mockResolvedValue(ctx(new Map([['cohort.manage', [{ institution: true }]]])));
    mockChatMediaUrl.mockResolvedValue('https://storage.test/signed/a.ogg');

    const res = await GET(request(), params);

    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe('https://storage.test/signed/a.ogg');
    expect(res.headers.get('cache-control')).toBe('private, no-store');
    expect(mockChatMediaUrl).toHaveBeenCalledWith({
      institutionId: 'inst-1',
      conversationId: 'conv-1',
      messageId: 'm-1',
    });
  });

  it('sin la capacidad: 403 y no firma nada', async () => {
    mockContext.mockResolvedValue(ctx(new Map()));

    const res = await GET(request(), params);

    expect(res.status).toBe(403);
    expect(mockChatMediaUrl).not.toHaveBeenCalled();
  });

  it('un mensaje de otra conversación: 404', async () => {
    mockContext.mockResolvedValue(ctx(new Map([['cohort.manage', [{ institution: true }]]])));
    mockChatMediaUrl.mockRejectedValue(new APIError('Not found', 'NOT_FOUND'));

    expect((await GET(request(), params)).status).toBe(404);
  });

  it('con ?as=url responde la URL en JSON para la app móvil, sin caché', async () => {
    mockContext.mockResolvedValue(ctx(new Map([['cohort.manage', [{ institution: true }]]])));
    mockChatMediaUrl.mockResolvedValue('https://storage.test/signed/a.ogg');

    const res = await GET(
      new NextRequest(
        new URL('/api/conversations/conv-1/messages/m-1/media?as=url', 'http://localhost')
      ),
      params
    );

    expect(res.status).toBe(200);
    expect((await res.json()).data).toEqual({ url: 'https://storage.test/signed/a.ogg' });
    expect(res.headers.get('cache-control')).toBe('private, no-store');
  });
});
