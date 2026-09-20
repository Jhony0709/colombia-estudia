/**
 * PATCH /api/admin/subjects/[subjectId] — actualizar o archivar.
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
import { updateSubject, archiveSubject } from '@/features/admin/server/curriculum.service';

const schema = z.discriminatedUnion('op', [
  z.object({
    op: z.literal('update'),
    name: z.string().trim().min(1, 'El nombre es obligatorio').max(160),
    code: optionalText(40),
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
  const subjectId = await routeParam(ctx.params, 'subjectId');

  if (input.op === 'archive') {
    return archiveSubject({ institutionId, actorId, subjectId });
  }

  return updateSubject({
    institutionId,
    actorId,
    subjectId,
    data: { name: input.name.trim(), code: blankToNull(input.code) },
  });
});
