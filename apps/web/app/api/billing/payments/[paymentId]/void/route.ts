/** POST /api/billing/payments/[paymentId]/void — anular con motivo. Nunca se borra. */

import { z } from 'zod';
import { apiHandler } from '@/lib/http/api-handler';
import { getRequestContext } from '@/lib/authz/request-context';
import { routeParam } from '@/lib/http/admin-input';
import { APIError } from '@/lib/core/errors';
import { voidPayment } from '@/features/billing/server/billing.service';

const schema = z.object({ reason: z.string().trim().min(5).max(500) });
type Input = z.infer<typeof schema>;

export const POST = apiHandler<Input>({ schema, capability: 'billing.manage' })(async (
  _req,
  routeCtx,
  input
) => {
  const ctx = await getRequestContext();
  if (!ctx.person) throw new APIError('Authentication required', 'UNAUTHENTICATED');
  return voidPayment({
    institutionId: ctx.institution.id,
    actorId: ctx.person.id,
    paymentId: await routeParam(routeCtx.params, 'paymentId'),
    reason: input.reason,
  });
});
