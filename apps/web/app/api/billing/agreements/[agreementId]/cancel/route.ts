/** POST /api/billing/agreements/[agreementId]/cancel — cancelar (cobro externo / incumplimiento). */

import { z } from 'zod';
import { apiHandler } from '@/lib/http/api-handler';
import { getRequestContext } from '@/lib/authz/request-context';
import { routeParam } from '@/lib/http/admin-input';
import { APIError } from '@/lib/core/errors';
import { cancelAgreement } from '@/features/billing/server/billing.service';

const schema = z.object({ reason: z.string().trim().min(5).max(500) });
type Input = z.infer<typeof schema>;

export const POST = apiHandler<Input>({ schema, capability: 'billing.manage' })(async (
  _req,
  routeCtx,
  input
) => {
  const ctx = await getRequestContext();
  if (!ctx.person) throw new APIError('Authentication required', 'UNAUTHENTICATED');
  await cancelAgreement({
    institutionId: ctx.institution.id,
    actorId: ctx.person.id,
    agreementId: await routeParam(routeCtx.params, 'agreementId'),
    reason: input.reason,
  });
  return { ok: true };
});
