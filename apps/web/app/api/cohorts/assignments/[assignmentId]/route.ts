/**
 * PATCH /api/cohorts/assignments/[assignmentId] — cambia la asignación a la versión
 * publicada más reciente.
 * SSOT: reference/02-api/endpoints.md («Cambiar versión (audita; aplica
 * `invalidatesProgress`)»). Estaba en el contrato y no existía hasta el 23/9.
 */

import { z } from 'zod';
import { apiHandler } from '@/lib/http/api-handler';
import { getRequestContext } from '@/lib/authz/request-context';
import { routeParam } from '@/lib/http/admin-input';
import { APIError } from '@/lib/core/errors';
import { updateAssignmentToLatest } from '@/features/cohorts/server/assignments.service';

const schema = z.object({ kind: z.enum(['lesson', 'assessment']) });

type Input = z.infer<typeof schema>;

export const PATCH = apiHandler<Input>({ schema, capability: 'cohort.manage' })(async (
  _req,
  routeCtx,
  input
) => {
  const ctx = await getRequestContext();
  if (!ctx.person) throw new APIError('Authentication required', 'UNAUTHENTICATED');

  return updateAssignmentToLatest({
    institutionId: ctx.institution.id,
    actorId: ctx.person.id,
    kind: input.kind,
    assignmentId: await routeParam(routeCtx.params, 'assignmentId'),
  });
});
