/**
 * GET /auth/callback
 * SSOT: plan/03-identidad-y-acceso.md §Login (magic link), §Recuperación
 *
 * Handles PKCE code exchange for magic link and password recovery flows.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/auth/supabase-server';
import { sanitizeNextUrl } from '@/lib/authz/routes';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const next = sanitizeNextUrl(url.searchParams.get('next'));
  const type = url.searchParams.get('type');

  if (!code) {
    // No code provided - redirect to login with error
    return NextResponse.redirect(new URL('/auth/login?error=callback', url.origin), 303);
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    // Code exchange failed
    return NextResponse.redirect(new URL('/auth/login?error=callback', url.origin), 303);
  }

  // For recovery flow, redirect to password reset page
  if (type === 'recovery') {
    return NextResponse.redirect(new URL('/auth/restablecer', url.origin), 303);
  }

  // For magic link, redirect to next or home
  return NextResponse.redirect(new URL(next, url.origin), 303);
}
