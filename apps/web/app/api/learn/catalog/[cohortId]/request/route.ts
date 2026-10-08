/**
 * POST /api/learn/catalog/[cohortId]/request — pedir la matrícula de un curso de pago (6/10).
 * Body: `{ moduleId }`. No matricula: avisa al equipo (`requestEnrollment`), que arma el plan
 * de pagos y, si es menor, el acudiente. SSOT: reference/02-api/endpoints.md (Aprender).
 *
 * Sin capacidad, como `…/enroll`: quien acaba de registrarse no tiene ninguna. Basta la
 * sesión; el `personId` sale del contexto y el servicio solo acepta cohortes abiertas de
 * programas de pago.
 */

import { z } from 'zod';
import { apiHandler } from '@/lib/http/api-handler';
import { getRequestContext } from '@/lib/authz/request-context';
import { APIError } from '@/lib/core/errors';
import { routeParam } from '@/lib/http/admin-input';
import { requestEnrollment } from '@/features/learn/server/catalog.service';

const schema = z.object({ moduleId: z.string().cuid() });
type Input = z.infer<typeof schema>;

export const POST = apiHandler<Input>({ schema })(async (_req, routeCtx, input) => {
  const ctx = await getRequestContext();
  if (!ctx.person) throw new APIError('Authentication required', 'UNAUTHENTICATED');

  return requestEnrollment({
    institutionId: ctx.institution.id,
    personId: ctx.person.id,
    cohortId: await routeParam(routeCtx.params, 'cohortId'),
    moduleId: input.moduleId,
  });
});
