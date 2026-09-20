/** POST /api/billing/payments/[paymentId]/confirm — paso 2: confirma. Serializable. */

import { apiHandler } from '@/lib/http/api-handler';
import { getRequestContext } from '@/lib/authz/request-context';
import { routeParam } from '@/lib/http/admin-input';
import { APIError } from '@/lib/core/errors';
import { confirmPayment } from '@/features/billing/server/billing.service';

export const POST = apiHandler({ capability: 'billing.manage' })(async (_req, routeCtx) => {
  const ctx = await getRequestContext();
  if (!ctx.person) throw new APIError('Authentication required', 'UNAUTHENTICATED');
  return confirmPayment({
    institutionId: ctx.institution.id,
    actorId: ctx.person.id,
    paymentId: await routeParam(routeCtx.params, 'paymentId'),
  });
});
