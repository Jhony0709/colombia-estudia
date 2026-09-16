/**
 * GET /api/invitations/[token]
 * SSOT: routes.md:24 (pantallas de invitación). AMBIGUO: no estaba en endpoints.md; añadido en §9c.
 *
 * Public. Returns what the page needs and nothing else: no email, familyName or expiresAt.
 * Status codes distinguish the screens (404 / 410 / 409); the token is the credential.
 */

import { apiHandler } from '@/lib/http/api-handler';
import { APIError } from '@/lib/core/errors';
import { validateInvitationToken } from '@/lib/invitations/validate-token';

export const GET = apiHandler()(async (_req, ctx) => {
  const { token } = await ctx.params;
  if (typeof token !== 'string' || token.length === 0) {
    throw new APIError('Invalid token', 'VALIDATION_ERROR');
  }

  const result = await validateInvitationToken(token);
  switch (result.status) {
    case 'valid':
      return {
        givenName: result.givenName,
        isMinor: result.isMinor,
        institutionName: result.institutionName,
        dataPolicyUrl: result.dataPolicyUrl,
      };
    case 'not_found':
      throw new APIError('Invitation not found', 'NOT_FOUND');
    case 'expired':
      throw new APIError('Invitation has expired', 'ACCESS_EXPIRED');
    case 'used':
      throw new APIError('Invitation has already been used', 'ACCESS_EXPIRED');
    case 'already_registered':
      throw new APIError('Account already registered', 'CONFLICT');
  }
});
