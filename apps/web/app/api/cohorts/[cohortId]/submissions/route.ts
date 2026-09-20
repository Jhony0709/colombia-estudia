/**
 * GET /api/cohorts/[cohortId]/submissions — la cola de entregas de una cohorte.
 * SSOT: reference/02-api/endpoints.md:79.
 */

import { apiHandler } from '@/lib/http/api-handler';
import { getRequestContext } from '@/lib/authz/request-context';
import { routeParam } from '@/lib/http/admin-input';
import {
  listSubmissions,
  SUBMISSION_STATUSES,
  type SubmissionStatusFilter,
} from '@/features/cohorts/server/submissions.service';

export const GET = apiHandler({ capability: 'assessment.grade' })(async (req, routeCtx) => {
  const ctx = await getRequestContext();
  const status = req.nextUrl.searchParams.get('estado')?.toUpperCase() ?? '';
  const lessonId = req.nextUrl.searchParams.get('tema') || null;
  return listSubmissions({
    institutionId: ctx.institution.id,
    cohortId: await routeParam(routeCtx.params, 'cohortId'),
    status: (SUBMISSION_STATUSES as readonly string[]).includes(status)
      ? (status as SubmissionStatusFilter)
      : null,
    lessonId,
  });
});
