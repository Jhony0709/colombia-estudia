/**
 * PUT /api/content/lessons/[lessonId]/details — corrige los datos del tema.
 * SSOT: reference/02-api/endpoints.md (Content), revisión de UX del 18/9.
 *
 * Separado del `PATCH` del borrador a propósito: ese guarda el texto cada cinco segundos, y
 * mandar el título y el módulo en cada autoguardado sería mandar sesenta veces por hora una
 * decisión que se toma una.
 *
 * `PUT` y no `PATCH` porque reemplaza el objeto completo: el formulario trae los cinco
 * campos siempre, y así no hay que adivinar si un campo ausente es «no lo cambies» o
 * «déjalo vacío».
 */

import { z } from 'zod';
import { apiHandler } from '@/lib/http/api-handler';
import { getRequestContext } from '@/lib/authz/request-context';
import { routeParam, optionalText, blankToNull } from '@/lib/http/admin-input';
import { APIError } from '@/lib/core/errors';
import { updateLessonDetails } from '@/features/content/server/lessons.service';

const schema = z.object({
  title: z.string().trim().min(1, 'El tema necesita un título').max(200),
  learningObjective: optionalText(500),
  subjectId: z.string().cuid(),
  moduleId: z.string().cuid(),
  requiresSubmission: z.boolean(),
});

type Input = z.infer<typeof schema>;

export const PUT = apiHandler<Input>({ schema, capability: 'lesson.author' })(async (
  _req,
  routeCtx,
  input
) => {
  const ctx = await getRequestContext();
  if (!ctx.person) throw new APIError('Authentication required', 'UNAUTHENTICATED');

  return updateLessonDetails({
    institutionId: ctx.institution.id,
    actorId: ctx.person.id,
    lessonId: await routeParam(routeCtx.params, 'lessonId'),
    title: input.title,
    learningObjective: blankToNull(input.learningObjective),
    subjectId: input.subjectId,
    moduleId: input.moduleId,
    requiresSubmission: input.requiresSubmission,
  });
});
