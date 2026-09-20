/**
 * POST /api/auth/login
 * SSOT: plan/03-identidad-y-acceso.md §Login
 *
 * Authenticates with email/password. If staff member needs MFA, sets next to /auth/mfa.
 * Error messages are generic to avoid revealing if an email exists.
 */

import { z } from 'zod';
import { apiHandler } from '@/lib/http/api-handler';
import { APIError } from '@/lib/core/errors';
import { createServerSupabaseClient } from '@/lib/auth/supabase-server';
import { resolveInstitutionBySlug } from '@/lib/authz/institution-cache';
import { findLoginPerson } from '@/features/auth/server/session.service';
import { COLOMBIA_ESTUDIA } from '@/lib/authz/tenant';
import { HOME_AFTER_LOGIN, sanitizeNextUrl } from '@/lib/authz/routes';

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  next: z.string().optional(),
});

const GENERIC_ERROR = 'Correo o contraseña incorrectos';

/**
 * Responds `{ next }` as JSON: the login form is JS-only (docs/estado.md §9b, "Lo pedido y
 * no hecho") and navigates with `window.location.assign(next)`, so a 303 would only make the
 * browser fetch the destination HTML twice.
 */
export const POST = apiHandler({
  schema,
})(async (_req, _ctx, { email, password, next }) => {
  const supabase = await createServerSupabaseClient();

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    // Same message whether the email exists or not (plan/03 "Login")
    throw new APIError(GENERIC_ERROR, 'UNAUTHENTICATED');
  }

  const institution = await resolveInstitutionBySlug(COLOMBIA_ESTUDIA);
  if (!institution) {
    throw new APIError('Institution not found', 'INTERNAL');
  }

  const login = await findLoginPerson(institution.id, data.user.id);

  if (!login) {
    // Supabase account without a Person in this institution (e.g. anonymized): keeping the
    // session would leave the user bouncing between / and /auth/login (routes.md:7).
    await supabase.auth.signOut();
    throw new APIError(GENERIC_ERROR, 'UNAUTHENTICATED');
  }

  // A session created by password is always aal1; ADMIN/OPERATIONS must verify (or enroll)
  // TOTP before anything else (plan/03 "MFA para staff"). Not an authorization check: the
  // capabilities are withheld by request-context until aal2.
  const needsMfa = login.needsMfa;

  const target = sanitizeNextUrl(next);
  if (!needsMfa) {
    return { next: target };
  }
  const mfaUrl =
    target === HOME_AFTER_LOGIN ? '/auth/mfa' : `/auth/mfa?next=${encodeURIComponent(target)}`;
  return { next: mfaUrl };
});
