import { ApiError, endSession, request, startSession } from '../src/api';
import { abandon, currentUser, recover, signIn, signOut, verifyCode } from '../src/session';
import { homeOf } from '../src/roles';

jest.mock('../src/api', () => ({
  ...jest.requireActual('../src/api'),
  request: jest.fn(),
  startSession: jest.fn(),
  endSession: jest.fn(),
}));
const call = request as jest.MockedFunction<typeof request>;

const student = { person: { id: 'p1', givenName: 'Ana', familyName: 'Ríos' }, roles: ['STUDENT'] };
const tokens = { accessToken: 'at-1', refreshToken: 'rt-1', expiresAt: 1_900_000_000 };

afterEach(() => jest.clearAllMocks());

describe('homeOf', () => {
  it.each([
    [['ADMIN'], '/mensajes'],
    [['OPERATIONS', 'STUDENT'], '/mensajes'],
    [['STUDENT'], '/aprender'],
    [['INSTRUCTOR'], null],
    [['GUARDIAN', 'PARTNER_CONTACT'], null],
  ])('%p → %p', (roles, home) => {
    expect(homeOf({ ...student, roles })).toBe(home);
  });
});

describe('session', () => {
  it('has no user on a 401, and lets any other error through', async () => {
    call.mockRejectedValueOnce(new ApiError(401, 'UNAUTHENTICATED', 'x'));
    await expect(currentUser()).resolves.toBeNull();
    call.mockRejectedValueOnce(new ApiError(0, 'NETWORK', 'x'));
    await expect(currentUser()).rejects.toMatchObject({ code: 'NETWORK' });
  });

  it('signs a student in with a token', async () => {
    call.mockResolvedValueOnce(tokens).mockResolvedValueOnce(student);
    await expect(signIn('ana@x.co', 'secreta')).resolves.toEqual({ kind: 'in', me: student });
    expect(call).toHaveBeenNthCalledWith(1, '/api/auth/token', {
      method: 'POST',
      body: { email: 'ana@x.co', password: 'secreta' },
      auth: false,
    });
    expect(startSession).toHaveBeenCalledWith(tokens);
  });

  it('keeps the aal1 pair of staff in memory until the code', async () => {
    call.mockResolvedValueOnce({ ...tokens, mfa: { factorId: 'f-1' } });
    await expect(signIn('ops@x.co', 'secreta')).resolves.toEqual({
      kind: 'mfa',
      pending: { tokens, factorId: 'f-1' },
    });
    expect(startSession).not.toHaveBeenCalled();
  });

  it('trades the code for the aal2 pair, with the aal1 one as Bearer', async () => {
    const aal2 = { ...tokens, accessToken: 'at-2', refreshToken: 'rt-2' };
    call.mockResolvedValueOnce(aal2).mockResolvedValueOnce({ ...student, roles: ['ADMIN'] });
    const result = await verifyCode({ tokens, factorId: 'f-1' }, '123456');
    expect(result.kind).toBe('in');
    expect(call).toHaveBeenNthCalledWith(1, '/api/auth/token/mfa', {
      method: 'POST',
      body: { refreshToken: 'rt-1', factorId: 'f-1', code: '123456' },
      auth: false,
      token: 'at-1',
    });
    expect(startSession).toHaveBeenCalledWith(aal2);
  });

  it('closes the session of a role the app has nothing for', async () => {
    call
      .mockResolvedValueOnce(tokens)
      .mockResolvedValueOnce({ ...student, roles: ['INSTRUCTOR'] })
      .mockResolvedValueOnce({ signedOut: true });
    await expect(signIn('profe@x.co', 'secreta')).resolves.toEqual({ kind: 'other' });
    expect(call).toHaveBeenLastCalledWith('/api/auth/logout', { method: 'POST' });
    expect(endSession).toHaveBeenCalled();
  });

  it('revokes the aal1 session of whoever gives up on the code', async () => {
    call.mockResolvedValueOnce({ signedOut: true });
    await abandon({ tokens, factorId: 'f-1' });
    expect(call).toHaveBeenCalledWith('/api/auth/logout', {
      method: 'POST',
      auth: false,
      token: 'at-1',
    });
  });

  it('forgets on the phone even when the server does not answer', async () => {
    call.mockRejectedValueOnce(new ApiError(0, 'NETWORK', 'x'));
    await expect(signOut()).resolves.toBeUndefined();
    expect(endSession).toHaveBeenCalled();
  });

  it('asks for the recovery link without a session', async () => {
    call.mockResolvedValueOnce({ message: 'ok' });
    await recover('ana@x.co');
    expect(call).toHaveBeenCalledWith('/api/auth/recover', {
      method: 'POST',
      body: { email: 'ana@x.co' },
      auth: false,
    });
  });
});
