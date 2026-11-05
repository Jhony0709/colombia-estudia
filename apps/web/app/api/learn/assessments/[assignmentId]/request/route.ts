/**
 * POST /api/learn/assessments/[assignmentId]/request — el estudiante perdió el examen con todos
 * los intentos y pide otra oportunidad (5/11). No la concede: deja una solicitud `ATTEMPT` para
 * operación (`requestAttempt`). Devuelve el id, que va como código en el mensaje de WhatsApp.
 * SSOT: reference/02-api/endpoints.md (Aprender).
 *
 * Sin capacidad: es la persona sobre su propio examen; uno ajeno es `NOT_FOUND`.
 */

import { apiHandler } from '@/lib/http/api-handler';
import { getRequestContext } from '@/lib/authz/request-context';
import { APIError } from '@/lib/core/errors';
import { routeParam } from '@/lib/http/admin-input';
import { requestAttempt } from '@/features/requests/server/requests.service';

export const POST = apiHandler()(async (_req, routeCtx) => {
  const ctx = await getRequestContext();
  if (!ctx.person) throw new APIError('Authentication required', 'UNAUTHENTICATED');

  const opened = await requestAttempt({
    institutionId: ctx.institution.id,
    personId: ctx.person.id,
    assignmentId: await routeParam(routeCtx.params, 'assignmentId'),
  });
  return { requestId: opened.id, requestedAt: opened.createdAt };
});
