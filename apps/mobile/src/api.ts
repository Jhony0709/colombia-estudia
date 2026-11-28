// Cliente de la API de ALBA: el sobre `{ data }` / `{ error }` de apps/web/lib/http/responses.ts:17-27.
import { clearRefreshToken, loadRefreshToken, saveRefreshToken, type Tokens } from './tokens';

export const API_URL = (
  process.env.EXPO_PUBLIC_API_URL ?? 'https://albafuturoeducativo.com'
).replace(/\/$/, '');

const TIMEOUT_MS = 15_000;
/** Se renueva un minuto antes de que caduque (reference/03-ui/movil.md, «Sesión»). */
const EARLY_S = 60;

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  /** `false`: sin sesión (entrar y renovar). */
  auth?: boolean;
  /** Con `auth: false`, un token que aún no es la sesión (el `aal1` del segundo factor). */
  token?: string;
}

let access: { token: string; expiresAt: number } | null = null;
let renewing: Promise<boolean> | null = null;

function field(payload: unknown, key: string): unknown {
  return typeof payload === 'object' && payload !== null
    ? (payload as Record<string, unknown>)[key]
    : undefined;
}

/** Status 0 y código `NETWORK`: no hubo respuesta (sin conexión o tiempo agotado). */
async function send(
  path: string,
  { method = 'GET', body }: RequestOptions,
  token?: string
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(`${API_URL}${path}`, {
      method,
      credentials: 'omit',
      headers: {
        Accept: 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
  } catch {
    throw new ApiError(0, 'NETWORK', 'Network request failed');
  } finally {
    clearTimeout(timer);
  }
}

async function read<T>(res: Response): Promise<T> {
  const payload: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const error = field(payload, 'error');
    const code = field(error, 'code');
    const message = field(error, 'message');
    throw new ApiError(
      res.status,
      typeof code === 'string' ? code : 'INTERNAL',
      typeof message === 'string' ? message : `HTTP ${res.status}`
    );
  }
  return field(payload, 'data') as T;
}

export async function startSession(tokens: Tokens): Promise<void> {
  await saveRefreshToken(tokens.refreshToken);
  access = { token: tokens.accessToken, expiresAt: tokens.expiresAt };
}

export async function endSession(): Promise<void> {
  access = null;
  await clearRefreshToken();
}

/** Una sola renovación para todos los que la piden a la vez; `false` si ya no hay sesión. */
function renew(): Promise<boolean> {
  renewing ??= (async () => {
    const refreshToken = await loadRefreshToken();
    if (!refreshToken) return false;
    const res = await send('/api/auth/refresh', { method: 'POST', body: { refreshToken } });
    if (res.status === 400 || res.status === 401) {
      await endSession();
      return false;
    }
    await startSession(await read<Tokens>(res));
    return true;
  })().finally(() => {
    renewing = null;
  });
  return renewing;
}

async function currentToken(): Promise<string | null> {
  if (!access || access.expiresAt - EARLY_S <= Date.now() / 1000) {
    if (!(await renew())) return null;
  }
  return access?.token ?? null;
}

const noSession = () => new ApiError(401, 'UNAUTHENTICATED', 'Sin sesión');

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  if (options.auth === false) return read<T>(await send(path, options, options.token));
  const token = await currentToken();
  if (!token) throw noSession();
  let res = await send(path, options, token);
  if (res.status === 401) {
    // Si otro pedido ya renovó, basta con el token nuevo.
    const fresh =
      access && access.token !== token ? access.token : (await renew()) && access?.token;
    if (!fresh) throw noSession();
    res = await send(path, options, fresh);
  }
  return read<T>(res);
}
