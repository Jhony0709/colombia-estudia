/**
 * POST /api/people/[personId]/anonymize — anonimización (Ley 1581). Irreversible; audita.
 * `institution.manage`: no es una operación del día a día. SSOT: plan/03 «Sesión», plan/10 §3.
 */

import { z } from 'zod';
import { apiHandler } from '@/lib/http/api-handler';
import { getRequestContext } from '@/lib/authz/request-context';
import { routeParam } from '@/lib/http/admin-input';
import { APIError } from '@/lib/core/errors';
import { anonymizePerson } from '@/features/people/server/anonymize.service';

const schema = z.object({ reason: z.string().trim().min(10).max(500) });
type Input = z.infer<typeof schema>;

export const POST = apiHandler<Input>({ schema, capability: 'institution.manage' })(async (
  _req,
  routeCtx,
  input
) => {
  const ctx = await getRequestContext();
  if (!ctx.person) throw new APIError('Authentication required', 'UNAUTHENTICATED');
  return anonymizePerson({
    institutionId: ctx.institution.id,
    actorId: ctx.person.id,
    personId: await routeParam(routeCtx.params, 'personId'),
    reason: input.reason,
  });
});
