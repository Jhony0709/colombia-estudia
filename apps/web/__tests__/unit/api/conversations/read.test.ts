/** @jest-environment node */
/**
 * GET /api/conversations y GET /api/conversations/[conversationId] (27/11): la bandeja y el chat
 * para la app móvil, solo para el equipo.
 */

import { NextRequest } from 'next/server';

const mockList = jest.fn();
const mockGet = jest.fn();

jest.mock('server-only', () => ({}));
jest.mock('@/lib/authz/request-context', () => ({ getRequestContext: jest.fn() }));
jest.mock('@/features/messaging/server/conversations.service', () => ({
  listConversations: (...args: unknown[]) => mockList(...args),
  getConversation: (...args: unknown[]) => mockGet(...args),
}));

import { getRequestContext } from '@/lib/authz/request-context';
import { GET as list } from '@/app/api/conversations/route';
import { GET as detail } from '@/app/api/conversations/[conversationId]/route';

const mockContext = getRequestContext as jest.Mock;
const staff = (capabilities: Map<string, unknown[]>) => ({
  institution: { id: 'inst-1' },
  person: { id: 'staff-1' },
  capabilities,
});
const manage = new Map([['cohort.manage', [{ institution: true }]]]);
const get = (path: string) => new NextRequest(new URL(path, 'http://localhost'));

beforeEach(() => jest.clearAllMocks());

describe('GET /api/conversations', () => {
  it('lists what is waiting by default', async () => {
    mockContext.mockResolvedValue(staff(manage));
    mockList.mockResolvedValue([{ id: 'c-1' }]);
    const res = await list(get('/api/conversations'));
    expect(res.status).toBe(200);
    expect((await res.json()).data).toEqual({ conversations: [{ id: 'c-1' }] });
    expect(mockList).toHaveBeenCalledWith({
      institutionId: 'inst-1',
      personId: 'staff-1',
      view: 'waiting',
    });
  });

  it('lists the chats of whoever asks', async () => {
    mockContext.mockResolvedValue(staff(manage));
    mockList.mockResolvedValue([]);
    await list(get('/api/conversations?view=mine'));
    expect(mockList).toHaveBeenCalledWith(expect.objectContaining({ view: 'mine' }));
  });

  it('rejects an unknown view', async () => {
    mockContext.mockResolvedValue(staff(manage));
    expect((await list(get('/api/conversations?view=todo'))).status).toBe(400);
    expect(mockList).not.toHaveBeenCalled();
  });

  it('answers 403 without cohort.manage, as with the aal1 of staff', async () => {
    mockContext.mockResolvedValue(staff(new Map()));
    expect((await list(get('/api/conversations'))).status).toBe(403);
    expect(mockList).not.toHaveBeenCalled();
  });
});

describe('GET /api/conversations/[conversationId]', () => {
  const params = { params: Promise.resolve({ conversationId: 'c-1' }) };

  it('gives the chat', async () => {
    mockContext.mockResolvedValue(staff(manage));
    mockGet.mockResolvedValue({ id: 'c-1', messages: [] });
    const res = await detail(get('/api/conversations/c-1'), params);
    expect(res.status).toBe(200);
    expect((await res.json()).data).toEqual({ id: 'c-1', messages: [] });
    expect(mockGet).toHaveBeenCalledWith({ institutionId: 'inst-1', conversationId: 'c-1' });
  });

  it('answers 404 to a chat of another institution', async () => {
    mockContext.mockResolvedValue(staff(manage));
    mockGet.mockResolvedValue(null);
    expect((await detail(get('/api/conversations/c-9'), params)).status).toBe(404);
  });

  it('answers 403 without cohort.manage', async () => {
    mockContext.mockResolvedValue(staff(new Map()));
    expect((await detail(get('/api/conversations/c-1'), params)).status).toBe(403);
    expect(mockGet).not.toHaveBeenCalled();
  });
});
