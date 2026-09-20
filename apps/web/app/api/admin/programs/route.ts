/**
 * POST /api/admin/programs
 * SSOT: plan/06-cohortes-y-personas.md:19-22 (§2 Programa, módulos, asignaturas)
 * AMBIGUO: no estaba en reference/02-api/endpoints.md; añadido en §11b.
 */

import { z } from 'zod';
import { apiHandler } from '@/lib/http/api-handler';
import { optionalText, blankToNull, requireInstitutionId } from '@/lib/http/admin-input';
import { createProgram } from '@/features/admin/server/curriculum.service';

const schema = z.object({
  code: z.string().trim().min(1, 'El código es obligatorio').max(40),
  name: z.string().trim().min(1, 'El nombre es obligatorio').max(160),
  description: optionalText(2000),
  defaultAccessDays: z.number().int().min(1, 'Mínimo 1 día').max(3650),
});

type Input = z.infer<typeof schema>;

export const POST = apiHandler<Input>({ schema, capability: 'institution.manage' })(
  async (_req, ctx, input) =>
    createProgram({
      institutionId: requireInstitutionId(ctx.institutionId),
      actorId: ctx.personId ?? null,
      data: {
        code: input.code.trim(),
        name: input.name.trim(),
        description: blankToNull(input.description),
        defaultAccessDays: input.defaultAccessDays,
      },
    })
);
