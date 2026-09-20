/**
 * GET /api/learn/library — recursos descargables por módulo (URLs firmadas).
 * SSOT: endpoints.md:47.
 */

import { apiHandler } from '@/lib/http/api-handler';
import { getRequestContext } from '@/lib/authz/request-context';
import { APIError } from '@/lib/core/errors';
import { getLibraryForStudent } from '@/features/learn/server/library.service';

export const GET = apiHandler({ capability: 'lesson.read' })(async () => {
  const ctx = await getRequestContext();
  if (!ctx.person) throw new APIError('Authentication required', 'UNAUTHENTICATED');
  return getLibraryForStudent({ institutionId: ctx.institution.id, personId: ctx.person.id });
});
