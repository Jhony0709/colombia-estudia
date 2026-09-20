/**
 * POST /api/learn/attempts/[attemptId]/submit — entregar. Califica y cierra.
 * SSOT: reference/02-api/endpoints.md:44, plan/08-aprender-y-evaluar.md:54.
 *
 * Devuelve el intento como lo deja ver `reviewPolicy`: nunca la clave.
 */

import { apiHandler } from '@/lib/http/api-handler';
import { getRequestContext } from '@/lib/authz/request-context';
import { routeParam } from '@/lib/http/admin-input';
import { APIError } from '@/lib/core/errors';
import { submitAttempt } from '@/features/learn/server/attempt.service';

export const POST = apiHandler({ capability: 'assessment.take' })(async (_req, routeCtx) => {
  const ctx = await getRequestContext();
  if (!ctx.person) throw new APIError('Authentication required', 'UNAUTHENTICATED');

  return submitAttempt({
    institutionId: ctx.institution.id,
    personId: ctx.person.id,
    attemptId: await routeParam(routeCtx.params, 'attemptId'),
  });
});
