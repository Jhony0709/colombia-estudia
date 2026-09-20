/** GET /api/billing/enrollments/[enrollmentId] — la cuenta de una matrícula (staff). */

import { apiHandler } from '@/lib/http/api-handler';
import { getRequestContext } from '@/lib/authz/request-context';
import { routeParam } from '@/lib/http/admin-input';
import { APIError } from '@/lib/core/errors';
import { getAccount } from '@/features/billing/server/billing.service';

export const GET = apiHandler({ capability: 'billing.manage' })(async (_req, routeCtx) => {
  const ctx = await getRequestContext();
  const account = await getAccount({
    institutionId: ctx.institution.id,
    enrollmentId: await routeParam(routeCtx.params, 'enrollmentId'),
  });
  if (!account) throw new APIError('Not found', 'NOT_FOUND');
  return account;
});
