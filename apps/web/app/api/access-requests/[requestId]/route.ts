/**
 * PATCH /api/access-requests/[requestId] — descartar una solicitud (6/10) o conceder otra
 * oportunidad en un examen (5/11). Body: `{ action: 'dismiss' | 'grant' }`. Matricular o
 * habilitar no pasan por aquí: cierran la solicitud solos. `cohort.manage`.
 * SSOT: reference/02-api/endpoints.md (Operación).
 */

import { z } from 'zod';
import { apiHandler } from '@/lib/http/api-handler';
import { getRequestContext } from '@/lib/authz/request-context';
import { APIError } from '@/lib/core/errors';
import { routeParam } from '@/lib/http/admin-input';
import { dismissRequest, grantAttempt } from '@/features/requests/server/requests.service';

const schema = z.object({ action: z.enum(['dismiss', 'grant']) });
type Input = z.infer<typeof schema>;

export const PATCH = apiHandler<Input>({ schema, capability: 'cohort.manage' })(async (
  _req,
  routeCtx,
  input
) => {
  const ctx = await getRequestContext();
  if (!ctx.person) throw new APIError('Authentication required', 'UNAUTHENTICATED');

  const args = {
    institutionId: ctx.institution.id,
    actorId: ctx.person.id,
    requestId: await routeParam(routeCtx.params, 'requestId'),
  };
  return input.action === 'grant' ? grantAttempt(args) : dismissRequest(args);
});
