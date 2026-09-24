/**
 * GET /api/learn/calendar — fechas de cohorte, `dueAt` y sesiones en vivo del estudiante.
 * SSOT: endpoints.md:46.
 */

import { apiHandler } from '@/lib/http/api-handler';
import { getRequestContext } from '@/lib/authz/request-context';
import { APIError } from '@/lib/core/errors';
import { getCalendarForStudent } from '@/features/learn/server/calendar.service';

export const GET = apiHandler({ capability: 'lesson.read' })(async () => {
  const ctx = await getRequestContext();
  if (!ctx.person) throw new APIError('Authentication required', 'UNAUTHENTICATED');
  // Todas las cohortes activas (21/9).
  return getCalendarForStudent({
    institutionId: ctx.institution.id,
    personId: ctx.person.id,
  });
});
