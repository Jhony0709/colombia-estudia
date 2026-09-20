/**
 * GET /api/cohorts/import/template — la plantilla del importador.
 * SSOT: plan/06-cohortes-y-personas.md:40-44.
 * AMBIGUO: no estaba en reference/02-api/endpoints.md; añadido en §14a.
 */

import { NextResponse } from 'next/server';
import { apiHandler } from '@/lib/http/api-handler';
import { CSV_BOM } from '@/lib/csv/serialize';
import { buildTemplateCsv } from '@/features/cohorts/server/import/template';

export const GET = apiHandler({ capability: 'cohort.manage' })(
  async () =>
    new NextResponse(CSV_BOM + buildTemplateCsv(), {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="plantilla-matriculas.csv"',
        'Cache-Control': 'no-store',
      },
    })
);
