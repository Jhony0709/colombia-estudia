/**
 * POST /api/admin/modules
 * SSOT: plan/06-cohortes-y-personas.md:19-22.
 * AMBIGUO: no estaba en reference/02-api/endpoints.md; añadido en §11b.
 */

import { z } from 'zod';
import { apiHandler } from '@/lib/http/api-handler';
import { requireInstitutionId } from '@/lib/http/admin-input';
import { createModule } from '@/features/admin/server/curriculum.service';

const schema = z.object({
  programId: z.string().trim().min(1),
  name: z.string().trim().min(1, 'El nombre es obligatorio').max(160),
});

type Input = z.infer<typeof schema>;

export const POST = apiHandler<Input>({ schema, capability: 'institution.manage' })(
  async (_req, ctx, input) =>
    createModule({
      institutionId: requireInstitutionId(ctx.institutionId),
      actorId: ctx.personId ?? null,
      programId: input.programId,
      name: input.name.trim(),
    })
);
