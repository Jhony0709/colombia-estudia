/**
 * POST /api/cohorts/enrollments/[enrollmentId]/lessons/[assignmentId]/complete — marcar un
 * tema como completado a mano (`progress.override`), con motivo. Audita.
 * SSOT: reference/02-api/endpoints.md:78 (era `POST /api/cohorts/progress/[progressId]/complete`).
 *
 * Cambió la forma de la URL (19/9): la fila de `LessonProgress` no existe hasta que el
 * estudiante abre el tema, así que no siempre hay `progressId` que poner en la ruta. La
 * matrícula y la asignación sí existen siempre.
 */

import { z } from 'zod';
import { apiHandler } from '@/lib/http/api-handler';
import { getRequestContext } from '@/lib/authz/request-context';
import { routeParam } from '@/lib/http/admin-input';
import { APIError } from '@/lib/core/errors';
import { overrideLessonProgress } from '@/features/cohorts/server/enrollment-detail.service';

const schema = z.object({
  reason: z.string().trim().min(5).max(500),
});

type Input = z.infer<typeof schema>;

export const POST = apiHandler<Input>({ schema, capability: 'progress.override' })(async (
  _req,
  routeCtx,
  input
) => {
  const ctx = await getRequestContext();
  if (!ctx.person) throw new APIError('Authentication required', 'UNAUTHENTICATED');

  return overrideLessonProgress({
    institutionId: ctx.institution.id,
    actorId: ctx.person.id,
    enrollmentId: await routeParam(routeCtx.params, 'enrollmentId'),
    assignmentId: await routeParam(routeCtx.params, 'assignmentId'),
    reason: input.reason,
  });
});
