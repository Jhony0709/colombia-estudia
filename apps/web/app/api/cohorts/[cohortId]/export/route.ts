/**
 * GET /api/cohorts/[cohortId]/export — el avance por estudiante en CSV.
 * SSOT: reportes.md «Exportación», endpoints.md:77.
 */

import { NextResponse } from 'next/server';
import { apiHandler } from '@/lib/http/api-handler';
import { routeParam } from '@/lib/http/admin-input';
import { APIError } from '@/lib/core/errors';
import { CSV_BOM } from '@/lib/csv/serialize';
import { getCohortProgress, cohortProgressCsv } from '@/features/cohorts/server/progress.service';
import { requireCohortInScope } from '@/lib/authz/cohort-scope';

export const GET = apiHandler({ capability: 'progress.read.cohort' })(async (_req, routeCtx) => {
  const cohortId = await routeParam(routeCtx.params, 'cohortId');
  const ctx = await requireCohortInScope(cohortId);
  const progress = await getCohortProgress({ institutionId: ctx.institution.id, cohortId });
  if (!progress) throw new APIError('Not found', 'NOT_FOUND');

  const stamp = new Date().toISOString().slice(0, 10);
  return new NextResponse(CSV_BOM + cohortProgressCsv(progress), {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="avance-${progress.cohort.code}-${stamp}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
});
