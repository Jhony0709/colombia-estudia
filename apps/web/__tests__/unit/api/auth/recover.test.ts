/** @jest-environment node */
/**
 * Tests for POST /api/auth/recover endpoint.
 * SSOT: docs/estado.md §9b corrections - recover uses PKCE with callback
 */

// Mock Supabase
const mockResetPasswordForEmail = jest.fn();
jest.mock('@/lib/auth/supabase-server', () => ({
  createServerSupabaseClient: jest.fn(() => ({
    auth: {
      resetPasswordForEmail: mockResetPasswordForEmail,
    },
  })),
}));

import { NextRequest } from 'next/server';

// Import after mocks
const { POST } = require('@/app/api/auth/recover/route');

describe('POST /api/auth/recover', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockResetPasswordForEmail.mockResolvedValue({ error: null });
  });

  function createRequest(body: object) {
    return new NextRequest(new URL('/api/auth/recover', 'http://localhost:3000'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'sec-fetch-site': 'same-origin',
      },
      body: JSON.stringify(body),
    });
  }

  it('returns 200 with success message for existing email', async () => {
    const response = await POST(
      createRequest({
        email: 'existing@example.com',
      })
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.message).toBe('Si el correo existe, te enviamos un enlace');
  });

  it('returns 200 with same message for non-existing email', async () => {
    // Privacy: same response regardless of email existence
    const response = await POST(
      createRequest({
        email: 'nonexistent@example.com',
      })
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.message).toBe('Si el correo existe, te enviamos un enlace');
  });

  it('redirectTo points to /auth/callback with next=/auth/restablecer (PKCE)', async () => {
    await POST(
      createRequest({
        email: 'user@example.com',
      })
    );

    expect(mockResetPasswordForEmail).toHaveBeenCalledWith('user@example.com', {
      redirectTo: expect.stringContaining('/auth/callback'),
    });

    // Verify the callback includes next=/auth/restablecer
    const callArgs = mockResetPasswordForEmail.mock.calls[0];
    const redirectTo = callArgs[1].redirectTo;
    expect(redirectTo).toContain('next=%2Fauth%2Frestablecer');
  });

  it('uses request origin for redirectTo', async () => {
    const req = new NextRequest(new URL('/api/auth/recover', 'https://app.colombiaestudia.co'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'sec-fetch-site': 'same-origin',
      },
      body: JSON.stringify({ email: 'user@example.com' }),
    });

    await POST(req);

    expect(mockResetPasswordForEmail).toHaveBeenCalledWith('user@example.com', {
      redirectTo: expect.stringContaining('https://app.colombiaestudia.co/auth/callback'),
    });
  });
});
