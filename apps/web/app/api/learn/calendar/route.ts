/**
 * GET /api/learn/calendar — fechas de cohorte, `dueAt` y sesiones en vivo del estudiante.
 * SSOT: endpoints.md:46.
 */

import { apiHandler } from '@/lib/http/api-handler';
import { getRequestContext } from '@/lib/authz/request-context';
import { APIError } from '@/lib/core/errors';
import { getCohortOutline } from '@/features/learn/server/cohort.service';
import { getCalendarForEnrollment } from '@/features/cohorts/server/live-sessions.service';

export const GET = apiHandler({ capability: 'lesson.read' })(async () => {
  const ctx = await getRequestContext();
  if (!ctx.person) throw new APIError('Authentication required', 'UNAUTHENTICATED');
  const outline = await getCohortOutline({
    institutionId: ctx.institution.id,
    personId: ctx.person.id,
  });
  if (!outline.enrollmentId) return [];
  return getCalendarForEnrollment({
    institutionId: ctx.institution.id,
    enrollmentId: outline.enrollmentId,
  });
});
