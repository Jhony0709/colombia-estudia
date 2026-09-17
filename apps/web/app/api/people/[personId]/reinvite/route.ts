/**
 * POST /api/people/[personId]/reinvite
 * SSOT: reference/02-api/endpoints.md:72 ("reinvitar invalida el anterior; audita")
 *
 * Same rules as POST /api/people/invitations; the AuditLog carries `after.reinvite = true`.
 */

import { z } from 'zod';
import { apiHandler } from '@/lib/http/api-handler';
import { getRequestContext } from '@/lib/authz/request-context';
import { sendInvitation } from '@/features/auth/server/invitations.service';

const paramsSchema = z.object({
  personId: z.string().cuid(),
});

export const POST = apiHandler({
  capability: 'people.manage',
})(async (req, ctx) => {
  const { personId } = paramsSchema.parse(await ctx.params);
  const reqCtx = await getRequestContext();
  return sendInvitation({
    institution: reqCtx.institution,
    personId,
    actorId: reqCtx.person!.id,
    origin: req.nextUrl.origin,
    reinvite: true,
  });
});
