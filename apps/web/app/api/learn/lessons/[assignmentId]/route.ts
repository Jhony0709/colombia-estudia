/**
 * GET /api/learn/lessons/[assignmentId] — el tema tal como lo ve quien pregunta.
 * SSOT: reference/02-api/endpoints.md:37, plan/08-aprender-y-evaluar.md:22-28.
 *
 * `lesson.read` dice que puede leer contenido; el `personId` del contexto dice **cuál**. El
 * id de la asignación viene de la URL, pero no basta para abrir nada: el servicio lo cruza
 * con la ruta del programa de esta persona.
 */

import { apiHandler } from '@/lib/http/api-handler';
import { getRequestContext } from '@/lib/authz/request-context';
import { APIError } from '@/lib/core/errors';
import { getLessonForStudent } from '@/features/learn/server/lesson.service';

export const GET = apiHandler({ capability: 'lesson.read' })(async (_req, routeCtx) => {
  const ctx = await getRequestContext();
  if (!ctx.person) throw new APIError('Authentication required', 'UNAUTHENTICATED');

  const { assignmentId } = await routeCtx.params;

  if (typeof assignmentId !== 'string') {
    throw new APIError('assignmentId is required', 'VALIDATION_ERROR');
  }

  return getLessonForStudent({
    institutionId: ctx.institution.id,
    personId: ctx.person.id,
    assignmentId,
  });
});
