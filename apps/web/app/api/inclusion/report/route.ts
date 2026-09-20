/**
 * GET /api/inclusion/report?desde=&hasta= — el reporte del Decreto 1421.
 * SSOT: endpoints.md:95 (`accommodation.manage`), reportes.md:18.
 */

import { z } from 'zod';
import { apiHandler } from '@/lib/http/api-handler';
import { getRequestContext } from '@/lib/authz/request-context';
import { getInclusionReport } from '@/features/inclusion/server/accommodations.service';

const schema = z.object({
  desde: z.string().date().optional(),
  hasta: z.string().date().optional(),
});
type Input = z.infer<typeof schema>;

export const GET = apiHandler<Input>({ schema, capability: 'accommodation.manage' })(async (
  _req,
  _routeCtx,
  input
) => {
  const ctx = await getRequestContext();
  const to = input.hasta ? new Date(`${input.hasta}T23:59:59.999Z`) : new Date();
  const from = input.desde
    ? new Date(`${input.desde}T00:00:00.000Z`)
    : new Date(to.getTime() - 90 * 24 * 3600 * 1000);
  return getInclusionReport({ institutionId: ctx.institution.id, from, to });
});
