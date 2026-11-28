import { ApiError, endSession, request, startSession } from './api';
import { forgetPush } from './push/push';
import { homeOf } from './roles';
import type { Tokens } from './tokens';

/** Lo que la app lee de `GET /api/me` (apps/web/app/api/me/route.ts:20-37). */
export interface Me {
  person: { id: string; givenName: string; familyName: string };
  roles: string[];
}

/** El par `aal1` del equipo, en memoria hasta el código (reference/03-ui/movil.md, «Sesión»). */
export interface PendingMfa {
  tokens: Tokens;
  factorId: string;
}

export type SignIn =
  { kind: 'in'; me: Me } | { kind: 'mfa'; pending: PendingMfa } | { kind: 'other' };

/** `null` sin sesión (401). */
export async function currentUser(): Promise<Me | null> {
  try {
    return await request<Me>('/api/me');
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return null;
    throw error;
  }
}

/** Con la sesión abierta: quién es y si la app tiene algo para su rol. */
async function land(tokens: Tokens): Promise<SignIn> {
  await startSession(tokens);
  const me = await currentUser();
  if (me && homeOf(me)) return { kind: 'in', me };
  await signOut();
  return { kind: 'other' };
}

export async function signIn(email: string, password: string): Promise<SignIn> {
  const issued = await request<Tokens & { mfa?: { factorId: string } }>('/api/auth/token', {
    method: 'POST',
    body: { email, password },
    auth: false,
  });
  const { mfa, ...tokens } = issued;
  return mfa ? { kind: 'mfa', pending: { tokens, factorId: mfa.factorId } } : land(tokens);
}

export async function verifyCode(pending: PendingMfa, code: string): Promise<SignIn> {
  const tokens = await request<Tokens>('/api/auth/token/mfa', {
    method: 'POST',
    body: { refreshToken: pending.tokens.refreshToken, factorId: pending.factorId, code },
    auth: false,
    token: pending.tokens.accessToken,
  });
  return land(tokens);
}

/** Quien no pone el código: su sesión `aal1` no queda abierta en el servidor. */
export async function abandon(pending: PendingMfa): Promise<void> {
  await request<unknown>('/api/auth/logout', {
    method: 'POST',
    auth: false,
    token: pending.tokens.accessToken,
  }).catch(() => undefined);
}

/** Siempre responde lo mismo, exista o no el correo (apps/web/app/api/auth/recover/route.ts:34). */
export const recover = (email: string) =>
  request<{ message: string }>('/api/auth/recover', {
    method: 'POST',
    body: { email },
    auth: false,
  });

/** Revoca la sesión en el servidor y la borra del teléfono, aunque el servidor no responda. */
export async function signOut(): Promise<void> {
  try {
    await forgetPush();
    await request<unknown>('/api/auth/logout', { method: 'POST' });
  } catch {
    // Sin red o ya vencida: lo que importa es que el teléfono la olvide.
  } finally {
    await endSession();
  }
}
