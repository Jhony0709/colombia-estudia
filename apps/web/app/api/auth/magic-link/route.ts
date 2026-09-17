/**
 * POST /api/auth/magic-link
 * SSOT: plan/03-identidad-y-acceso.md §Login (alternativa accesible 3.3.8)
 *
 * Sends a magic link email. Response is always success to avoid revealing
 * if an email exists.
 */

import { z } from 'zod';
import { apiHandler } from '@/lib/http/api-handler';
import { createServerSupabaseClient } from '@/lib/auth/supabase-server';
import { sanitizeNextUrl } from '@/lib/authz/routes';

const schema = z.object({
  email: z.string().email(),
  next: z.string().optional(),
});

export const POST = apiHandler({
  schema,
})(async (req, _ctx, { email, next }) => {
  const supabase = await createServerSupabaseClient();
  // `req.nextUrl.origin`, not the Origin header: with '' as base `new URL` throws (500).
  const callbackUrl = new URL('/auth/callback', req.nextUrl.origin);
  const target = sanitizeNextUrl(next);
  if (target !== '/') {
    callbackUrl.searchParams.set('next', target);
  }

  // signInWithOtp never reveals if email exists
  await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: callbackUrl.toString(),
    },
  });

  // Always return success (endpoints.md:25)
  return { message: 'Si el correo existe, recibirás un enlace' };
});
