/**
 * GET /api/auth/mfa/factors
 * SSOT: plan/03-identidad-y-acceso.md §MFA para staff
 *
 * Lists the user's MFA factors (TOTP).
 */

import { apiHandler } from '@/lib/http/api-handler';
import { APIError } from '@/lib/core/errors';
import { createServerSupabaseClient, getSupabaseUser } from '@/lib/auth/supabase-server';

export const GET = apiHandler()(async () => {
  // Verify user is authenticated (correction #7)
  const user = await getSupabaseUser();
  if (!user) {
    throw new APIError('Authentication required', 'UNAUTHENTICATED');
  }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.auth.mfa.listFactors();

  if (error) {
    throw new APIError(error.message, 'INTERNAL');
  }

  return {
    factors: data.totp.map((f) => ({
      id: f.id,
      status: f.status,
      friendlyName: f.friendly_name,
    })),
  };
});
