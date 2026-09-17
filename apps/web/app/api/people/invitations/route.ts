/**
 * POST /api/people/invitations
 * SSOT: reference/02-api/endpoints.md:72, plan/03 "Invitación" paso 1
 *
 * Send an invitation to a person without an account. Requires people.manage.
 */

import { z } from 'zod';
import { apiHandler } from '@/lib/http/api-handler';
import { getRequestContext } from '@/lib/authz/request-context';
import { sendInvitation } from '@/features/auth/server/invitations.service';

const schema = z.object({
  personId: z.string().cuid(),
});

export const POST = apiHandler({
  schema,
  capability: 'people.manage',
})(async (req, _ctx, { personId }) => {
  const reqCtx = await getRequestContext();
  return sendInvitation({
    institution: reqCtx.institution,
    personId,
    actorId: reqCtx.person!.id,
    origin: req.nextUrl.origin,
  });
});
