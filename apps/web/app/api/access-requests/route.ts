/**
 * GET /api/access-requests?status= — la bandeja de `/solicitudes` para la app móvil (27/11).
 * `cohort.manage`. SSOT: reference/02-api/endpoints.md (Operación).
 */

import { apiHandler } from '@/lib/http/api-handler';
import { APIError } from '@/lib/core/errors';
import { requireInstitutionId } from '@/lib/http/admin-input';
import { listRequests } from '@/features/requests/server/requests.service';

const STATUS = { pending: 'PENDING', closed: 'CLOSED' } as const;

export const GET = apiHandler({ capability: 'cohort.manage' })(async (req, ctx) => {
  const status = req.nextUrl.searchParams.get('status') ?? 'pending';
  if (status !== 'pending' && status !== 'closed') {
    throw new APIError('Estado desconocido', 'VALIDATION_ERROR');
  }
  return {
    requests: await listRequests({
      institutionId: requireInstitutionId(ctx.institutionId),
      status: STATUS[status],
    }),
  };
});
