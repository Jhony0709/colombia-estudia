/**
 * POST /api/auth/logout
 * SSOT: plan/03-identidad-y-acceso.md §Sesión
 *
 * Signs out the user and redirects to login page.
 */

import { NextResponse } from 'next/server';
import { apiHandler } from '@/lib/http/api-handler';
import { createServerSupabaseClient } from '@/lib/auth/supabase-server';

export const POST = apiHandler()(async (req) => {
  const supabase = await createServerSupabaseClient();
  await supabase.auth.signOut();

  // Redirect to login page (303 to convert POST to GET)
  return NextResponse.redirect(new URL('/auth/login', req.url), 303);
});
