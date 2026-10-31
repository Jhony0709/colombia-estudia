/**
 * Authentication module exports (server side).
 * SSOT: plan/03-identidad-y-acceso.md
 *
 * There is no browser client: the session cookies are HttpOnly and every Auth call goes
 * through the API routes.
 */

export { createServerSupabaseClient, getSupabaseAdmin, getSupabaseUser } from './supabase-server';
