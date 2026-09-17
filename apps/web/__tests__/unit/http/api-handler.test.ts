/** @jest-environment node */
/**
 * Tests for lib/http/api-handler.ts
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { apiHandler } from '@/lib/http/api-handler';
import { APIError } from '@/lib/core/errors';

// Mock Sentry
jest.mock('@sentry/nextjs', () => ({
  captureException: jest.fn(),
}));

function createRequest(
  method: string,
  url: string,
  options: {
    body?: unknown;
    headers?: Record<string, string>;
  } = {}
): NextRequest {
  const headers = new Headers(options.headers);
  if (!headers.has('host')) {
    headers.set('host', 'localhost:3000');
  }

  let body: string | undefined;
  if (options.body !== undefined && method !== 'GET') {
    body = JSON.stringify(options.body);
    headers.set('content-type', 'application/json');
  }

  return new NextRequest(new URL(url, 'http://localhost:3000'), {
    method,
    headers,
    body,
  });
}

describe('apiHandler', () => {
  describe('Zod validation', () => {
    it('returns 400 VALIDATION_ERROR when validation fails', async () => {
      const schema = z.object({ name: z.string() });
      const handler = apiHandler({ schema })(async () => ({ ok: true }));

      const req = createRequest('POST', '/api/test', { body: { name: 123 } });
      const res = await handler(req);

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error.code).toBe('VALIDATION_ERROR');
      expect(body.error.details).toBeDefined();
    });

    it('returns 400 VALIDATION_ERROR for invalid JSON', async () => {
      const schema = z.object({ name: z.string() });
      const handler = apiHandler({ schema })(async () => ({ ok: true }));

      // Create request with invalid JSON
      const req = new NextRequest(new URL('/api/test', 'http://localhost:3000'), {
        method: 'POST',
        headers: { 'content-type': 'application/json', host: 'localhost:3000' },
        body: 'not valid json',
      });
      const res = await handler(req);

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error.code).toBe('VALIDATION_ERROR');
      expect(body.error.message).toBe('Invalid JSON body');
    });

    it('passes valid input to handler', async () => {
      const schema = z.object({ name: z.string() });
      const handler = apiHandler({ schema })(async (_req, _ctx, input) => {
        return { received: input.name };
      });

      const req = createRequest('POST', '/api/test', { body: { name: 'John' } });
      const res = await handler(req);

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data).toEqual({ received: 'John' });
    });
  });

  describe('APIError handling', () => {
    it('returns APIError status and code', async () => {
      const handler = apiHandler({})(async () => {
        throw new APIError('Not found', 'NOT_FOUND');
      });

      const req = createRequest('GET', '/api/test');
      const res = await handler(req);

      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.error.code).toBe('NOT_FOUND');
      expect(body.error.message).toBe('Not found');
    });

    it('includes APIError details', async () => {
      const handler = apiHandler({})(async () => {
        throw new APIError('Locked', 'LESSON_LOCKED', { blockedBy: 'lesson-1' });
      });

      const req = createRequest('GET', '/api/test');
      const res = await handler(req);

      const body = await res.json();
      expect(body.error.details).toEqual({ blockedBy: 'lesson-1' });
    });
  });

  describe('generic error handling', () => {
    it('returns 500 INTERNAL without stack', async () => {
      const handler = apiHandler({})(async () => {
        throw new Error('Database connection failed');
      });

      const req = createRequest('GET', '/api/test');
      const res = await handler(req);

      expect(res.status).toBe(500);
      const body = await res.json();
      expect(body.error.code).toBe('INTERNAL');
      expect(body.error.message).toBe('An unexpected error occurred');
      expect(body.error.details).toBeUndefined();
    });
  });

  describe('CSRF protection', () => {
    it('rejects POST with cross-origin sec-fetch-site', async () => {
      const handler = apiHandler({})(async () => ({ ok: true }));

      const req = createRequest('POST', '/api/test', {
        body: {},
        headers: { 'sec-fetch-site': 'cross-site' },
      });
      const res = await handler(req);

      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.error.code).toBe('FORBIDDEN_ORIGIN');
    });

    it('rejects POST with mismatched origin', async () => {
      const handler = apiHandler({})(async () => ({ ok: true }));

      const req = createRequest('POST', '/api/test', {
        body: {},
        headers: { origin: 'http://evil.com' },
      });
      const res = await handler(req);

      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.error.code).toBe('FORBIDDEN_ORIGIN');
    });

    it('allows same-origin POST', async () => {
      const handler = apiHandler({})(async () => ({ ok: true }));

      const req = createRequest('POST', '/api/test', {
        body: {},
        headers: { 'sec-fetch-site': 'same-origin' },
      });
      const res = await handler(req);

      expect(res.status).toBe(200);
    });

    it('allows GET regardless of origin', async () => {
      const handler = apiHandler({})(async () => ({ ok: true }));

      const req = createRequest('GET', '/api/test', {
        headers: { 'sec-fetch-site': 'cross-site' },
      });
      const res = await handler(req);

      expect(res.status).toBe(200);
    });
  });

  describe('request ID', () => {
    it('propagates x-request-id header', async () => {
      let capturedCtx: { requestId?: string } | undefined;
      const handler = apiHandler({})(async (_req, ctx) => {
        capturedCtx = ctx;
        return { ok: true };
      });

      const req = createRequest('GET', '/api/test', {
        headers: { 'x-request-id': 'test-id-123' },
      });
      await handler(req);

      expect(capturedCtx?.requestId).toBe('test-id-123');
    });

    it('generates request ID if not provided', async () => {
      let capturedCtx: { requestId?: string } | undefined;
      const handler = apiHandler({})(async (_req, ctx) => {
        capturedCtx = ctx;
        return { ok: true };
      });

      const req = createRequest('GET', '/api/test');
      await handler(req);

      expect(capturedCtx?.requestId).toBeDefined();
      expect(capturedCtx?.requestId?.length).toBeGreaterThan(0);
    });
  });

  describe('capability check', () => {
    it('returns 401 UNAUTHENTICATED when no user', async () => {
      // Mock the request context module
      jest.doMock('@/lib/authz/request-context', () => ({
        getRequestContext: jest.fn().mockResolvedValue({
          institution: { id: 'inst-1' },
          person: null,
          capabilities: new Map(),
          accountStatusByEnrollment: new Map(),
          requestId: 'req-1',
        }),
      }));

      // Need to re-import apiHandler to pick up the mock
      jest.resetModules();
      const { apiHandler: freshHandler } = await import('@/lib/http/api-handler');

      const handler = freshHandler({
        capability: 'lesson.read',
      })(async () => ({ ok: true }));

      const req = createRequest('GET', '/api/test');
      const res = await handler(req);

      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.error.code).toBe('UNAUTHENTICATED');
    });
  });

  describe('Response passthrough', () => {
    it('returns NextResponse as-is when handler returns one', async () => {
      const { NextResponse } = await import('next/server');
      const handler = apiHandler({})(async () => {
        return NextResponse.json({ custom: true }, { status: 201 });
      });

      const req = createRequest('GET', '/api/test');
      const res = await handler(req);

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body).toEqual({ custom: true });
    });
  });
});
