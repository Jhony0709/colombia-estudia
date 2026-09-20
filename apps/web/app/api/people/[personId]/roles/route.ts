/**
 * POST /api/people/[personId]/roles — conceder o revocar un rol.
 * SSOT: plan/06-cohortes-y-personas.md:35 ("Roles como chips añadir/revocar (auditado)").
 * AMBIGUO: no estaba en reference/02-api/endpoints.md; añadido en §12b.
 */

import { z } from 'zod';
import { apiHandler } from '@/lib/http/api-handler';
import { APIError } from '@/lib/core/errors';
import { requireInstitutionId, routeParam } from '@/lib/http/admin-input';
import {
  ROLES,
  grantRole,
  revokeRole,
  roleChangeNeedsInstitutionManage,
} from '@/features/people/server/people.service';

const schema = z.object({
  op: z.enum(['grant', 'revoke']),
  role: z.enum(ROLES),
});

type Input = z.infer<typeof schema>;

export const POST = apiHandler<Input>({ schema, capability: 'people.manage' })(async (
  _req,
  ctx,
  input
) => {
  const institutionId = requireInstitutionId(ctx.institutionId);
  const actorId = ctx.personId ?? null;
  const personId = await routeParam(ctx.params, 'personId');

  // `people.manage` alone must not hand out ADMIN: OPERATIONS has it, and this screen
  // would otherwise be a one-click privilege escalation.
  if (roleChangeNeedsInstitutionManage(input.role)) {
    const { getRequestContext } = await import('@/lib/authz/request-context');
    const authCtx = await getRequestContext();
    const scopes = authCtx.capabilities.get('institution.manage');
    if (!scopes || scopes.length === 0) {
      throw new APIError(
        'Solo la administración puede conceder o revocar el rol de administración',
        'INSUFFICIENT_CAPABILITY'
      );
    }
  }

  return input.op === 'grant'
    ? grantRole({ institutionId, actorId, personId, role: input.role })
    : revokeRole({ institutionId, actorId, personId, role: input.role });
});
