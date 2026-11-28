import * as SecureStore from 'expo-secure-store';
import { API_URL, ApiError, endSession, request, startSession } from '../src/api';

type Reply = { status: number; body: unknown };
const json = ({ status, body }: Reply) =>
  ({
    ok: status < 400,
    status,
    json: () =>
      body === null ? Promise.reject(new SyntaxError('no json')) : Promise.resolve(body),
  }) as Response;

// Responde por ruta; `null` en body: un cuerpo que no es JSON.
function server(routes: Record<string, Reply | ((init?: RequestInit) => Reply)>) {
  return jest.spyOn(globalThis, 'fetch').mockImplementation(async (url, init) => {
    const path = String(url).replace(API_URL, '');
    const route = routes[path];
    if (!route) throw new Error(`sin ruta ${path}`);
    return json(typeof route === 'function' ? route(init) : route);
  });
}

const now = () => Math.floor(Date.now() / 1000);
const tokens = (n: number, ttl = 3600) => ({
  accessToken: `at-${n}`,
  refreshToken: `rt-${n}`,
  expiresAt: now() + ttl,
});
const bearerOf = (init?: RequestInit) =>
  (init?.headers as Record<string, string> | undefined)?.Authorization;

beforeEach(async () => {
  await endSession();
  jest.restoreAllMocks();
  jest.clearAllMocks();
});

describe('request', () => {
  it('returns the data of the envelope, without a session and without cookies', async () => {
    // Un solo `tokens(1)`: dos llamadas pueden caer a cada lado de un segundo.
    const pair = tokens(1);
    const fetch = server({ '/api/auth/token': { status: 200, body: { data: pair } } });
    await expect(
      request('/api/auth/token', { method: 'POST', body: { email: 'a@b.co' }, auth: false })
    ).resolves.toEqual(pair);
    const [url, init] = fetch.mock.calls[0]!;
    expect(url).toBe(`${API_URL}/api/auth/token`);
    expect(init).toMatchObject({ method: 'POST', credentials: 'omit', body: '{"email":"a@b.co"}' });
    expect(bearerOf(init)).toBeUndefined();
  });

  it('turns the error of the envelope into an ApiError', async () => {
    server({
      '/api/auth/token': {
        status: 401,
        body: { error: { code: 'UNAUTHENTICATED', message: 'Correo o contraseña incorrectos' } },
      },
    });
    await expect(request('/api/auth/token', { method: 'POST', auth: false })).rejects.toMatchObject(
      {
        status: 401,
        code: 'UNAUTHENTICATED',
        message: 'Correo o contraseña incorrectos',
      }
    );
  });

  it('survives an error without JSON', async () => {
    server({ '/api/auth/token': { status: 502, body: null } });
    await expect(request('/api/auth/token', { auth: false })).rejects.toMatchObject({
      status: 502,
      code: 'INTERNAL',
    });
  });

  it('says NETWORK when nothing answers', async () => {
    jest.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Network request failed'));
    const error = await request('/api/auth/token', { auth: false }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 0, code: 'NETWORK' });
  });

  it('gives up after the timeout', async () => {
    jest.useFakeTimers();
    jest
      .spyOn(globalThis, 'fetch')
      .mockImplementation(
        (_url: RequestInfo | URL, init?: RequestInit) =>
          new Promise<Response>((_, reject) =>
            init?.signal?.addEventListener('abort', () => reject(new Error('aborted')))
          )
      );
    const pending = request('/api/auth/token', { auth: false }).catch((e: unknown) => e);
    jest.advanceTimersByTime(15_000);
    await expect(pending).resolves.toMatchObject({ code: 'NETWORK' });
    jest.useRealTimers();
  });
});

describe('the session', () => {
  it('sends the Bearer and keeps only the refreshToken on the phone', async () => {
    const fetch = server({ '/api/me': { status: 200, body: { data: 'ana' } } });
    await startSession(tokens(1));
    await expect(request('/api/me')).resolves.toBe('ana');
    expect(bearerOf(fetch.mock.calls[0]![1])).toBe('Bearer at-1');
    expect(SecureStore.setItemAsync).toHaveBeenLastCalledWith('alba.refreshToken', 'rt-1');
  });

  it('answers 401 without a session, without calling the server', async () => {
    const fetch = server({});
    await expect(request('/api/me')).rejects.toMatchObject({ status: 401 });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('renews when the app opens: only the refreshToken survived', async () => {
    await startSession(tokens(1));
    await SecureStore.setItemAsync('alba.refreshToken', 'rt-1');
    const fetch = server({
      '/api/auth/refresh': { status: 200, body: { data: tokens(2) } },
      '/api/me': (init) => ({ status: 200, body: { data: bearerOf(init) } }),
    });
    // Lo que queda tras reabrir: sin accessToken en memoria.
    await startSession({ ...tokens(1), expiresAt: 0 });
    await expect(request('/api/me')).resolves.toBe('Bearer at-2');
    expect(JSON.parse(String(fetch.mock.calls[0]![1]?.body))).toEqual({ refreshToken: 'rt-1' });
  });

  it('renews a minute before it expires', async () => {
    await startSession(tokens(1, 30));
    server({
      '/api/auth/refresh': { status: 200, body: { data: tokens(2) } },
      '/api/me': (init) => ({ status: 200, body: { data: bearerOf(init) } }),
    });
    await expect(request('/api/me')).resolves.toBe('Bearer at-2');
  });

  it('renews once on a 401, for every request waiting, and retries them', async () => {
    await startSession(tokens(1));
    let refreshes = 0;
    server({
      '/api/auth/refresh': () => (refreshes++, { status: 200, body: { data: tokens(2) } }),
      '/api/me': (init) =>
        bearerOf(init) === 'Bearer at-2'
          ? { status: 200, body: { data: 'ok' } }
          : { status: 401, body: { error: { code: 'UNAUTHENTICATED' } } },
    });
    await expect(
      Promise.all([request('/api/me'), request('/api/me'), request('/api/me')])
    ).resolves.toEqual(['ok', 'ok', 'ok']);
    expect(refreshes).toBe(1);
  });

  it('forgets the session when the renewal is refused', async () => {
    await startSession(tokens(1, 0));
    const fetch = server({
      '/api/auth/refresh': { status: 401, body: { error: { code: 'UNAUTHENTICATED' } } },
    });
    await expect(request('/api/me')).rejects.toMatchObject({ status: 401 });
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('alba.refreshToken');
    await expect(request('/api/me')).rejects.toMatchObject({ status: 401 });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('keeps the session when the renewal finds no network', async () => {
    await startSession(tokens(1, 0));
    jest.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Network request failed'));
    await expect(request('/api/me')).rejects.toMatchObject({ code: 'NETWORK' });
    expect(SecureStore.deleteItemAsync).not.toHaveBeenCalledWith('alba.refreshToken');
  });
});
