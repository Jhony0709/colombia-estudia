/**
 * GET /api/cohorts/[cohortId]/preflight — lo que «Abrir» va a hacer, antes de hacerlo (23/9).
 * Misma regla que `openCohort` (`planCohortOpening`): lo que dice aquí es lo que pasa después.
 */

import { apiHandler } from '@/lib/http/api-handler';
import { requireInstitutionId, routeParam } from '@/lib/http/admin-input';
import { APIError } from '@/lib/core/errors';
import { getOpeningPreflight } from '@/features/cohorts/server/cohorts.service';

export const GET = apiHandler({ capability: 'cohort.manage' })(async (_req, ctx) => {
  const preflight = await getOpeningPreflight({
    institutionId: requireInstitutionId(ctx.institutionId),
    cohortId: await routeParam(ctx.params, 'cohortId'),
  });
  if (!preflight) throw new APIError('Cohort not found', 'NOT_FOUND');
  return preflight;
});
