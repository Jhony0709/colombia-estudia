/** @jest-environment node */
/**
 * Tests for GET /auth/callback route.
 * SSOT: docs/estado.md §9b
 */

// Mock Supabase
const mockExchangeCodeForSession = jest.fn();
jest.mock('@/lib/auth/supabase-server', () => ({
  createServerSupabaseClient: jest.fn(() => ({
    auth: {
      exchangeCodeForSession: mockExchangeCodeForSession,
    },
  })),
}));

import { NextRequest } from 'next/server';

// Import after mocks
const { GET } = require('@/app/(public)/auth/callback/route');

describe('GET /auth/callback', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('redirects to /auth/login?error=callback when no code provided', async () => {
    const req = new NextRequest(new URL('/auth/callback', 'http://localhost:3000'));

    const response = await GET(req);

    expect(response.status).toBe(303);
    expect(response.headers.get('Location')).toBe(
      'http://localhost:3000/auth/login?error=callback'
    );
  });

  it('redirects to /auth/login?error=callback when exchangeCodeForSession fails', async () => {
    mockExchangeCodeForSession.mockResolvedValue({
      error: { message: 'Invalid code' },
    });

    const req = new NextRequest(
      new URL('/auth/callback?code=invalid-code', 'http://localhost:3000')
    );

    const response = await GET(req);

    expect(response.status).toBe(303);
    expect(response.headers.get('Location')).toBe(
      'http://localhost:3000/auth/login?error=callback'
    );
  });

  it('redirects to sanitized next on successful code exchange', async () => {
    mockExchangeCodeForSession.mockResolvedValue({ error: null });

    const req = new NextRequest(
      new URL('/auth/callback?code=valid-code&next=/aprender', 'http://localhost:3000')
    );

    const response = await GET(req);

    expect(response.status).toBe(303);
    expect(response.headers.get('Location')).toBe('http://localhost:3000/aprender');
  });

  it('redirects to / when next is missing', async () => {
    mockExchangeCodeForSession.mockResolvedValue({ error: null });

    const req = new NextRequest(new URL('/auth/callback?code=valid-code', 'http://localhost:3000'));

    const response = await GET(req);

    expect(response.status).toBe(303);
    expect(response.headers.get('Location')).toBe('http://localhost:3000/');
  });

  it('sanitizes malicious next parameter to /', async () => {
    mockExchangeCodeForSession.mockResolvedValue({ error: null });

    const req = new NextRequest(
      new URL('/auth/callback?code=valid-code&next=//evil.com', 'http://localhost:3000')
    );

    const response = await GET(req);

    expect(response.status).toBe(303);
    expect(response.headers.get('Location')).toBe('http://localhost:3000/');
  });

  it('redirects to /auth/restablecer for recovery flow (type=recovery)', async () => {
    mockExchangeCodeForSession.mockResolvedValue({ error: null });

    const req = new NextRequest(
      new URL('/auth/callback?code=valid-code&type=recovery', 'http://localhost:3000')
    );

    const response = await GET(req);

    expect(response.status).toBe(303);
    expect(response.headers.get('Location')).toBe('http://localhost:3000/auth/restablecer');
  });

  it('exchanges code with Supabase', async () => {
    mockExchangeCodeForSession.mockResolvedValue({ error: null });

    const req = new NextRequest(
      new URL('/auth/callback?code=the-auth-code', 'http://localhost:3000')
    );

    await GET(req);

    expect(mockExchangeCodeForSession).toHaveBeenCalledWith('the-auth-code');
  });
});
