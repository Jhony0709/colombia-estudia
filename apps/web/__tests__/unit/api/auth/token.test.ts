/** @jest-environment node */
/**
 * POST /api/auth/token and POST /api/auth/refresh (reference/02-api/endpoints.md, 27/11).
 */

import { NextRequest } from 'next/server';

const mockSignIn = jest.fn();
const mockRefresh = jest.fn();
const mockRevoke = jest.fn();
const mockGetUser = jest.fn();
const mockSetSession = jest.fn();
const mockVerify = jest.fn();
const mockBearer = jest.fn();
jest.mock('@/lib/auth/supabase-server', () => ({
  createStatelessSupabaseClient: () => ({
    auth: {
      signInWithPassword: mockSignIn,
      refreshSession: mockRefresh,
      getUser: mockGetUser,
      setSession: mockSetSession,
      mfa: { challengeAndVerify: mockVerify },
    },
  }),
  revokeSession: (jwt: string) => mockRevoke(jwt),
  bearerToken: () => mockBearer(),
}));
jest.mock('@/lib/authz/request-context', () => ({ MFA_REQUIRED_ROLES: ['ADMIN', 'OPERATIONS'] }));
jest.mock('@/lib/observability/logger', () => ({
  ...jest.requireActual('@/lib/observability/logger'),
  logger: { warn: jest.fn(), info: jest.fn(), error: jest.fn() },
}));
jest.mock('@/lib/authz/institution-cache', () => ({
  resolveInstitutionBySlug: jest.fn(async () => ({ id: 'inst-1' })),
}));
const mockPerson = jest.fn();
jest.mock('@/lib/db/tenant', () => ({
  createTenantClient: () => ({
    person: { findUnique: mockPerson },
    institution: { findUnique: async () => ({ requireStaffMfa: true }) },
  }),
}));

import { POST as token } from '@/app/api/auth/token/route';
import { POST as refresh } from '@/app/api/auth/refresh/route';
import { POST as tokenMfa } from '@/app/api/auth/token/mfa/route';
import { resetRateLimits } from '@/lib/http/rate-limit';

const session = { access_token: 'at-1', refresh_token: 'rt-1', expires_at: 1_900_000_000 };
const tokens = { accessToken: 'at-1', refreshToken: 'rt-1', expiresAt: 1_900_000_000 };

// Like the app: JSON and no Origin (reference/03-ui/movil.md «Sesión»).
const post = (path: string, body: object) =>
  new NextRequest(new URL(path, 'http://localhost:3000'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

const student = { memberships: [{ role: 'STUDENT', revokedAt: null }] };

beforeEach(() => {
  resetRateLimits();
  jest.clearAllMocks();
  mockSignIn.mockResolvedValue({ data: { user: { id: 'auth-1' }, session }, error: null });
  mockRevoke.mockResolvedValue(undefined);
});

describe('POST /api/auth/token', () => {
  it('gives a student the tokens of the session', async () => {
    mockPerson.mockResolvedValue(student);
    const res = await token(post('/api/auth/token', { email: ' Ana@X.co ', password: 'secreta' }));
    expect(res.status).toBe(200);
    expect((await res.json()).data).toEqual(tokens);
    expect(mockSignIn).toHaveBeenCalledWith({ email: 'ana@x.co', password: 'secreta' });
    expect(mockRevoke).not.toHaveBeenCalled();
  });

  it('answers the same whether the email exists or not', async () => {
    mockSignIn.mockResolvedValue({ data: { user: null, session: null }, error: { code: 'x' } });
    const res = await token(post('/api/auth/token', { email: 'ana@x.co', password: 'mala' }));
    expect(res.status).toBe(401);
    expect((await res.json()).error.message).toBe('Correo o contraseña incorrectos');
  });

  it('closes the session of an account without a Person here', async () => {
    mockPerson.mockResolvedValue(null);
    const res = await token(post('/api/auth/token', { email: 'ana@x.co', password: 'secreta' }));
    expect(res.status).toBe(401);
    expect(mockRevoke).toHaveBeenCalledWith('at-1');
  });

  it('asks staff with a mandatory second factor for the code of its TOTP', async () => {
    mockPerson.mockResolvedValue({ memberships: [{ role: 'OPERATIONS', revokedAt: null }] });
    mockGetUser.mockResolvedValue({
      data: {
        user: {
          factors: [
            { id: 'f-0', factor_type: 'totp', status: 'unverified' },
            { id: 'f-1', factor_type: 'totp', status: 'verified' },
          ],
        },
      },
    });
    const res = await token(post('/api/auth/token', { email: 'ops@x.co', password: 'secreta' }));
    expect(res.status).toBe(200);
    expect((await res.json()).data).toEqual({ ...tokens, mfa: { factorId: 'f-1' } });
    expect(mockGetUser).toHaveBeenCalledWith('at-1');
    expect(mockRevoke).not.toHaveBeenCalled();
  });

  it('sends staff without a verified TOTP to the web, without a session', async () => {
    mockPerson.mockResolvedValue({ memberships: [{ role: 'ADMIN', revokedAt: null }] });
    mockGetUser.mockResolvedValue({ data: { user: { factors: [] } } });
    const res = await token(post('/api/auth/token', { email: 'admin@x.co', password: 'secreta' }));
    expect(res.status).toBe(403);
    expect((await res.json()).error).toMatchObject({
      code: 'INSUFFICIENT_CAPABILITY',
      message: 'Activa el segundo factor en la web.',
    });
    expect(mockRevoke).toHaveBeenCalledWith('at-1');
  });

  it('shares the attempts of the web login', async () => {
    mockSignIn.mockResolvedValue({ data: { user: null, session: null }, error: { code: 'x' } });
    for (let i = 0; i < 10; i++)
      await token(post('/api/auth/token', { email: 'ana@x.co', password: 'x' }));
    const res = await token(post('/api/auth/token', { email: 'ana@x.co', password: 'x' }));
    expect(res.status).toBe(429);
  });

  it('rejects a body that is not an email and a password', async () => {
    const res = await token(post('/api/auth/token', { email: 'ana', password: '' }));
    expect(res.status).toBe(400);
    expect(mockSignIn).not.toHaveBeenCalled();
  });
});

describe('POST /api/auth/refresh', () => {
  it('gives the new pair', async () => {
    mockRefresh.mockResolvedValue({ data: { session }, error: null });
    const res = await refresh(post('/api/auth/refresh', { refreshToken: 'rt-0' }));
    expect(res.status).toBe(200);
    expect((await res.json()).data).toEqual(tokens);
    expect(mockRefresh).toHaveBeenCalledWith({ refresh_token: 'rt-0' });
  });

  it('answers 401 to a token Supabase no longer accepts', async () => {
    mockRefresh.mockResolvedValue({
      data: { session: null },
      error: { code: 'refresh_token_not_found' },
    });
    const res = await refresh(post('/api/auth/refresh', { refreshToken: 'rt-0' }));
    expect(res.status).toBe(401);
  });

  it('rejects an empty token', async () => {
    const res = await refresh(post('/api/auth/refresh', { refreshToken: '' }));
    expect(res.status).toBe(400);
  });
});

describe('POST /api/auth/token/mfa', () => {
  const body = { refreshToken: 'rt-1', factorId: 'f-1', code: '123456' };

  beforeEach(() => {
    mockBearer.mockResolvedValue('at-1');
    mockSetSession.mockResolvedValue({ error: null });
  });

  it('trades the aal1 pair for an aal2 one', async () => {
    mockVerify.mockResolvedValue({
      data: { access_token: 'at-2', refresh_token: 'rt-2', expires_in: 3600 },
      error: null,
    });
    const res = await tokenMfa(post('/api/auth/token/mfa', body));
    expect(res.status).toBe(200);
    expect((await res.json()).data).toMatchObject({ accessToken: 'at-2', refreshToken: 'rt-2' });
    expect(mockSetSession).toHaveBeenCalledWith({ access_token: 'at-1', refresh_token: 'rt-1' });
    expect(mockVerify).toHaveBeenCalledWith({ factorId: 'f-1', code: '123456' });
  });

  it('answers 400 to a wrong code', async () => {
    mockVerify.mockResolvedValue({ data: null, error: { code: 'mfa_verification_failed' } });
    const res = await tokenMfa(post('/api/auth/token/mfa', body));
    expect(res.status).toBe(400);
    expect((await res.json()).error.message).toBe('Código inválido');
  });

  it('answers 401 without a Bearer or with a session Supabase no longer accepts', async () => {
    mockBearer.mockResolvedValue(null);
    expect((await tokenMfa(post('/api/auth/token/mfa', body))).status).toBe(401);
    mockBearer.mockResolvedValue('at-1');
    mockSetSession.mockResolvedValue({ error: { code: 'session_expired' } });
    expect((await tokenMfa(post('/api/auth/token/mfa', body))).status).toBe(401);
    expect(mockVerify).not.toHaveBeenCalled();
  });

  it('rejects a code that is not 6 digits', async () => {
    const res = await tokenMfa(post('/api/auth/token/mfa', { ...body, code: '12ab' }));
    expect(res.status).toBe(400);
    expect(mockSetSession).not.toHaveBeenCalled();
  });
});
