/**
 * GET  /api/admin/programs/[programId]/prices — la lista de precios del programa (25/9).
 * POST /api/admin/programs/[programId]/prices — añade un precio.
 * SSOT: reference/02-api/endpoints.md (Admin), features/billing/server/prices.service.ts.
 */

import { z } from 'zod';
import { apiHandler } from '@/lib/http/api-handler';
import { requireInstitutionId, routeParam } from '@/lib/http/admin-input';
import { createProgramPrice, listProgramPrices } from '@/features/billing/server/prices.service';

export const GET = apiHandler({ capability: 'institution.manage' })(async (req, ctx) =>
  listProgramPrices({
    institutionId: requireInstitutionId(ctx.institutionId),
    programId: await routeParam(ctx.params, 'programId'),
    includeArchived: new URL(req.url).searchParams.get('archivados') === '1',
  })
);

const schema = z.object({
  gradeFrom: z.number().int().min(0).max(13).nullable(),
  gradeTo: z.number().int().min(0).max(13).nullable(),
  amount: z.number().int().positive().max(1_000_000_000),
  period: z.enum(['ONE_TIME', 'MONTHLY', 'PER_MODULE']),
  validFrom: z.string().date(),
  validTo: z.string().date().nullable(),
});

type Input = z.infer<typeof schema>;

export const POST = apiHandler<Input>({ schema, capability: 'institution.manage' })(
  async (_req, ctx, input) =>
    createProgramPrice({
      institutionId: requireInstitutionId(ctx.institutionId),
      actorId: ctx.personId ?? null,
      programId: await routeParam(ctx.params, 'programId'),
      input,
    })
);
