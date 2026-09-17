/**
 * POST /api/auth/recover
 * SSOT: plan/03-identidad-y-acceso.md §Recuperación
 *
 * Sends password recovery email. Response is always success to avoid
 * revealing if an email exists.
 */

import { z } from 'zod';
import { apiHandler } from '@/lib/http/api-handler';
import { createServerSupabaseClient } from '@/lib/auth/supabase-server';

const schema = z.object({
  email: z.string().email(),
});

export const POST = apiHandler({
  schema,
})(async (req, _ctx, { email }) => {
  const supabase = await createServerSupabaseClient();

  // PKCE: the email link comes back with `?code=` and only /auth/callback can exchange it
  // (a page cannot write the session cookies). The callback then sends the user to
  // /auth/restablecer. `req.nextUrl.origin`, not the Origin header (absent on some requests).
  const redirectTo = new URL('/auth/callback', req.nextUrl.origin);
  redirectTo.searchParams.set('next', '/auth/restablecer');

  await supabase.auth.resetPasswordForEmail(email, { redirectTo: redirectTo.toString() });

  // Always return success (endpoints.md:25)
  return { message: 'Si el correo existe, te enviamos un enlace' };
});
