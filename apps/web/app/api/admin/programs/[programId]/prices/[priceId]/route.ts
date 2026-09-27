/**
 * PATCH /api/admin/programs/[programId]/prices/[priceId] — archiva un precio (25/9).
 * Un precio no se edita ni se borra: los planes lo referencian. Para cambiar, se archiva y
 * se crea otro con la nueva vigencia.
 */

import { z } from 'zod';
import { apiHandler } from '@/lib/http/api-handler';
import { requireInstitutionId, routeParam } from '@/lib/http/admin-input';
import { archiveProgramPrice } from '@/features/billing/server/prices.service';

const schema = z.object({ op: z.literal('archive') });

type Input = z.infer<typeof schema>;

export const PATCH = apiHandler<Input>({ schema, capability: 'institution.manage' })(
  async (_req, ctx) =>
    archiveProgramPrice({
      institutionId: requireInstitutionId(ctx.institutionId),
      actorId: ctx.personId ?? null,
      priceId: await routeParam(ctx.params, 'priceId'),
    })
);
