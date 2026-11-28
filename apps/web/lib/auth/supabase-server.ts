/**
 * Supabase server clients (server components, route handlers, scripts).
 * SSOT: reference/08-env-vars.md:14-16
 *
 * - Server client: publishable key + cookies (@supabase/ssr pattern). Session only.
 * - Admin client: SUPABASE_SECRET_KEY. Bypasses RLS: Storage signed URLs, auth admin
 *   (invitations), anonymization. `import 'server-only'` makes any import from a client
 *   component a build error (08-env-vars.md:16 "Jamás al cliente").
 */

import 'server-only';

import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies, headers } from 'next/headers';
import { APIError } from '../core/errors';

function getPublicEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !publishableKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY');
  }
  return { url, publishableKey };
}

/**
 * Cookie-backed client for the current request. Pattern from @supabase/ssr docs.
 */
export async function createServerSupabaseClient() {
  const { url, publishableKey } = getPublicEnv();
  const cookieStore = await cookies();

  return createServerClient(url, publishableKey, {
    // @supabase/ssr las deja legibles desde JS por defecto; nada en el navegador las lee.
    cookieOptions: { httpOnly: true, secure: process.env.NODE_ENV === 'production' },
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Called from a Server Component: cookies are read-only there. The middleware
          // refreshes the session, so this is safe to ignore.
        }
      },
    },
  });
}

/** Without cookies or state: validates and issues the mobile app's tokens. */
export function createStatelessSupabaseClient() {
  const { url, publishableKey } = getPublicEnv();
  return createClient(url, publishableKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/** `Authorization: Bearer` of the mobile app (reference/03-ui/movil.md, «Sesión»). */
export async function bearerToken(): Promise<string | null> {
  const value = (await headers()).get('authorization');
  return value?.startsWith('Bearer ') ? value.slice(7) || null : null;
}

let adminClient: ReturnType<typeof createClient> | null = null;

/**
 * Admin client with the secret key. Server only; never in a response, never in a log.
 */
export function getSupabaseAdmin() {
  if (!adminClient) {
    const { url } = getPublicEnv();
    const secretKey = process.env.SUPABASE_SECRET_KEY;
    if (!secretKey) {
      throw new Error('Missing SUPABASE_SECRET_KEY');
    }
    adminClient = createClient(url, secretKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }
  return adminClient;
}

/** Revokes the session of this token; fails when Supabase no longer accepts it. */
export async function revokeSession(jwt: string): Promise<void> {
  const { error } = await getSupabaseAdmin().auth.admin.signOut(jwt, 'local');
  if (error) throw new APIError('Sesión vencida', 'UNAUTHENTICATED');
}

/**
 * Current authenticated user, validated against Supabase (`getUser`, never `getSession`).
 * Returns null when anonymous.
 */
export async function getSupabaseUser() {
  const jwt = await bearerToken();
  // With a Bearer the cookie is not read: a bad token is anonymous, and the 401 makes the app renew.
  const supabase = jwt ? createStatelessSupabaseClient() : await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser(jwt ?? undefined);
  return user;
}
