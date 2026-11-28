/**
 * GET /api/learn/enrollments — las matrículas de quien pregunta, para elegir programa en la app
 * móvil (27/11). SSOT: reference/02-api/endpoints.md.
 */

import { apiHandler } from '@/lib/http/api-handler';
import { getRequestContext } from '@/lib/authz/request-context';
import { APIError } from '@/lib/core/errors';
import { listMyEnrollments } from '@/features/learn/server/cohort.service';

export const GET = apiHandler({ capability: 'lesson.read' })(async () => {
  const ctx = await getRequestContext();
  if (!ctx.person) throw new APIError('Authentication required', 'UNAUTHENTICATED');
  return {
    enrollments: await listMyEnrollments({
      institutionId: ctx.institution.id,
      personId: ctx.person.id,
    }),
  };
});
