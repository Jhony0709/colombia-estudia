/** @jest-environment node */
/**
 * The session of a request: the cookie of the web, or the Bearer of the mobile app (27/11).
 */

const mockHeader = jest.fn();
jest.mock('next/headers', () => ({
  headers: async () => ({ get: (name: string) => mockHeader(name) }),
  cookies: async () => ({ getAll: () => [], set: jest.fn() }),
}));
const mockCookieGetUser = jest.fn();
jest.mock('@supabase/ssr', () => ({
  createServerClient: () => ({ auth: { getUser: mockCookieGetUser } }),
}));
const mockTokenGetUser = jest.fn();
const mockAdminSignOut = jest.fn();
jest.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    auth: { getUser: mockTokenGetUser, admin: { signOut: mockAdminSignOut } },
  }),
}));

import { bearerToken, getSupabaseUser, revokeSession } from '@/lib/auth/supabase-server';

const ana = { id: 'auth-1' };

beforeAll(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://x.supabase.co';
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_test';
  process.env.SUPABASE_SECRET_KEY = 'sb_secret_test';
});
beforeEach(() => jest.clearAllMocks());

describe('bearerToken', () => {
  it.each([
    ['Bearer at-1', 'at-1'],
    ['Bearer ', null],
    ['Basic abc', null],
    [null, null],
  ])('reads %p as %p', async (header, token) => {
    mockHeader.mockReturnValue(header);
    await expect(bearerToken()).resolves.toBe(token);
  });
});

describe('getSupabaseUser', () => {
  it('validates the Bearer with Supabase and does not read the cookie', async () => {
    mockHeader.mockReturnValue('Bearer at-1');
    mockTokenGetUser.mockResolvedValue({ data: { user: ana } });
    await expect(getSupabaseUser()).resolves.toBe(ana);
    expect(mockTokenGetUser).toHaveBeenCalledWith('at-1');
    expect(mockCookieGetUser).not.toHaveBeenCalled();
  });

  it('is anonymous with a Bearer Supabase rejects, even with a cookie session', async () => {
    mockHeader.mockReturnValue('Bearer vencido');
    mockTokenGetUser.mockResolvedValue({ data: { user: null } });
    mockCookieGetUser.mockResolvedValue({ data: { user: ana } });
    await expect(getSupabaseUser()).resolves.toBeNull();
    expect(mockCookieGetUser).not.toHaveBeenCalled();
  });

  it('keeps the cookie of the web without a Bearer', async () => {
    mockHeader.mockReturnValue(null);
    mockCookieGetUser.mockResolvedValue({ data: { user: ana } });
    await expect(getSupabaseUser()).resolves.toBe(ana);
    expect(mockCookieGetUser).toHaveBeenCalledWith(undefined);
    expect(mockTokenGetUser).not.toHaveBeenCalled();
  });
});

describe('revokeSession', () => {
  it('signs out only the session of that token', async () => {
    mockAdminSignOut.mockResolvedValue({ data: null, error: null });
    await revokeSession('at-1');
    expect(mockAdminSignOut).toHaveBeenCalledWith('at-1', 'local');
  });

  it('fails with 401 when Supabase no longer accepts the token', async () => {
    mockAdminSignOut.mockResolvedValue({ data: null, error: { message: 'invalid JWT' } });
    await expect(revokeSession('at-old')).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
  });
});
