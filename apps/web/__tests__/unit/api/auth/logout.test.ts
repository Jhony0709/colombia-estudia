/** @jest-environment node */
/**
 * Tests for POST /api/auth/logout endpoint.
 * SSOT: docs/estado.md §9b
 */

// Mock Supabase
const mockSignOut = jest.fn();
const mockBearer = jest.fn();
const mockRevoke = jest.fn();
jest.mock('@/lib/auth/supabase-server', () => ({
  bearerToken: () => mockBearer(),
  revokeSession: (jwt: string) => mockRevoke(jwt),
  createServerSupabaseClient: jest.fn(() => ({
    auth: {
      signOut: mockSignOut,
    },
  })),
}));

import { NextRequest } from 'next/server';

// Import after mocks
const { POST } = require('@/app/api/auth/logout/route');

describe('POST /api/auth/logout', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSignOut.mockResolvedValue({ error: null });
    mockBearer.mockResolvedValue(null);
    mockRevoke.mockResolvedValue(undefined);
  });

  function createRequest() {
    return new NextRequest(new URL('/api/auth/logout', 'http://localhost:3000'), {
      method: 'POST',
      headers: {
        'sec-fetch-site': 'same-origin',
      },
    });
  }

  it('calls signOut on Supabase', async () => {
    await POST(createRequest());

    expect(mockSignOut).toHaveBeenCalled();
  });

  it('redirects with 303 to /auth/login', async () => {
    const response = await POST(createRequest());

    expect(response.status).toBe(303);
    expect(response.headers.get('Location')).toBe('http://localhost:3000/auth/login');
  });

  it('redirects even if signOut fails', async () => {
    mockSignOut.mockResolvedValue({ error: { message: 'Some error' } });

    const response = await POST(createRequest());

    // Should still redirect to login page
    expect(response.status).toBe(303);
    expect(response.headers.get('Location')).toBe('http://localhost:3000/auth/login');
  });

  describe('with a Bearer (the mobile app)', () => {
    it('revokes that session and answers JSON, without touching the cookie', async () => {
      mockBearer.mockResolvedValue('at-1');
      const response = await POST(createRequest());
      expect(response.status).toBe(200);
      expect((await response.json()).data).toEqual({ signedOut: true });
      expect(mockRevoke).toHaveBeenCalledWith('at-1');
      expect(mockSignOut).not.toHaveBeenCalled();
    });

    it('answers 401 when Supabase no longer accepts the token, so the app renews', async () => {
      mockBearer.mockResolvedValue('at-old');
      const { APIError } = jest.requireActual('@/lib/core/errors');
      mockRevoke.mockRejectedValue(new APIError('Sesión vencida', 'UNAUTHENTICATED'));
      const response = await POST(createRequest());
      expect(response.status).toBe(401);
    });
  });
});
