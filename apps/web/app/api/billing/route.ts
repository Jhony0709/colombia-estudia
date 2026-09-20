/**
 * GET /api/billing — cartera por matrícula con estado derivado; filtros en la query.
 * SSOT: endpoints.md:92, plan/09 §6.
 */

import { apiHandler } from '@/lib/http/api-handler';
import { getRequestContext } from '@/lib/authz/request-context';
import { listBilling } from '@/features/billing/server/billing.service';
import { parseBillingFilters } from '@/features/billing/server/filters';

export const GET = apiHandler({ capability: 'billing.manage' })(async (req) => {
  const ctx = await getRequestContext();
  return listBilling({
    institutionId: ctx.institution.id,
    filters: parseBillingFilters(req.nextUrl.searchParams),
  });
});
