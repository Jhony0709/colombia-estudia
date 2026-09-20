/**
 * PATCH /api/admin/programs/[programId] — actualizar o archivar.
 * SSOT: plan/06-cohortes-y-personas.md:19-22. Nada se borra: se archiva.
 * AMBIGUO: no estaba en reference/02-api/endpoints.md; añadido en §11b.
 */

import { z } from 'zod';
import { apiHandler } from '@/lib/http/api-handler';
import {
  optionalText,
  blankToNull,
  requireInstitutionId,
  routeParam,
} from '@/lib/http/admin-input';
import { updateProgram, archiveProgram } from '@/features/admin/server/curriculum.service';

const schema = z.discriminatedUnion('op', [
  z.object({
    op: z.literal('update'),
    code: z.string().trim().min(1, 'El código es obligatorio').max(40),
    name: z.string().trim().min(1, 'El nombre es obligatorio').max(160),
    description: optionalText(2000),
    defaultAccessDays: z.number().int().min(1, 'Mínimo 1 día').max(3650),
  }),
  z.object({ op: z.literal('archive') }),
]);

type Input = z.infer<typeof schema>;

export const PATCH = apiHandler<Input>({ schema, capability: 'institution.manage' })(async (
  _req,
  ctx,
  input
) => {
  const institutionId = requireInstitutionId(ctx.institutionId);
  const actorId = ctx.personId ?? null;
  const programId = await routeParam(ctx.params, 'programId');

  if (input.op === 'archive') {
    return archiveProgram({ institutionId, actorId, programId });
  }

  return updateProgram({
    institutionId,
    actorId,
    programId,
    data: {
      code: input.code.trim(),
      name: input.name.trim(),
      description: blankToNull(input.description),
      defaultAccessDays: input.defaultAccessDays,
    },
  });
});
