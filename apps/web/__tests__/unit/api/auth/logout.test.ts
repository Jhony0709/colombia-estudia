/** @jest-environment node */
/**
 * Tests for POST /api/auth/logout endpoint.
 * SSOT: docs/estado.md §9b
 */

// Mock Supabase
const mockSignOut = jest.fn();
jest.mock('@/lib/auth/supabase-server', () => ({
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
});
