/**
 * POST /api/cohorts/certificates/[certificateId]/revoke — revocar con motivo. Audita.
 * SSOT: endpoints.md:81 (`institution.manage`).
 */

import { z } from 'zod';
import { apiHandler } from '@/lib/http/api-handler';
import { getRequestContext } from '@/lib/authz/request-context';
import { routeParam } from '@/lib/http/admin-input';
import { APIError } from '@/lib/core/errors';
import { revokeCertificate } from '@/features/certificates/server/certificates.service';

const schema = z.object({ reason: z.string().trim().min(5).max(500) });
type Input = z.infer<typeof schema>;

export const POST = apiHandler<Input>({ schema, capability: 'institution.manage' })(async (
  _req,
  routeCtx,
  input
) => {
  const ctx = await getRequestContext();
  if (!ctx.person) throw new APIError('Authentication required', 'UNAUTHENTICATED');
  return revokeCertificate({
    institutionId: ctx.institution.id,
    actorId: ctx.person.id,
    certificateId: await routeParam(routeCtx.params, 'certificateId'),
    reason: input.reason,
  });
});
