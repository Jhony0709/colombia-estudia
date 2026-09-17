/** @jest-environment node */
/**
 * Tests for MFA endpoints: enroll, verify, factors.
 * SSOT: docs/estado.md §9b corrections - require session, cleanup unverified factors
 */

// Mock Supabase
const mockEnroll = jest.fn();
const mockChallenge = jest.fn();
const mockVerify = jest.fn();
const mockListFactors = jest.fn();
const mockUnenroll = jest.fn();
const mockGetSupabaseUser = jest.fn();
jest.mock('@/lib/auth/supabase-server', () => ({
  createServerSupabaseClient: jest.fn(() => ({
    auth: {
      mfa: {
        enroll: mockEnroll,
        challenge: mockChallenge,
        verify: mockVerify,
        listFactors: mockListFactors,
        unenroll: mockUnenroll,
      },
    },
  })),
  getSupabaseUser: mockGetSupabaseUser,
}));

import { NextRequest } from 'next/server';

describe('MFA endpoints', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
  });

  function createRequest(path: string, method: string, body?: object) {
    return new NextRequest(new URL(path, 'http://localhost:3000'), {
      method,
      headers: {
        'Content-Type': 'application/json',
        'sec-fetch-site': 'same-origin',
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  describe('POST /api/auth/mfa/enroll', () => {
    it('returns 401 when not authenticated', async () => {
      mockGetSupabaseUser.mockResolvedValue(null);

      const { POST } = require('@/app/api/auth/mfa/enroll/route');
      const response = await POST(createRequest('/api/auth/mfa/enroll', 'POST'));

      expect(response.status).toBe(401);
      const body = await response.json();
      expect(body.error.code).toBe('UNAUTHENTICATED');
    });

    it('cleans up unverified TOTP factors before enrolling', async () => {
      mockGetSupabaseUser.mockResolvedValue({ id: 'auth-user-1' });
      mockListFactors.mockResolvedValue({
        data: {
          all: [
            { id: 'factor-1', factor_type: 'totp', status: 'unverified' },
            { id: 'factor-2', factor_type: 'totp', status: 'verified' },
            { id: 'factor-3', factor_type: 'totp', status: 'unverified' },
          ],
          totp: [{ id: 'factor-2', factor_type: 'totp', status: 'verified' }],
        },
      });
      mockUnenroll.mockResolvedValue({ error: null });
      mockEnroll.mockResolvedValue({
        data: {
          id: 'new-factor-id',
          totp: { qr_code: 'data:image/png;base64,QR', secret: 'ABCDEFG' },
        },
        error: null,
      });

      jest.resetModules();
      const { POST } = require('@/app/api/auth/mfa/enroll/route');
      const response = await POST(createRequest('/api/auth/mfa/enroll', 'POST'));

      // Should unenroll both unverified factors
      expect(mockUnenroll).toHaveBeenCalledTimes(2);
      expect(mockUnenroll).toHaveBeenCalledWith({ factorId: 'factor-1' });
      expect(mockUnenroll).toHaveBeenCalledWith({ factorId: 'factor-3' });
      // Should not unenroll verified factor
      expect(mockUnenroll).not.toHaveBeenCalledWith({ factorId: 'factor-2' });

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.data.factorId).toBe('new-factor-id');
      expect(body.data.qr).toBe('data:image/png;base64,QR');
      expect(body.data.secret).toBe('ABCDEFG');
    });

    it('returns QR code and factor data on successful enroll', async () => {
      mockGetSupabaseUser.mockResolvedValue({ id: 'auth-user-1' });
      mockListFactors.mockResolvedValue({ data: { all: [], totp: [] } });
      mockEnroll.mockResolvedValue({
        data: {
          id: 'factor-id',
          totp: { qr_code: 'data:image/png;base64,QRCODE', secret: 'SECRETKEY' },
        },
        error: null,
      });

      jest.resetModules();
      const { POST } = require('@/app/api/auth/mfa/enroll/route');
      const response = await POST(createRequest('/api/auth/mfa/enroll', 'POST'));

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.data.factorId).toBe('factor-id');
      expect(body.data.qr).toBe('data:image/png;base64,QRCODE');
      expect(body.data.secret).toBe('SECRETKEY');
    });
  });

  describe('POST /api/auth/mfa/verify', () => {
    it('returns 401 when not authenticated', async () => {
      mockGetSupabaseUser.mockResolvedValue(null);

      jest.resetModules();
      const { POST } = require('@/app/api/auth/mfa/verify/route');
      const response = await POST(
        createRequest('/api/auth/mfa/verify', 'POST', {
          factorId: 'factor-1',
          code: '123456',
        })
      );

      expect(response.status).toBe(401);
      const body = await response.json();
      expect(body.error.code).toBe('UNAUTHENTICATED');
    });

    it('returns 400 for invalid code', async () => {
      mockGetSupabaseUser.mockResolvedValue({ id: 'auth-user-1' });
      mockChallenge.mockResolvedValue({
        data: { id: 'challenge-1' },
        error: null,
      });
      mockVerify.mockResolvedValue({
        error: { message: 'Invalid code' },
      });

      jest.resetModules();
      const { POST } = require('@/app/api/auth/mfa/verify/route');
      const response = await POST(
        createRequest('/api/auth/mfa/verify', 'POST', {
          factorId: 'factor-1',
          code: '000000',
        })
      );

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error.code).toBe('VALIDATION_ERROR');
      expect(body.error.message).toBe('Código inválido');
    });

    it('returns success for valid code', async () => {
      mockGetSupabaseUser.mockResolvedValue({ id: 'auth-user-1' });
      mockChallenge.mockResolvedValue({
        data: { id: 'challenge-1' },
        error: null,
      });
      mockVerify.mockResolvedValue({ error: null });

      jest.resetModules();
      const { POST } = require('@/app/api/auth/mfa/verify/route');
      const response = await POST(
        createRequest('/api/auth/mfa/verify', 'POST', {
          factorId: 'factor-1',
          code: '123456',
        })
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.data.success).toBe(true);
    });

    it('creates challenge before verifying', async () => {
      mockGetSupabaseUser.mockResolvedValue({ id: 'auth-user-1' });
      mockChallenge.mockResolvedValue({
        data: { id: 'challenge-abc' },
        error: null,
      });
      mockVerify.mockResolvedValue({ error: null });

      jest.resetModules();
      const { POST } = require('@/app/api/auth/mfa/verify/route');
      await POST(
        createRequest('/api/auth/mfa/verify', 'POST', {
          factorId: 'factor-xyz',
          code: '123456',
        })
      );

      expect(mockChallenge).toHaveBeenCalledWith({ factorId: 'factor-xyz' });
      expect(mockVerify).toHaveBeenCalledWith({
        factorId: 'factor-xyz',
        challengeId: 'challenge-abc',
        code: '123456',
      });
    });
  });

  describe('GET /api/auth/mfa/factors', () => {
    it('returns 401 when not authenticated', async () => {
      mockGetSupabaseUser.mockResolvedValue(null);

      jest.resetModules();
      const { GET } = require('@/app/api/auth/mfa/factors/route');
      const response = await GET(createRequest('/api/auth/mfa/factors', 'GET'));

      expect(response.status).toBe(401);
      const body = await response.json();
      expect(body.error.code).toBe('UNAUTHENTICATED');
    });

    it('returns factors list when authenticated', async () => {
      mockGetSupabaseUser.mockResolvedValue({ id: 'auth-user-1' });
      mockListFactors.mockResolvedValue({
        data: {
          totp: [
            { id: 'factor-1', status: 'verified', friendly_name: 'My Phone' },
            { id: 'factor-2', status: 'verified', friendly_name: null },
          ],
        },
        error: null,
      });

      jest.resetModules();
      const { GET } = require('@/app/api/auth/mfa/factors/route');
      const response = await GET(createRequest('/api/auth/mfa/factors', 'GET'));

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.data.factors).toHaveLength(2);
      expect(body.data.factors[0]).toEqual({
        id: 'factor-1',
        status: 'verified',
        friendlyName: 'My Phone',
      });
      expect(body.data.factors[1]).toEqual({
        id: 'factor-2',
        status: 'verified',
        friendlyName: null,
      });
    });
  });
});
