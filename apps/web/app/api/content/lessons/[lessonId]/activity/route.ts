/**
 * PUT /api/content/lessons/[lessonId]/activity — las instrucciones de la actividad y qué se
 * acepta como entrega.
 * SSOT: reference/02-api/endpoints.md (Content), revisión UX del 23/9 (pieza 4).
 *
 * Aparte de `/details` porque no comparte sus candados: las instrucciones no están
 * versionadas y se corrigen con el tema publicado. `PUT` porque reemplaza la actividad entera.
 */

import { z } from 'zod';
import { apiHandler } from '@/lib/http/api-handler';
import { getRequestContext } from '@/lib/authz/request-context';
import { routeParam } from '@/lib/http/admin-input';
import { APIError } from '@/lib/core/errors';
import { updateLessonActivity } from '@/features/content/server/lessons.service';

const schema = z.object({
  instructions: z.string().trim().max(10_000),
  accepts: z.enum(['TEXT', 'FILE', 'TEXT_OR_FILE']),
  /** Enunciados (24/9); vacío = un solo texto. */
  prompts: z.array(z.string().trim().max(1_000)).max(20).optional(),
});

type Input = z.infer<typeof schema>;

export const PUT = apiHandler<Input>({ schema, capability: 'lesson.author' })(async (
  _req,
  routeCtx,
  input
) => {
  const ctx = await getRequestContext();
  if (!ctx.person) throw new APIError('Authentication required', 'UNAUTHENTICATED');

  return updateLessonActivity({
    institutionId: ctx.institution.id,
    actorId: ctx.person.id,
    lessonId: await routeParam(routeCtx.params, 'lessonId'),
    instructions: input.instructions === '' ? null : input.instructions,
    accepts: input.accepts,
    prompts: input.prompts ?? [],
  });
});
