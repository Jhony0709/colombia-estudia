/**
 * PATCH /api/access-requests/[requestId] — descartar una solicitud (6/10). Body:
 * `{ action: 'dismiss' }`. Hacer lo pedido no pasa por aquí: matricular o habilitar cierran la
 * solicitud solos. `cohort.manage`. SSOT: reference/02-api/endpoints.md (Operación).
 */

import { z } from 'zod';
import { apiHandler } from '@/lib/http/api-handler';
import { getRequestContext } from '@/lib/authz/request-context';
import { APIError } from '@/lib/core/errors';
import { routeParam } from '@/lib/http/admin-input';
import { dismissRequest } from '@/features/requests/server/requests.service';

const schema = z.object({ action: z.literal('dismiss') });
type Input = z.infer<typeof schema>;

export const PATCH = apiHandler<Input>({ schema, capability: 'cohort.manage' })(async (
  _req,
  routeCtx
) => {
  const ctx = await getRequestContext();
  if (!ctx.person) throw new APIError('Authentication required', 'UNAUTHENTICATED');

  return dismissRequest({
    institutionId: ctx.institution.id,
    actorId: ctx.person.id,
    requestId: await routeParam(routeCtx.params, 'requestId'),
  });
});
