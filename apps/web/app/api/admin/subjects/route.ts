/**
 * POST /api/admin/subjects
 * SSOT: plan/06-cohortes-y-personas.md:19-22.
 * AMBIGUO: no estaba en reference/02-api/endpoints.md; añadido en §11b.
 */

import { z } from 'zod';
import { apiHandler } from '@/lib/http/api-handler';
import { optionalText, blankToNull, requireInstitutionId } from '@/lib/http/admin-input';
import { createSubject } from '@/features/admin/server/curriculum.service';

const schema = z.object({
  name: z.string().trim().min(1, 'El nombre es obligatorio').max(160),
  code: optionalText(40),
});

type Input = z.infer<typeof schema>;

export const POST = apiHandler<Input>({ schema, capability: 'institution.manage' })(
  async (_req, ctx, input) =>
    createSubject({
      institutionId: requireInstitutionId(ctx.institutionId),
      actorId: ctx.personId ?? null,
      data: { name: input.name.trim(), code: blankToNull(input.code) },
    })
);
