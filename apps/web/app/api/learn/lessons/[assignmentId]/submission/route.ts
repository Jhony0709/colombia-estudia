/**
 * POST /api/learn/lessons/[assignmentId]/submission — el estudiante entrega (o reenvía).
 * SSOT: reference/02-api/endpoints.md:41, plan/08-aprender-y-evaluar.md:42-44.
 */

import { z } from 'zod';
import { apiHandler } from '@/lib/http/api-handler';
import { getRequestContext } from '@/lib/authz/request-context';
import { routeParam, optionalText, blankToNull } from '@/lib/http/admin-input';
import { APIError } from '@/lib/core/errors';
import { submitLesson } from '@/features/learn/server/submission.service';

const schema = z.object({
  text: optionalText(20_000).optional(),
  /** Respuestas por enunciado (24/9), en el orden de los enunciados del tema. */
  answers: z.array(z.string().max(5_000)).max(20).optional(),
  fileAssetId: z.string().cuid().nullable().optional(),
});

type Input = z.infer<typeof schema>;

export const POST = apiHandler<Input>({ schema, capability: 'lesson.progress.own' })(async (
  _req,
  routeCtx,
  input
) => {
  const ctx = await getRequestContext();
  if (!ctx.person) throw new APIError('Authentication required', 'UNAUTHENTICATED');

  return submitLesson({
    institutionId: ctx.institution.id,
    personId: ctx.person.id,
    assignmentId: await routeParam(routeCtx.params, 'assignmentId'),
    text: input.text ? blankToNull(input.text) : null,
    answers: input.answers ?? null,
    fileAssetId: input.fileAssetId ?? null,
  });
});
