/**
 * POST /api/auth/mfa/verify
 * SSOT: plan/03-identidad-y-acceso.md §MFA para staff
 *
 * Verifies a TOTP code against a factor. Used for both enrollment confirmation
 * and regular MFA challenge.
 */

import { z } from 'zod';
import { apiHandler } from '@/lib/http/api-handler';
import { APIError } from '@/lib/core/errors';
import { createServerSupabaseClient, getSupabaseUser } from '@/lib/auth/supabase-server';

const schema = z.object({
  factorId: z.string(),
  code: z.string().length(6, 'El código debe tener 6 dígitos'),
});

export const POST = apiHandler({
  schema,
})(async (_req, _ctx, { factorId, code }) => {
  // Verify user is authenticated (correction #7)
  const user = await getSupabaseUser();
  if (!user) {
    throw new APIError('Authentication required', 'UNAUTHENTICATED');
  }

  const supabase = await createServerSupabaseClient();

  // Create challenge
  const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
    factorId,
  });

  if (challengeError) {
    throw new APIError(challengeError.message, 'VALIDATION_ERROR');
  }

  // Verify code
  const { error: verifyError } = await supabase.auth.mfa.verify({
    factorId,
    challengeId: challenge.id,
    code,
  });

  if (verifyError) {
    throw new APIError('Código inválido', 'VALIDATION_ERROR');
  }

  return { success: true };
});
