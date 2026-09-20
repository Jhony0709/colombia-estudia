/**
 * GET /api/cohorts/[cohortId]/progress — avance de la cohorte (métricas + tabla).
 * SSOT: reference/02-api/endpoints.md:77, reportes.md.
 *
 * `progress.read.cohort` con alcance: institución (operación, instructor) o `partnerId`
 * (el contacto del aliado, solo sobre las cohortes que financia). El alcance se comprueba
 * contra la cohorte cargada; fuera de alcance es 403, inexistente es 404.
 */

import { apiHandler } from '@/lib/http/api-handler';
import { routeParam } from '@/lib/http/admin-input';
import { APIError } from '@/lib/core/errors';
import { requireCohortInScope } from '@/lib/authz/cohort-scope';
import { getCohortProgress } from '@/features/cohorts/server/progress.service';

export const GET = apiHandler({ capability: 'progress.read.cohort' })(async (_req, routeCtx) => {
  const cohortId = await routeParam(routeCtx.params, 'cohortId');
  const ctx = await requireCohortInScope(cohortId);
  const progress = await getCohortProgress({ institutionId: ctx.institution.id, cohortId });
  if (!progress) throw new APIError('Not found', 'NOT_FOUND');
  return progress;
});
