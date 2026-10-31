/** POST /api/cohorts/[cohortId]/preview — abrir la vista de estudiante (31/10, solo administración). */

import { apiHandler } from '@/lib/http/api-handler';
import { requireInstitutionId, routeParam } from '@/lib/http/admin-input';
import { APIError } from '@/lib/core/errors';
import { startPreview } from '@/features/cohorts/server/preview.service';

export const POST = apiHandler({ capability: 'institution.manage' })(async (_req, ctx) => {
  if (!ctx.personId) throw new APIError('Authentication required', 'UNAUTHENTICATED');
  return startPreview({
    institutionId: requireInstitutionId(ctx.institutionId),
    actorId: ctx.personId,
    cohortId: await routeParam(ctx.params, 'cohortId'),
  });
});
