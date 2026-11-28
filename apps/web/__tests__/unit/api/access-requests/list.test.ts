/** @jest-environment node */
/**
 * GET /api/access-requests (27/11): la bandeja de solicitudes para la app móvil, solo para el equipo.
 */

import { NextRequest } from 'next/server';

const mockList = jest.fn();

jest.mock('server-only', () => ({}));
jest.mock('@/lib/authz/request-context', () => ({ getRequestContext: jest.fn() }));
jest.mock('@/features/requests/server/requests.service', () => ({
  listRequests: (...args: unknown[]) => mockList(...args),
}));

import { getRequestContext } from '@/lib/authz/request-context';
import { GET } from '@/app/api/access-requests/route';

const mockContext = getRequestContext as jest.Mock;
const person = (capabilities: Map<string, unknown[]>) => ({
  institution: { id: 'inst-1' },
  person: { id: 'p-1' },
  capabilities,
});
const manage = new Map([['cohort.manage', [{ institution: true }]]]);
const get = (path: string) => new NextRequest(new URL(path, 'http://localhost'));

beforeEach(() => jest.clearAllMocks());

describe('GET /api/access-requests', () => {
  it('lists the open ones by default', async () => {
    mockContext.mockResolvedValue(person(manage));
    mockList.mockResolvedValue([{ id: 'r-1' }]);
    const res = await GET(get('/api/access-requests'));
    expect(res.status).toBe(200);
    expect((await res.json()).data).toEqual({ requests: [{ id: 'r-1' }] });
    expect(mockList).toHaveBeenCalledWith({ institutionId: 'inst-1', status: 'PENDING' });
  });

  it('lists the closed ones', async () => {
    mockContext.mockResolvedValue(person(manage));
    mockList.mockResolvedValue([]);
    await GET(get('/api/access-requests?status=closed'));
    expect(mockList).toHaveBeenCalledWith({ institutionId: 'inst-1', status: 'CLOSED' });
  });

  it('rejects an unknown status', async () => {
    mockContext.mockResolvedValue(person(manage));
    expect((await GET(get('/api/access-requests?status=todo'))).status).toBe(400);
    expect(mockList).not.toHaveBeenCalled();
  });

  it('answers 403 to whoever is not on the team', async () => {
    mockContext.mockResolvedValue(person(new Map()));
    expect((await GET(get('/api/access-requests'))).status).toBe(403);
    expect(mockList).not.toHaveBeenCalled();
  });
});
