/**
 * POST /api/learn/catalog/[cohortId]/enroll — la persona se inscribe en un curso (componente)
 * gratuito abierto (25/9). Body: `{ moduleId }`. SSOT: reference/02-api/endpoints.md (Aprender).
 *
 * Sin capacidad: quien acaba de registrarse y no tiene matrícula no tiene ninguna
 * (`resolveCapabilities`: STUDENT se resuelve por matrículas), y justamente es quien necesita
 * este botón. Basta la sesión; el `personId` sale del contexto, nunca de la petición, y el
 * servicio solo acepta cohortes abiertas de programas gratuitos.
 */

import { z } from 'zod';
import { apiHandler } from '@/lib/http/api-handler';
import { getRequestContext } from '@/lib/authz/request-context';
import { APIError } from '@/lib/core/errors';
import { routeParam } from '@/lib/http/admin-input';
import { selfEnroll } from '@/features/learn/server/catalog.service';

const schema = z.object({ moduleId: z.string().cuid() });
type Input = z.infer<typeof schema>;

export const POST = apiHandler<Input>({ schema })(async (_req, routeCtx, input) => {
  const ctx = await getRequestContext();
  if (!ctx.person) throw new APIError('Authentication required', 'UNAUTHENTICATED');

  return selfEnroll({
    institutionId: ctx.institution.id,
    personId: ctx.person.id,
    cohortId: await routeParam(routeCtx.params, 'cohortId'),
    moduleId: input.moduleId,
  });
});
