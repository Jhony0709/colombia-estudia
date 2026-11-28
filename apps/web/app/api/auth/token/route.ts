/**
 * POST /api/auth/token
 * SSOT: reference/02-api/endpoints.md, reference/03-ui/movil.md «Sesión»
 */

import { z } from 'zod';
import { apiHandler } from '@/lib/http/api-handler';
import { enforceRateLimit } from '@/lib/http/rate-limit';
import { issueTokens } from '@/features/auth/server/token.service';

const schema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
});

export const POST = apiHandler({ schema })(async (req, _ctx, { email, password }) => {
  // The same bucket as the web login (login/route.ts:37).
  enforceRateLimit(req, `login:${email}`, 10, 10 * 60_000);
  return issueTokens(email, password);
});
