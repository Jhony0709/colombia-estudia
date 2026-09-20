/**
 * POST /api/learn/lessons/[assignmentId]/evidence — el estudiante deja evidencia de estudio.
 * SSOT: reference/02-api/endpoints.md:38, plan/08-aprender-y-evaluar.md:36-40.
 *
 * Idempotente por diseño: la evidencia solo crece, así que repetir una llamada no cambia
 * nada. El cliente la manda cada pocos segundos y con `sendBeacon` al cerrar la pestaña.
 */

import { z } from 'zod';
import { apiHandler } from '@/lib/http/api-handler';
import { getRequestContext } from '@/lib/authz/request-context';
import { routeParam } from '@/lib/http/admin-input';
import { APIError } from '@/lib/core/errors';
import { recordEvidence } from '@/features/learn/server/progress.service';

const schema = z.object({
  secondsOnLesson: z.number().int().nonnegative().max(86_400).optional(),
  scrolledToEnd: z.boolean().optional(),
  videoPositionSeconds: z.number().nonnegative().max(43_200).optional(),
  videoDurationSeconds: z.number().positive().max(43_200).optional(),
  transcriptReadToEnd: z.boolean().optional(),
});

type Input = z.infer<typeof schema>;

export const POST = apiHandler<Input>({ schema, capability: 'lesson.progress.own' })(async (
  _req,
  routeCtx,
  input
) => {
  const ctx = await getRequestContext();
  if (!ctx.person) throw new APIError('Authentication required', 'UNAUTHENTICATED');

  return recordEvidence({
    institutionId: ctx.institution.id,
    personId: ctx.person.id,
    assignmentId: await routeParam(routeCtx.params, 'assignmentId'),
    input,
  });
});
