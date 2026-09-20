/**
 * GET /api/people/export — CSV of everything the current filter matches.
 * SSOT: plan/06-cohortes-y-personas.md:80 ("exportar CSV en cada tabla").
 * AMBIGUO: no estaba en reference/02-api/endpoints.md; añadido en §12a.
 *
 * Carries PII in the clear on purpose — it is what operations pastes into a spreadsheet —
 * so it audits `person.pii_export` with the filter and the row count.
 */

import { NextResponse } from 'next/server';
import { apiHandler } from '@/lib/http/api-handler';
import { requireInstitutionId } from '@/lib/http/admin-input';
import { exportPeople, parsePeopleFilters } from '@/features/people/server/people.service';
import { CSV_BOM } from '@/lib/csv/serialize';

export const GET = apiHandler({ capability: 'people.manage' })(async (req, ctx) => {
  const filters = parsePeopleFilters(Object.fromEntries(req.nextUrl.searchParams));

  const csv = await exportPeople({
    institutionId: requireInstitutionId(ctx.institutionId),
    actorId: ctx.personId ?? null,
    filters,
  });

  const stamp = new Date().toISOString().slice(0, 10);

  return new NextResponse(CSV_BOM + csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="personas-${stamp}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
});
