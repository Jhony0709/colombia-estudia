/**
 * POST /api/auth/logout
 * SSOT: plan/03-identidad-y-acceso.md §Sesión
 *
 * Signs out the user and redirects to login page.
 */

import { NextResponse } from 'next/server';
import { apiHandler } from '@/lib/http/api-handler';
import { bearerToken, createServerSupabaseClient, revokeSession } from '@/lib/auth/supabase-server';

export const POST = apiHandler()(async (req) => {
  // The mobile app (reference/03-ui/movil.md «Sesión»): revoke its session, answer JSON.
  const jwt = await bearerToken();
  if (jwt) {
    await revokeSession(jwt);
    return { signedOut: true };
  }

  const supabase = await createServerSupabaseClient();
  await supabase.auth.signOut();

  // Redirect to login page (303 to convert POST to GET)
  return NextResponse.redirect(new URL('/auth/login', req.url), 303);
});
