/** @jest-environment node */
/**
 * Tests for POST /api/auth/magic-link endpoint.
 * SSOT: docs/estado.md §9b corrections
 */

// Mock Supabase
const mockSignInWithOtp = jest.fn();
jest.mock('@/lib/auth/supabase-server', () => ({
  createServerSupabaseClient: jest.fn(() => ({
    auth: {
      signInWithOtp: mockSignInWithOtp,
    },
  })),
}));

import { NextRequest } from 'next/server';

// Import after mocks
const { POST } = require('@/app/api/auth/magic-link/route');

describe('POST /api/auth/magic-link', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSignInWithOtp.mockResolvedValue({ error: null });
  });

  function createRequest(body: object) {
    return new NextRequest(new URL('/api/auth/magic-link', 'http://localhost:3000'), {
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
    expect(body.data.message).toBe('Si el correo existe, recibirás un enlace');
  });

  it('returns 200 with same message for non-existing email', async () => {
    // Even if email doesn't exist, Supabase returns success for privacy
    const response = await POST(
      createRequest({
        email: 'nonexistent@example.com',
      })
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.message).toBe('Si el correo existe, recibirás un enlace');
  });

  it('emailRedirectTo points to /auth/callback', async () => {
    await POST(
      createRequest({
        email: 'user@example.com',
      })
    );

    expect(mockSignInWithOtp).toHaveBeenCalledWith({
      email: 'user@example.com',
      options: {
        emailRedirectTo: expect.stringContaining('/auth/callback'),
      },
    });
  });

  it('includes sanitized next in emailRedirectTo', async () => {
    await POST(
      createRequest({
        email: 'user@example.com',
        next: '/aprender',
      })
    );

    expect(mockSignInWithOtp).toHaveBeenCalledWith({
      email: 'user@example.com',
      options: {
        emailRedirectTo: expect.stringContaining('next=%2Faprender'),
      },
    });
  });

  it('excludes malicious next from emailRedirectTo', async () => {
    await POST(
      createRequest({
        email: 'user@example.com',
        next: '//evil.com',
      })
    );

    // Malicious next should be sanitized to '/' and not included in URL
    const callArgs = mockSignInWithOtp.mock.calls[0][0];
    const redirectUrl = callArgs.options.emailRedirectTo;
    expect(redirectUrl).not.toContain('evil.com');
    // When sanitized to '/', it should not add the next param at all
    expect(redirectUrl).not.toContain('next=');
  });

  it('uses request origin for emailRedirectTo', async () => {
    const req = new NextRequest(new URL('/api/auth/magic-link', 'https://app.colombiaestudia.co'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'sec-fetch-site': 'same-origin',
      },
      body: JSON.stringify({ email: 'user@example.com' }),
    });

    await POST(req);

    expect(mockSignInWithOtp).toHaveBeenCalledWith({
      email: 'user@example.com',
      options: {
        emailRedirectTo: expect.stringContaining('https://app.colombiaestudia.co/auth/callback'),
      },
    });
  });
});
