/**
 * POST /api/people/[personId]/guardians — vincular o desvincular un acudiente.
 * SSOT: plan/06-cohortes-y-personas.md:36 ("Acudencias para menores").
 * AMBIGUO: no estaba en reference/02-api/endpoints.md; añadido en §12c.
 */

import { z } from 'zod';
import { apiHandler } from '@/lib/http/api-handler';
import { requireInstitutionId, routeParam } from '@/lib/http/admin-input';
import { linkGuardian, unlinkGuardian } from '@/features/people/server/guardianship.service';

const schema = z.discriminatedUnion('op', [
  z.object({
    op: z.literal('link'),
    guardianHandle: z.string().trim().min(1, 'Indica el documento o el correo del acudiente'),
    relationship: z.string().trim().min(1, 'Indica el parentesco').max(60),
    isFinancialResponsible: z.boolean(),
  }),
  z.object({ op: z.literal('unlink'), guardianId: z.string().trim().min(1) }),
]);

type Input = z.infer<typeof schema>;

export const POST = apiHandler<Input>({ schema, capability: 'people.manage' })(async (
  _req,
  ctx,
  input
) => {
  const institutionId = requireInstitutionId(ctx.institutionId);
  const actorId = ctx.personId ?? null;
  const studentId = await routeParam(ctx.params, 'personId');

  if (input.op === 'unlink') {
    return unlinkGuardian({ institutionId, actorId, studentId, guardianId: input.guardianId });
  }

  return linkGuardian({
    institutionId,
    actorId,
    studentId,
    guardianHandle: input.guardianHandle,
    relationship: input.relationship,
    isFinancialResponsible: input.isFinancialResponsible,
  });
});
