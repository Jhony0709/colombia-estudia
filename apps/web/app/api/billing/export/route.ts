/** GET /api/billing/export — la cartera filtrada en CSV. SSOT: endpoints.md:92. */

import { NextResponse } from 'next/server';
import { apiHandler } from '@/lib/http/api-handler';
import { getRequestContext } from '@/lib/authz/request-context';
import { CSV_BOM } from '@/lib/csv/serialize';
import { listBilling, billingCsv } from '@/features/billing/server/billing.service';
import { parseBillingFilters } from '@/features/billing/server/filters';

export const GET = apiHandler({ capability: 'billing.manage' })(async (req) => {
  const ctx = await getRequestContext();
  const rows = await listBilling({
    institutionId: ctx.institution.id,
    filters: parseBillingFilters(req.nextUrl.searchParams),
  });
  const stamp = new Date().toISOString().slice(0, 10);
  return new NextResponse(CSV_BOM + billingCsv(rows), {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="cartera-${stamp}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
});
