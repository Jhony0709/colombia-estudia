/** @jest-environment node */
/**
 * Tests for middleware.
 *
 * These tests verify the middleware behavior without running actual Supabase.
 */

import { NextRequest, NextResponse } from 'next/server';

// Mock @supabase/ssr
const mockGetUser = jest.fn();
jest.mock('@supabase/ssr', () => ({
  createServerClient: jest.fn(() => ({
    auth: {
      getUser: mockGetUser,
    },
  })),
}));

// Import middleware after mocks
import { middleware } from '@/middleware';

describe('middleware', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Set required env vars
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'test-key';
  });

  function createRequest(path: string, options?: { headers?: Record<string, string> }) {
    const url = new URL(path, 'https://validaya.example.com');
    const headers = new Headers(options?.headers);
    return new NextRequest(url, { headers });
  }

  describe('request ID handling', () => {
    it('generates request ID if not present', async () => {
      mockGetUser.mockResolvedValue({ data: { user: null } });
      const request = createRequest('/auth/login');
      const response = await middleware(request);

      expect(response.headers.get('x-request-id')).toBeTruthy();
      expect(response.headers.get('x-request-id')).toHaveLength(36); // UUID
    });

    it('preserves incoming request ID', async () => {
      mockGetUser.mockResolvedValue({ data: { user: null } });
      const request = createRequest('/auth/login', {
        headers: { 'x-request-id': 'existing-id-123' },
      });
      const response = await middleware(request);

      expect(response.headers.get('x-request-id')).toBe('existing-id-123');
    });
  });

  describe('forwarded request headers (what headers() sees in server components)', () => {
    // NextResponse.next({ request: { headers } }) exposes the forwarded request headers as
    // `x-middleware-request-<name>`; response headers never reach headers().
    const forwarded = (response: NextResponse, name: string) =>
      response.headers.get(`x-middleware-request-${name}`);

    it('forwards x-tenant-host from the request hostname', async () => {
      mockGetUser.mockResolvedValue({ data: { user: null } });
      const response = await middleware(createRequest('/auth/login'));

      expect(forwarded(response, 'x-tenant-host')).toBe('validaya.example.com');
    });

    it('forwards x-request-id, x-nonce and the CSP (Next reads the nonce from it)', async () => {
      mockGetUser.mockResolvedValue({ data: { user: null } });
      const response = await middleware(
        createRequest('/auth/login', { headers: { 'x-request-id': 'req-1' } })
      );

      expect(forwarded(response, 'x-request-id')).toBe('req-1');
      const nonce = forwarded(response, 'x-nonce');
      expect(nonce).toBeTruthy();
      expect(forwarded(response, 'content-security-policy')).toContain(`'nonce-${nonce}'`);
      expect(response.headers.get('Content-Security-Policy')).toContain(`'nonce-${nonce}'`);
    });
  });

  describe('API routes', () => {
    it('does not redirect a protected API route without user (handler answers 401)', async () => {
      mockGetUser.mockResolvedValue({ data: { user: null } });
      const response = await middleware(createRequest('/api/me'));

      expect(response.status).not.toBe(307);
      expect(response.headers.get('location')).toBeNull();
      expect(response.headers.get('Content-Security-Policy')).toBeTruthy();
    });
  });

  describe('protected route redirect', () => {
    it('redirects to login for protected route without user', async () => {
      mockGetUser.mockResolvedValue({ data: { user: null } });
      const request = createRequest('/aprender');
      const response = await middleware(request);

      expect(response.status).toBe(307); // Redirect
      expect(response.headers.get('location')).toContain('/auth/login');
      expect(response.headers.get('location')).toContain('next=%2Faprender');
    });

    it('does not redirect for public routes', async () => {
      mockGetUser.mockResolvedValue({ data: { user: null } });
      const request = createRequest('/auth/login');
      const response = await middleware(request);

      expect(response.status).not.toBe(307);
      expect(response.headers.get('location')).toBeNull();
    });

    it('does not redirect for authenticated users', async () => {
      mockGetUser.mockResolvedValue({
        data: { user: { id: 'user-1', email: 'test@example.com' } },
      });
      const request = createRequest('/aprender');
      const response = await middleware(request);

      expect(response.status).not.toBe(307);
      expect(response.headers.get('location')).toBeNull();
    });

    it('sanitizes malicious next parameter', async () => {
      mockGetUser.mockResolvedValue({ data: { user: null } });
      const request = createRequest('/aprender?foo=bar');
      const response = await middleware(request);

      // The middleware should use the pathname and query string, not external URLs
      const location = response.headers.get('location');
      expect(location).toContain('next=%2Faprender%3Ffoo%3Dbar');
      // Ensure no protocol-relative URLs (//evil.com) are in the next param
      // Note: the location itself has https:// which is fine
      const nextParam = new URL(location!, 'https://example.com').searchParams.get('next');
      expect(nextParam).not.toMatch(/^\/\//);
    });
  });

  describe('security headers', () => {
    it('sets Content-Security-Policy', async () => {
      mockGetUser.mockResolvedValue({ data: { user: null } });
      const request = createRequest('/auth/login');
      const response = await middleware(request);

      const csp = response.headers.get('Content-Security-Policy');
      expect(csp).toContain("default-src 'self'");
      expect(csp).toContain('nonce-');
      expect(csp).toContain("'strict-dynamic'");
      expect(csp).toContain("frame-ancestors 'none'");
      expect(csp).not.toContain('unsafe-inline');
      // NODE_ENV is 'test' here: unsafe-eval is development-only
      expect(csp).not.toContain('unsafe-eval');
    });

    it('sets Strict-Transport-Security', async () => {
      mockGetUser.mockResolvedValue({ data: { user: null } });
      const request = createRequest('/auth/login');
      const response = await middleware(request);

      expect(response.headers.get('Strict-Transport-Security')).toContain('max-age=63072000');
    });

    it('sets X-Content-Type-Options', async () => {
      mockGetUser.mockResolvedValue({ data: { user: null } });
      const request = createRequest('/auth/login');
      const response = await middleware(request);

      expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
    });

    it('sets Permissions-Policy', async () => {
      mockGetUser.mockResolvedValue({ data: { user: null } });
      const request = createRequest('/auth/login');
      const response = await middleware(request);

      const pp = response.headers.get('Permissions-Policy');
      expect(pp).toContain('camera=()');
      expect(pp).toContain('microphone=()');
      expect(pp).toContain('geolocation=()');
    });

    it('sets unique nonce for each request', async () => {
      mockGetUser.mockResolvedValue({ data: { user: null } });

      const request1 = createRequest('/auth/login');
      const response1 = await middleware(request1);
      const nonce1 = response1.headers.get('x-nonce');

      const request2 = createRequest('/auth/login');
      const response2 = await middleware(request2);
      const nonce2 = response2.headers.get('x-nonce');

      expect(nonce1).toBeTruthy();
      expect(nonce2).toBeTruthy();
      expect(nonce1).not.toBe(nonce2);
    });
  });
});
