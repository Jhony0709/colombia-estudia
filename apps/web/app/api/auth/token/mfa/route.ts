/**
 * POST /api/auth/token/mfa
 * SSOT: reference/02-api/endpoints.md, reference/03-ui/movil.md «Sesión»
 */

import { z } from 'zod';
import { APIError } from '@/lib/core/errors';
import { bearerToken } from '@/lib/auth/supabase-server';
import { apiHandler } from '@/lib/http/api-handler';
import { enforceRateLimit } from '@/lib/http/rate-limit';
import { verifyMfa } from '@/features/auth/server/token.service';

const schema = z.object({
  refreshToken: z.string().min(1),
  factorId: z.string().min(1),
  code: z.string().regex(/^\d{6}$/, 'El código debe tener 6 dígitos'),
});

export const POST = apiHandler({ schema })(async (req, _ctx, input) => {
  enforceRateLimit(req, 'token-mfa', 10, 10 * 60_000);
  const accessToken = await bearerToken();
  if (!accessToken) throw new APIError('Authentication required', 'UNAUTHENTICATED');
  return verifyMfa({ accessToken, ...input });
});
