/** @jest-environment node */
/**
 * GET /api/learn/account (27/11): las cuentas de quien paga y si existe el pago en línea.
 */

import { NextRequest } from 'next/server';

const mockList = jest.fn();
const mockBold = jest.fn();

jest.mock('server-only', () => ({}));
jest.mock('@/lib/authz/request-context', () => ({ getRequestContext: jest.fn() }));
jest.mock('@/features/billing/server/account.service', () => ({
  listOwnAccounts: (...args: unknown[]) => mockList(...args),
}));
jest.mock('@/lib/billing/bold', () => ({ isBoldConfigured: () => mockBold() }));

import { getRequestContext } from '@/lib/authz/request-context';
import { GET } from '@/app/api/learn/account/route';

const mockContext = getRequestContext as jest.Mock;
const own = [{ enrollmentId: 'e-1' }];
const request = () => new NextRequest(new URL('/api/learn/account', 'http://localhost'));

beforeEach(() => {
  jest.clearAllMocks();
  mockContext.mockResolvedValue({
    institution: { id: 'inst-1' },
    person: { id: 'p-1' },
    capabilities: new Map([['billing.read.own', own]]),
  });
});

describe('GET /api/learn/account', () => {
  it.each([true, false])('says whether paying online exists (%p)', async (online) => {
    mockList.mockResolvedValue([{ enrollmentId: 'e-1' }]);
    mockBold.mockReturnValue(online);
    const res = await GET(request());
    expect((await res.json()).data).toEqual({
      accounts: [{ enrollmentId: 'e-1' }],
      onlinePayment: online,
    });
    expect(mockList).toHaveBeenCalledWith({ institutionId: 'inst-1', scopes: own });
  });

  it('answers 404 without accounts', async () => {
    mockList.mockResolvedValue([]);
    expect((await GET(request())).status).toBe(404);
  });
});
