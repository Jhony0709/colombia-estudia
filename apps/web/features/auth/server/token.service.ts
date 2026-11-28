/**
 * Mobile app sessions by token (reference/03-ui/movil.md, «Sesión»).
 * SSOT: reference/02-api/endpoints.md, `/api/auth/token`, `/api/auth/token/mfa`, `/api/auth/refresh`.
 */

import 'server-only';

import type { Session } from '@supabase/supabase-js';
import { APIError } from '@/lib/core/errors';
import { createStatelessSupabaseClient, revokeSession } from '@/lib/auth/supabase-server';
import { resolveInstitutionBySlug } from '@/lib/authz/institution-cache';
import { COLOMBIA_ESTUDIA } from '@/lib/authz/tenant';
import { logger } from '@/lib/observability/logger';
import { findLoginPerson, LOGIN_FAILED } from './session.service';

export interface Tokens {
  accessToken: string;
  refreshToken: string;
  /** Seconds since the epoch. */
  expiresAt: number;
}

/** Staff that must pass the second factor: these tokens are aal1 until `verifyMfa`. */
export type IssuedTokens = Tokens & { mfa?: { factorId: string } };

const MFA_NOT_ENABLED = 'Activa el segundo factor en la web.';

function tokensOf(session: Session): Tokens {
  return {
    accessToken: session.access_token,
    refreshToken: session.refresh_token,
    expiresAt: session.expires_at ?? Math.floor(Date.now() / 1000) + session.expires_in,
  };
}

export async function issueTokens(email: string, password: string): Promise<IssuedTokens> {
  const auth = createStatelessSupabaseClient().auth;
  const { data, error } = await auth.signInWithPassword({
    email,
    password,
  });
  if (error || !data.session) {
    logger.warn({ event: 'token-failed', reason: error?.code ?? 'no_session' });
    throw new APIError(LOGIN_FAILED, 'UNAUTHENTICATED');
  }

  const institution = await resolveInstitutionBySlug(COLOMBIA_ESTUDIA);
  if (!institution) throw new APIError('Institution not found', 'INTERNAL');
  const login = await findLoginPerson(institution.id, data.user.id);

  if (!login) {
    // Without a Person here no session stays open (login/route.ts:55-61).
    await revokeSession(data.session.access_token).catch(() => undefined);
    logger.warn({ event: 'token-failed', reason: 'no_person' });
    throw new APIError(LOGIN_FAILED, 'UNAUTHENTICATED');
  }
  if (!login.needsMfa) return tokensOf(data.session);

  const { data: current } = await auth.getUser(data.session.access_token);
  const factor = current.user?.factors?.find(
    (f) => f.factor_type === 'totp' && f.status === 'verified'
  );
  if (!factor) {
    await revokeSession(data.session.access_token).catch(() => undefined);
    throw new APIError(MFA_NOT_ENABLED, 'INSUFFICIENT_CAPABILITY');
  }
  return { ...tokensOf(data.session), mfa: { factorId: factor.id } };
}

/** Trades the aal1 pair of `issueTokens` for an aal2 one with the TOTP code. */
export async function verifyMfa(input: {
  accessToken: string;
  refreshToken: string;
  factorId: string;
  code: string;
}): Promise<Tokens> {
  const auth = createStatelessSupabaseClient().auth;
  const { error: sessionError } = await auth.setSession({
    access_token: input.accessToken,
    refresh_token: input.refreshToken,
  });
  if (sessionError) throw new APIError('Sesión vencida', 'UNAUTHENTICATED');
  const { data, error } = await auth.mfa.challengeAndVerify({
    factorId: input.factorId,
    code: input.code,
  });
  if (error || !data) throw new APIError('Código inválido', 'VALIDATION_ERROR');
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: Math.floor(Date.now() / 1000) + data.expires_in,
  };
}

export async function refreshTokens(refreshToken: string): Promise<Tokens> {
  const { data, error } = await createStatelessSupabaseClient().auth.refreshSession({
    refresh_token: refreshToken,
  });
  if (error || !data.session) throw new APIError('Sesión vencida', 'UNAUTHENTICATED');
  return tokensOf(data.session);
}
