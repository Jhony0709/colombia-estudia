/**
 * POST /api/content/lessons/[lessonId]/archive — saca un tema de la lista de autoría.
 * SSOT: plan/06-cohortes-y-personas.md:78-82 («no se borra nada, nunca»).
 *
 * `archiveLesson` existía en el servicio desde la Fase 3 y **no lo llamaba nadie**: un tema
 * creado por error se quedaba en la lista para siempre. Esta es la puerta que le faltaba.
 *
 * Archivar no lo quita de las cohortes que ya lo tienen asignado: quien lo está estudiando
 * lo sigue viendo. Sale de la lista de quien escribe, que es de lo que se trata.
 */

import { apiHandler } from '@/lib/http/api-handler';
import { getRequestContext } from '@/lib/authz/request-context';
import { routeParam } from '@/lib/http/admin-input';
import { APIError } from '@/lib/core/errors';
import { archiveLesson } from '@/features/content/server/lessons.service';

export const POST = apiHandler({ capability: 'lesson.author' })(async (_req, routeCtx) => {
  const ctx = await getRequestContext();
  if (!ctx.person) throw new APIError('Authentication required', 'UNAUTHENTICATED');

  return archiveLesson({
    institutionId: ctx.institution.id,
    actorId: ctx.person.id,
    lessonId: await routeParam(routeCtx.params, 'lessonId'),
  });
});
