/**
 * POST /api/invitations/[token]/request-new
 * SSOT: routes.md:24 ("Pedir una invitación nueva"). AMBIGUO: not in endpoints.md; added in §9c.
 *
 * Always 200 with the same body: never confirms whether a token exists, is pending, expired
 * or used. Rate limiting: WAF (plan/03 "Decisiones").
 */

import { apiHandler } from '@/lib/http/api-handler';
import { requestNewInvitation } from '@/features/auth/server/invitations.service';

const RESPONSE = { message: 'Solicitud enviada' };

export const POST = apiHandler()(async (_req, ctx) => {
  const { token } = await ctx.params;
  if (typeof token === 'string' && token.length > 0) {
    await requestNewInvitation(token);
  }
  return RESPONSE;
});
