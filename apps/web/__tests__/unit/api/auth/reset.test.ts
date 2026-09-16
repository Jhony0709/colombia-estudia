/** @jest-environment node */
/**
 * Tests for POST /api/auth/reset endpoint.
 * SSOT: docs/estado.md §9b corrections - uses error.code for classification
 */

// Mock Supabase
const mockUpdateUser = jest.fn();
jest.mock('@/lib/auth/supabase-server', () => ({
  createServerSupabaseClient: jest.fn(() => ({
    auth: {
      updateUser: mockUpdateUser,
    },
  })),
}));

import { NextRequest } from 'next/server';

// Import after mocks
const { POST } = require('@/app/api/auth/reset/route');

describe('POST /api/auth/reset', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  function createRequest(body: object) {
    return new NextRequest(new URL('/api/auth/reset', 'http://localhost:3000'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'sec-fetch-site': 'same-origin',
      },
      body: JSON.stringify(body),
    });
  }

  it('returns 400 VALIDATION_ERROR for password shorter than 12 characters', async () => {
    const response = await POST(
      createRequest({
        password: 'short',
      })
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 200 with success for valid password', async () => {
    mockUpdateUser.mockResolvedValue({ error: null });

    const response = await POST(
      createRequest({
        password: 'validpassword123',
      })
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.success).toBe(true);
  });

  it('returns 400 with leak message for weak_password error code', async () => {
    mockUpdateUser.mockResolvedValue({
      error: { code: 'weak_password', message: 'Password is too weak' },
    });

    const response = await POST(
      createRequest({
        password: 'validlength123',
      })
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(body.error.message).toContain('demasiado débil');
    expect(body.error.message).toContain('filtraciones');
  });

  it('returns 400 for same_password error code', async () => {
    mockUpdateUser.mockResolvedValue({
      error: { code: 'same_password', message: 'Password already used' },
    });

    const response = await POST(
      createRequest({
        password: 'oldpassword123',
      })
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(body.error.message).toContain('distinta de la anterior');
  });

  it('returns 401 for other errors (expired session)', async () => {
    mockUpdateUser.mockResolvedValue({
      error: { code: 'session_expired', message: 'Session expired' },
    });

    const response = await POST(
      createRequest({
        password: 'newpassword123',
      })
    );

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error.code).toBe('UNAUTHENTICATED');
    expect(body.error.message).toContain('Sesión expirada');
  });

  it('calls updateUser with the provided password', async () => {
    mockUpdateUser.mockResolvedValue({ error: null });

    await POST(
      createRequest({
        password: 'mynewpassword123',
      })
    );

    expect(mockUpdateUser).toHaveBeenCalledWith({ password: 'mynewpassword123' });
  });
});
