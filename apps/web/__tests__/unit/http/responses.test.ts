/** @jest-environment node */
/**
 * Tests for lib/http/responses.ts
 */

import { success, error } from '@/lib/http/responses';

describe('success', () => {
  it('returns { data } with default status 200', async () => {
    const res = success({ foo: 'bar' });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ data: { foo: 'bar' } });
  });

  it('returns { data } with custom status', async () => {
    const res = success({ created: true }, 201);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body).toEqual({ data: { created: true } });
  });

  it('handles null data', async () => {
    const res = success(null);
    const body = await res.json();
    expect(body).toEqual({ data: null });
  });
});

describe('error', () => {
  it('returns { error: { code, message } }', async () => {
    const res = error('VALIDATION_ERROR', 'Invalid input', 400);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toEqual({
      error: { code: 'VALIDATION_ERROR', message: 'Invalid input' },
    });
  });

  it('includes details when provided', async () => {
    const details = { field: 'email' };
    const res = error('VALIDATION_ERROR', 'Invalid', 400, details);
    const body = await res.json();
    expect(body).toEqual({
      error: { code: 'VALIDATION_ERROR', message: 'Invalid', details: { field: 'email' } },
    });
  });

  it('handles 500 errors', async () => {
    const res = error('INTERNAL', 'Something went wrong', 500);
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error.code).toBe('INTERNAL');
  });
});
