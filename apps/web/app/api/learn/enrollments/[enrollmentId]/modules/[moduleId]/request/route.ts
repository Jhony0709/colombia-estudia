/**
 * POST /api/learn/enrollments/[enrollmentId]/modules/[moduleId]/request — el estudiante pide
 * que le habiliten el siguiente componente (6/10). No habilita: deja una solicitud para
 * operación (`requestUnlock`). SSOT: reference/02-api/endpoints.md (Aprender).
 *
 * Sin capacidad: es la persona sobre su propia matrícula. El servicio la busca con el
 * `personId` de la sesión, así que una matrícula ajena es `NOT_FOUND`.
 */

import { apiHandler } from '@/lib/http/api-handler';
import { getRequestContext } from '@/lib/authz/request-context';
import { APIError } from '@/lib/core/errors';
import { routeParam } from '@/lib/http/admin-input';
import { requestUnlock } from '@/features/requests/server/requests.service';

export const POST = apiHandler()(async (_req, routeCtx) => {
  const ctx = await getRequestContext();
  if (!ctx.person) throw new APIError('Authentication required', 'UNAUTHENTICATED');

  const opened = await requestUnlock({
    institutionId: ctx.institution.id,
    personId: ctx.person.id,
    enrollmentId: await routeParam(routeCtx.params, 'enrollmentId'),
    moduleId: await routeParam(routeCtx.params, 'moduleId'),
  });
  return { requestedAt: opened.createdAt };
});
