/**
 * Tests for route protection rules.
 */

import { isProtected, isValidNextUrl, sanitizeNextUrl } from '@/lib/authz/routes';

describe('isProtected', () => {
  describe('public routes', () => {
    it.each([
      '/auth/login',
      '/auth/callback',
      '/auth/logout',
      '/auth/recuperar',
      '/auth/restablecer/abc123',
      '/invitacion/token123',
      '/invitacion/some-long-token-here',
      '/certificado/abc123',
      '/api/health',
      '/api/auth/recover',
      '/api/auth/callback',
      '/api/invitations/token123/accept',
      '/api/certificates/abc123',
      '/api/webhooks/wompi',
      '/api/jobs/daily',
    ])('%s is NOT protected', (path) => {
      expect(isProtected(path)).toBe(false);
    });
  });

  describe('protected routes', () => {
    it.each([
      '/',
      '/aprender',
      '/aprender/tema/123',
      '/aprender/evaluacion/456',
      '/aprender/resultados',
      '/aprender/mi-cuenta',
      '/contenido',
      '/contenido/temas/123',
      '/cohortes',
      '/cohortes/123',
      '/personas',
      '/cartera',
      '/admin/institucion',
      '/admin/auditoria',
      '/api/me',
      '/api/learn/cohort',
      '/api/learn/lessons/123',
      '/api/content/lessons',
      '/api/billing/payments',
      '/notificaciones',
    ])('%s IS protected', (path) => {
      expect(isProtected(path)).toBe(true);
    });
  });
});

describe('isValidNextUrl', () => {
  describe('valid URLs', () => {
    it.each([
      '/',
      '/aprender',
      '/aprender/tema/123',
      '/contenido?tab=lessons',
      '/admin/auditoria#section',
      '/path/with/many/segments',
    ])('%s is valid', (url) => {
      expect(isValidNextUrl(url)).toBe(true);
    });
  });

  describe('invalid URLs', () => {
    it('rejects null', () => {
      expect(isValidNextUrl(null)).toBe(false);
    });

    it('rejects undefined', () => {
      expect(isValidNextUrl(undefined)).toBe(false);
    });

    it('rejects empty string', () => {
      expect(isValidNextUrl('')).toBe(false);
    });

    it('rejects protocol-relative URL (//evil.com)', () => {
      expect(isValidNextUrl('//evil.com')).toBe(false);
    });

    it('rejects protocol-relative with path (//evil.com/path)', () => {
      expect(isValidNextUrl('//evil.com/path')).toBe(false);
    });

    it('rejects https URL', () => {
      expect(isValidNextUrl('https://evil.com')).toBe(false);
    });

    it('rejects http URL', () => {
      expect(isValidNextUrl('http://evil.com')).toBe(false);
    });

    it('rejects URL without leading slash', () => {
      expect(isValidNextUrl('aprender')).toBe(false);
    });

    it('rejects URL with scheme in path', () => {
      expect(isValidNextUrl('/redirect?url=https://evil.com')).toBe(false);
    });

    it('rejects URL with backslash', () => {
      expect(isValidNextUrl('/path\\..\\evil')).toBe(false);
    });
  });
});

describe('sanitizeNextUrl', () => {
  it('returns valid URL unchanged', () => {
    expect(sanitizeNextUrl('/aprender/tema/123')).toBe('/aprender/tema/123');
  });

  it('returns "/" for invalid URL', () => {
    expect(sanitizeNextUrl('//evil.com')).toBe('/');
  });

  it('returns "/" for null', () => {
    expect(sanitizeNextUrl(null)).toBe('/');
  });

  it('returns "/" for undefined', () => {
    expect(sanitizeNextUrl(undefined)).toBe('/');
  });
});
