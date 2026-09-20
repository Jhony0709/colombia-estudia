/**
 * POST /api/content/assessments/[assessmentId]/publish
 * SSOT: reference/02-api/endpoints.md:57 — "Valida preguntas; `content` sin claves del
 * `answerKey`".
 *
 * Esa última parte (`answer-key-leak`) es una comprobación **estructural**: que no aparezcan
 * claves como `answerKey` o `correct` dentro de `content`. Coge el error de programación, no
 * el enunciado que regala la respuesta en español.
 */

import { z } from 'zod';
import { apiHandler } from '@/lib/http/api-handler';
import { getRequestContext } from '@/lib/authz/request-context';
import { APIError } from '@/lib/core/errors';
import { publishAssessment } from '@/features/content/server/assessments.service';

const schema = z.object({ versionId: z.string().cuid() });

type Input = z.infer<typeof schema>;

export const POST = apiHandler<Input>({ schema, capability: 'lesson.publish' })(async (
  _req,
  _ctx,
  input
) => {
  const ctx = await getRequestContext();
  if (!ctx.person) throw new APIError('Authentication required', 'UNAUTHENTICATED');

  return publishAssessment({
    institutionId: ctx.institution.id,
    actorId: ctx.person.id,
    versionId: input.versionId,
  });
});
