/**
 * POST /api/auth/mfa/enroll
 * SSOT: plan/03-identidad-y-acceso.md §MFA para staff
 *
 * Enrolls a new TOTP factor. Requires authentication (aal1 at minimum).
 */

import { apiHandler } from '@/lib/http/api-handler';
import { APIError } from '@/lib/core/errors';
import { createServerSupabaseClient, getSupabaseUser } from '@/lib/auth/supabase-server';

export const POST = apiHandler()(async () => {
  // Verify user is authenticated (correction #7)
  const user = await getSupabaseUser();
  if (!user) {
    throw new APIError('Authentication required', 'UNAUTHENTICATED');
  }

  const supabase = await createServerSupabaseClient();

  // Every enroll() creates a factor; an abandoned QR leaves an `unverified` one behind and
  // Supabase refuses a second enroll with the same friendly name. Clean them up first.
  // (`listFactors().totp` only lists verified ones; unverified live in `all`.)
  const { data: factors } = await supabase.auth.mfa.listFactors();
  for (const factor of factors?.all ?? []) {
    if (factor.factor_type === 'totp' && factor.status === 'unverified') {
      await supabase.auth.mfa.unenroll({ factorId: factor.id });
    }
  }

  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: 'totp',
    friendlyName: 'Colombia Estudia',
  });

  if (error) {
    throw new APIError(error.message, 'VALIDATION_ERROR');
  }

  return {
    factorId: data.id,
    qr: data.totp.qr_code,
    secret: data.totp.secret,
  };
});
