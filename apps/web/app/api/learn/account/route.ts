/** GET /api/learn/account — la cuenta de quien paga (`billing.read.own`). 404 si no hay. */

import { apiHandler } from '@/lib/http/api-handler';
import { getRequestContext } from '@/lib/authz/request-context';
import { APIError } from '@/lib/core/errors';
import { listOwnAccounts } from '@/features/billing/server/account.service';

export const GET = apiHandler({ capability: 'billing.read.own' })(async () => {
  const ctx = await getRequestContext();
  const accounts = await listOwnAccounts({
    institutionId: ctx.institution.id,
    scopes: ctx.capabilities.get('billing.read.own') ?? [],
  });
  if (accounts.length === 0) throw new APIError('Not found', 'NOT_FOUND');
  return accounts;
});
