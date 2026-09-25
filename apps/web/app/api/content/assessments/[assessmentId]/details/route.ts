/**
 * PUT /api/content/assessments/[assessmentId]/details — corrige los datos del examen (25/9).
 * SSOT: reference/02-api/endpoints.md (Content).
 *
 * Espejo de `lessons/[lessonId]/details`: separado del `PATCH` del borrador (que guarda las
 * preguntas y las reglas del intento) y `PUT` porque el formulario manda los seis campos
 * siempre. Con una versión publicada, el servicio rechaza cambiar de componente o de tema.
 */

import { z } from 'zod';
import { apiHandler } from '@/lib/http/api-handler';
import { getRequestContext } from '@/lib/authz/request-context';
import { routeParam, optionalText, blankToNull } from '@/lib/http/admin-input';
import { APIError } from '@/lib/core/errors';
import { updateAssessmentDetails } from '@/features/content/server/assessments.service';

const schema = z.object({
  title: z.string().trim().min(1, 'El examen necesita un título').max(200),
  kind: z.enum(['DIAGNOSTIC', 'SUBJECT', 'FINAL']),
  moduleId: z.string().cuid().nullable(),
  lessonId: z.string().cuid().nullable(),
  subjectId: z.string().cuid().nullable(),
  learningObjective: optionalText(500),
});

type Input = z.infer<typeof schema>;

export const PUT = apiHandler<Input>({ schema, capability: 'lesson.author' })(async (
  _req,
  routeCtx,
  input
) => {
  const ctx = await getRequestContext();
  if (!ctx.person) throw new APIError('Authentication required', 'UNAUTHENTICATED');

  // Una diagnóstica es del programa entero: sin componente y, por tanto, sin tema.
  const moduleId = input.kind === 'DIAGNOSTIC' ? null : input.moduleId;
  return updateAssessmentDetails({
    institutionId: ctx.institution.id,
    actorId: ctx.person.id,
    assessmentId: await routeParam(routeCtx.params, 'assessmentId'),
    title: input.title,
    kind: input.kind,
    moduleId,
    lessonId: moduleId ? input.lessonId : null,
    subjectId: input.subjectId,
    learningObjective: blankToNull(input.learningObjective),
  });
});
