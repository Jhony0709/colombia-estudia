/**
 * PATCH /api/admin/programs/[programId]/prices/[priceId] — archivar, corregir o borrar un precio.
 * Corregir y borrar solo si ningún plan de pagos lo usa (8/10); si alguno lo usa, se archiva y
 * se crea otro con la nueva vigencia. SSOT: features/billing/server/prices.service.ts.
 */

import { z } from 'zod';
import { apiHandler } from '@/lib/http/api-handler';
import { requireInstitutionId, routeParam } from '@/lib/http/admin-input';
import {
  archiveProgramPrice,
  deleteProgramPrice,
  updateProgramPrice,
} from '@/features/billing/server/prices.service';
import { priceFields } from '../schema';

const schema = z.discriminatedUnion('op', [
  z.object({ op: z.literal('archive') }),
  z.object({ op: z.literal('delete') }),
  priceFields.extend({ op: z.literal('update') }),
]);

type Input = z.infer<typeof schema>;

export const PATCH = apiHandler<Input>({ schema, capability: 'institution.manage' })(async (
  _req,
  ctx,
  input
) => {
  const base = {
    institutionId: requireInstitutionId(ctx.institutionId),
    actorId: ctx.personId ?? null,
    programId: await routeParam(ctx.params, 'programId'),
    priceId: await routeParam(ctx.params, 'priceId'),
  };
  switch (input.op) {
    case 'archive':
      return archiveProgramPrice(base);
    case 'delete':
      return deleteProgramPrice(base);
    case 'update':
      return updateProgramPrice({
        ...base,
        input: {
          gradeFrom: input.gradeFrom,
          gradeTo: input.gradeTo,
          amount: input.amount,
          period: input.period,
          validFrom: input.validFrom,
          validTo: input.validTo,
        },
      });
  }
});
