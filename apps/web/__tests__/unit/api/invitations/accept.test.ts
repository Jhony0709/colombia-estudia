/** @jest-environment node */
/**
 * Tests for POST /api/invitations/[token]/accept endpoint.
 * SSOT: docs/estado.md §9c
 */

import { NextRequest } from 'next/server';

// Mock server-only
jest.mock('server-only', () => ({}));

// Mock validate token
const mockValidateInvitationToken = jest.fn();
jest.mock('@/lib/invitations/validate-token', () => ({
  validateInvitationToken: (...args: unknown[]) => mockValidateInvitationToken(...args),
}));

// Mock supabase admin
const mockSupabaseCreateUser = jest.fn();
const mockSupabaseDeleteUser = jest.fn();
const mockSignInWithPassword = jest.fn();
jest.mock('@/lib/auth/supabase-server', () => ({
  getSupabaseAdmin: () => ({
    auth: {
      admin: {
        createUser: (...args: unknown[]) => mockSupabaseCreateUser(...args),
        deleteUser: (...args: unknown[]) => mockSupabaseDeleteUser(...args),
      },
    },
  }),
  createServerSupabaseClient: async () => ({
    auth: { signInWithPassword: (...args: unknown[]) => mockSignInWithPassword(...args) },
  }),
}));

// Mock prisma
const mockPrismaPersonFindUnique = jest.fn();
const mockPrismaTransaction = jest.fn();
jest.mock('@/lib/db/tenant', () => ({
  prisma: {
    person: { findUnique: (...args: unknown[]) => mockPrismaPersonFindUnique(...args) },
    $transaction: (...args: unknown[]) => mockPrismaTransaction(...args),
  },
}));

// Import after mocks
import { POST } from '@/app/api/invitations/[token]/accept/route';

describe('POST /api/invitations/[token]/accept', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSupabaseCreateUser.mockResolvedValue({
      data: { user: { id: 'auth-user-123' } },
      error: null,
    });
    mockPrismaTransaction.mockResolvedValue(undefined);
    mockSignInWithPassword.mockResolvedValue({ error: null });
  });

  function createRequest(token: string, body: object) {
    return new NextRequest(new URL(`/api/invitations/${token}/accept`, 'http://localhost'), {
      method: 'POST',
      // apiHandler CSRF: same-origin request
      headers: { 'Content-Type': 'application/json', 'sec-fetch-site': 'same-origin' },
      body: JSON.stringify(body),
    });
  }

  async function callEndpoint(token: string, body: object) {
    return POST(createRequest(token, body), { params: Promise.resolve({ token }) });
  }

  it('returns 404 when invitation not found', async () => {
    mockValidateInvitationToken.mockResolvedValue({ status: 'not_found' });

    const response = await callEndpoint('invalid-token', {
      password: 'securePassword123',
      acceptsDataPolicy: true,
    });
    expect(response.status).toBe(404);

    const body = await response.json();
    expect(body.error.code).toBe('NOT_FOUND');
  });

  it('returns 410 when invitation expired', async () => {
    mockValidateInvitationToken.mockResolvedValue({ status: 'expired' });

    const response = await callEndpoint('expired-token', {
      password: 'securePassword123',
      acceptsDataPolicy: true,
    });
    expect(response.status).toBe(410);

    const body = await response.json();
    expect(body.error.code).toBe('ACCESS_EXPIRED');
  });

  it('returns 400 when password is too short', async () => {
    const response = await callEndpoint('valid-token', {
      password: 'short',
      acceptsDataPolicy: true,
    });
    expect(response.status).toBe(400);

    const body = await response.json();
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 403 when adult does not accept data policy', async () => {
    mockValidateInvitationToken.mockResolvedValue({
      status: 'valid',
      givenName: 'Juan',
      isMinor: false,
      institutionName: 'Test',
      dataPolicyUrl: 'https://example.com/policy',
      invitationId: 'inv-123',
      institutionId: 'inst-1',
      personId: 'person-1',
      dataPolicyVersion: '1',
    });
    mockPrismaPersonFindUnique.mockResolvedValue({ email: 'juan@example.com' });

    const response = await callEndpoint('valid-token', {
      password: 'securePassword123',
      acceptsDataPolicy: false,
    });
    expect(response.status).toBe(403);

    const body = await response.json();
    expect(body.error.code).toBe('CONSENT_REQUIRED');
  });

  it('allows minor without checkbox (consent via guardian)', async () => {
    mockValidateInvitationToken.mockResolvedValue({
      status: 'valid',
      givenName: 'María',
      isMinor: true,
      institutionName: 'Test',
      dataPolicyUrl: null,
      invitationId: 'inv-123',
      institutionId: 'inst-1',
      personId: 'person-1',
      dataPolicyVersion: '1',
    });
    mockPrismaPersonFindUnique.mockResolvedValue({ email: 'maria@example.com' });

    const response = await callEndpoint('minor-token', {
      password: 'securePassword123',
      acceptsDataPolicy: false, // Minor doesn't need to accept
    });
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.data.next).toBe('/ingresar');
  });

  it('creates Auth user, updates Person, Consent, Invitation, AuditLog', async () => {
    mockValidateInvitationToken.mockResolvedValue({
      status: 'valid',
      givenName: 'Juan',
      isMinor: false,
      institutionName: 'Test',
      dataPolicyUrl: 'https://example.com/policy',
      invitationId: 'inv-123',
      institutionId: 'inst-1',
      personId: 'person-1',
      dataPolicyVersion: '1',
    });
    mockPrismaPersonFindUnique.mockResolvedValue({ email: 'juan@example.com' });

    const response = await callEndpoint('valid-token', {
      password: 'securePassword123',
      acceptsDataPolicy: true,
    });
    expect(response.status).toBe(200);

    // Verify Supabase user created
    expect(mockSupabaseCreateUser).toHaveBeenCalledWith({
      email: 'juan@example.com',
      password: 'securePassword123',
      email_confirm: true,
    });

    // Verify transaction was called
    expect(mockPrismaTransaction).toHaveBeenCalled();
  });

  it('rolls back Auth user if transaction fails', async () => {
    mockValidateInvitationToken.mockResolvedValue({
      status: 'valid',
      givenName: 'Juan',
      isMinor: false,
      institutionName: 'Test',
      dataPolicyUrl: 'https://example.com/policy',
      invitationId: 'inv-123',
      institutionId: 'inst-1',
      personId: 'person-1',
      dataPolicyVersion: '1',
    });
    mockPrismaPersonFindUnique.mockResolvedValue({ email: 'juan@example.com' });
    mockPrismaTransaction.mockImplementation(() => Promise.reject(new Error('Database error')));

    const response = await callEndpoint('valid-token', {
      password: 'securePassword123',
      acceptsDataPolicy: true,
    });
    expect(response.status).toBe(500);

    // Verify Auth user was deleted for rollback
    expect(mockSupabaseDeleteUser).toHaveBeenCalledWith('auth-user-123');
  });

  it('returns 500 when Supabase createUser fails', async () => {
    mockValidateInvitationToken.mockResolvedValue({
      status: 'valid',
      givenName: 'Juan',
      isMinor: false,
      institutionName: 'Test',
      dataPolicyUrl: 'https://example.com/policy',
      invitationId: 'inv-123',
      institutionId: 'inst-1',
      personId: 'person-1',
      dataPolicyVersion: '1',
    });
    mockPrismaPersonFindUnique.mockResolvedValue({ email: 'juan@example.com' });
    mockSupabaseCreateUser.mockResolvedValue({
      data: { user: null },
      error: { message: 'Email already exists' },
    });

    const response = await callEndpoint('valid-token', {
      password: 'securePassword123',
      acceptsDataPolicy: true,
    });
    expect(response.status).toBe(500);

    const body = await response.json();
    expect(body.error.code).toBe('INTERNAL');
  });

  it('starts the session server-side after registering (plan/03 "Sesión")', async () => {
    mockValidateInvitationToken.mockResolvedValue({
      status: 'valid',
      isMinor: true,
      personId: 'person-1',
      institutionId: 'inst-1',
      invitationId: 'inv-1',
      dataPolicyVersion: '1',
    });
    mockPrismaPersonFindUnique.mockResolvedValue({ email: 'ana@example.com' });

    const response = await POST(createRequest('tok', { password: 'una-contraseña-larga' }), {
      params: Promise.resolve({ token: 'tok' }),
    });

    expect(response.status).toBe(200);
    expect(mockSignInWithPassword).toHaveBeenCalledWith({
      email: 'ana@example.com',
      password: 'una-contraseña-larga',
    });
    expect((await response.json()).data.next).toBe('/ingresar');
  });

  it('returns 409 when the email already has an Auth account (email_exists)', async () => {
    mockValidateInvitationToken.mockResolvedValue({
      status: 'valid',
      isMinor: true,
      personId: 'person-1',
      institutionId: 'inst-1',
      invitationId: 'inv-1',
      dataPolicyVersion: '1',
    });
    mockPrismaPersonFindUnique.mockResolvedValue({ email: 'ana@example.com' });
    mockSupabaseCreateUser.mockResolvedValue({
      data: { user: null },
      error: { code: 'email_exists', message: 'exists' },
    });

    const response = await POST(createRequest('tok', { password: 'una-contraseña-larga' }), {
      params: Promise.resolve({ token: 'tok' }),
    });

    expect(response.status).toBe(409);
    expect(mockPrismaTransaction).not.toHaveBeenCalled();
    expect(mockSignInWithPassword).not.toHaveBeenCalled();
  });
});
