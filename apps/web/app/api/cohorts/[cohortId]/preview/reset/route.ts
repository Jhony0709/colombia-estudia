/** POST /api/cohorts/[cohortId]/preview/reset — reiniciar la vista de estudiante propia (31/10). */

import { apiHandler } from '@/lib/http/api-handler';
import { requireInstitutionId, routeParam } from '@/lib/http/admin-input';
import { APIError } from '@/lib/core/errors';
import { resetPreview } from '@/features/cohorts/server/preview.service';

export const POST = apiHandler({ capability: 'institution.manage' })(async (_req, ctx) => {
  if (!ctx.personId) throw new APIError('Authentication required', 'UNAUTHENTICATED');
  return resetPreview({
    institutionId: requireInstitutionId(ctx.institutionId),
    actorId: ctx.personId,
    cohortId: await routeParam(ctx.params, 'cohortId'),
  });
});
