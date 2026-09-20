/** GET/PUT /api/admin/policies — las dos banderas de `RestrictionPolicy`. Audita. SSOT: endpoints.md:98. */

import { z } from 'zod';
import { apiHandler } from '@/lib/http/api-handler';
import { getRequestContext } from '@/lib/authz/request-context';
import { APIError } from '@/lib/core/errors';
import { getPolicy, updatePolicy } from '@/features/admin/server/policies.service';

const schema = z.object({
  requireAgreementForNextCohort: z.boolean(),
  notifyPayerOnOverdue: z.boolean(),
});
type Input = z.infer<typeof schema>;

export const GET = apiHandler({ capability: 'institution.manage' })(async () => {
  const ctx = await getRequestContext();
  return getPolicy({ institutionId: ctx.institution.id });
});

export const PUT = apiHandler<Input>({ schema, capability: 'institution.manage' })(async (
  _req,
  _ctx,
  input
) => {
  const ctx = await getRequestContext();
  if (!ctx.person) throw new APIError('Authentication required', 'UNAUTHENTICATED');
  return updatePolicy({ institutionId: ctx.institution.id, actorId: ctx.person.id, input });
});
