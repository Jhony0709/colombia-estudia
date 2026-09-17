/**
 * Authentication module exports (server side).
 * SSOT: plan/03-identidad-y-acceso.md
 *
 * The browser client lives in `./supabase-browser` and is imported directly by client
 * components; it is deliberately not re-exported from here, because this barrel pulls
 * `server-only` code.
 */

export { createServerSupabaseClient, getSupabaseAdmin, getSupabaseUser } from './supabase-server';
