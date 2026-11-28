/**
 * POST /api/auth/refresh
 * SSOT: reference/02-api/endpoints.md, reference/03-ui/movil.md «Sesión»
 */

import { z } from 'zod';
import { apiHandler } from '@/lib/http/api-handler';
import { enforceRateLimit } from '@/lib/http/rate-limit';
import { refreshTokens } from '@/features/auth/server/token.service';

const schema = z.object({ refreshToken: z.string().min(1) });

export const POST = apiHandler({ schema })(async (req, _ctx, { refreshToken }) => {
  enforceRateLimit(req, 'refresh', 60, 10 * 60_000);
  return refreshTokens(refreshToken);
});
