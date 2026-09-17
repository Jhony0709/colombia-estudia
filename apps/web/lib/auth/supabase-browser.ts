/**
 * Supabase browser client (client components only).
 * SSOT: reference/08-env-vars.md:14-15
 *
 * Uses the publishable key, which maps to the `anon` role: RLS denies everything to it,
 * so this client is for Auth (login, MFA, recovery) and nothing else. Kept in its own
 * module because `./supabase-server` is `server-only` and can never reach the browser.
 */

import { createBrowserClient } from '@supabase/ssr';

export function createBrowserSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !publishableKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY');
  }
  return createBrowserClient(url, publishableKey);
}
