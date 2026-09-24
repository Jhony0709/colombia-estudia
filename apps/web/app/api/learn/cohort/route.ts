/**
 * GET /api/learn/cohort — la ruta del programa del estudiante que pregunta.
 * SSOT: reference/02-api/endpoints.md:36, plan/08-aprender-y-evaluar.md:12-19.
 *
 * `lesson.read` como capacidad, y el `personId` del contexto como filtro: la capacidad dice
 * que puede leer contenido, el `personId` dice **de quién** es el progreso. Lo segundo nunca
 * viene en la petición.
 */

import { apiHandler } from '@/lib/http/api-handler';
import { getRequestContext } from '@/lib/authz/request-context';
import { APIError } from '@/lib/core/errors';
import { getCohortOutline } from '@/features/learn/server/cohort.service';

export const GET = apiHandler({ capability: 'lesson.read' })(async (req) => {
  const ctx = await getRequestContext();
  if (!ctx.person) throw new APIError('Authentication required', 'UNAUTHENTICATED');

  // `?enrollmentId=` elige entre varias matrículas (21/9); sin él, la más reciente. Un id
  // que no sea de la persona no encuentra nada: el filtro por `personId` sigue mandando.
  const enrollmentId = new URL(req.url).searchParams.get('enrollmentId');

  return getCohortOutline({
    institutionId: ctx.institution.id,
    personId: ctx.person.id,
    enrollmentId,
  });
});
