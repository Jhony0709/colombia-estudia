/**
 * Tests for lib/core/errors.ts
 */

import { APIError, isAPIError, API_ERROR_CODES } from '@/lib/core/errors';

describe('APIError', () => {
  it('sets correct status from VALIDATION_ERROR code', () => {
    const err = new APIError('test', 'VALIDATION_ERROR');
    expect(err.status).toBe(400);
    expect(err.code).toBe('VALIDATION_ERROR');
    expect(err.message).toBe('test');
  });

  it('sets correct status from UNAUTHENTICATED code', () => {
    const err = new APIError('no session', 'UNAUTHENTICATED');
    expect(err.status).toBe(401);
  });

  it('sets correct status from INSUFFICIENT_CAPABILITY code', () => {
    const err = new APIError('forbidden', 'INSUFFICIENT_CAPABILITY');
    expect(err.status).toBe(403);
  });

  it('sets correct status from FORBIDDEN_ORIGIN code', () => {
    const err = new APIError('cross-origin', 'FORBIDDEN_ORIGIN');
    expect(err.status).toBe(403);
  });

  it('sets correct status from NOT_FOUND code', () => {
    const err = new APIError('not found', 'NOT_FOUND');
    expect(err.status).toBe(404);
  });

  it('sets correct status from CONFLICT code', () => {
    const err = new APIError('duplicate', 'CONFLICT');
    expect(err.status).toBe(409);
  });

  it('sets correct status from ATTEMPT_EXPIRED code', () => {
    const err = new APIError('expired', 'ATTEMPT_EXPIRED');
    expect(err.status).toBe(410);
  });

  it('sets correct status from LESSON_LOCKED code', () => {
    const err = new APIError('locked', 'LESSON_LOCKED');
    expect(err.status).toBe(423);
  });

  it('sets correct status from RATE_LIMITED code', () => {
    const err = new APIError('slow down', 'RATE_LIMITED');
    expect(err.status).toBe(429);
  });

  it('sets correct status from INTERNAL code', () => {
    const err = new APIError('oops', 'INTERNAL');
    expect(err.status).toBe(500);
  });

  it('includes details when provided', () => {
    const details = { field: 'email', reason: 'invalid' };
    const err = new APIError('validation', 'VALIDATION_ERROR', details);
    expect(err.details).toEqual(details);
  });

  it('has name APIError', () => {
    const err = new APIError('test', 'INTERNAL');
    expect(err.name).toBe('APIError');
  });
});

describe('isAPIError', () => {
  it('returns true for APIError', () => {
    const err = new APIError('test', 'INTERNAL');
    expect(isAPIError(err)).toBe(true);
  });

  it('returns false for regular Error', () => {
    const err = new Error('test');
    expect(isAPIError(err)).toBe(false);
  });

  it('returns false for null', () => {
    expect(isAPIError(null)).toBe(false);
  });

  it('returns false for undefined', () => {
    expect(isAPIError(undefined)).toBe(false);
  });

  it('returns false for string', () => {
    expect(isAPIError('error')).toBe(false);
  });
});

describe('API_ERROR_CODES', () => {
  it('contains expected codes', () => {
    expect(API_ERROR_CODES).toContain('VALIDATION_ERROR');
    expect(API_ERROR_CODES).toContain('FORBIDDEN_ORIGIN');
    expect(API_ERROR_CODES).toContain('INTERNAL');
  });
});
