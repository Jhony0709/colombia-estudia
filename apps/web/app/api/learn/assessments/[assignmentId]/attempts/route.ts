/**
 * POST /api/learn/assessments/[assignmentId]/attempts — empezar (o continuar) un intento.
 * SSOT: reference/02-api/endpoints.md:42, plan/08-aprender-y-evaluar.md:49-52.
 *
 * `assessment.take` lo comprueba el handler; `lesson.progress.own` se comprueba aquí porque
 * la tabla de endpoints pide las dos: una matrícula vencida conserva `assessment.take` para
 * leer, pero no puede dejar rastro nuevo.
 */

import { apiHandler } from '@/lib/http/api-handler';
import { getRequestContext } from '@/lib/authz/request-context';
import { routeParam } from '@/lib/http/admin-input';
import { APIError } from '@/lib/core/errors';
import { startAttempt } from '@/features/learn/server/attempt.service';

export const POST = apiHandler({ capability: 'assessment.take' })(async (_req, routeCtx) => {
  const ctx = await getRequestContext();
  if (!ctx.person) throw new APIError('Authentication required', 'UNAUTHENTICATED');
  if ((ctx.capabilities.get('lesson.progress.own')?.length ?? 0) === 0) {
    throw new APIError('Missing capability: lesson.progress.own', 'INSUFFICIENT_CAPABILITY');
  }

  return startAttempt({
    institutionId: ctx.institution.id,
    personId: ctx.person.id,
    assignmentId: await routeParam(routeCtx.params, 'assignmentId'),
  });
});
