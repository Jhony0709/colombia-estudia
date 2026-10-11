/** POST …/feedback (11/10): sin capacidad; una matrícula ajena es `NOT_FOUND`. */

import { z } from 'zod';
import { apiHandler } from '@/lib/http/api-handler';
import { getRequestContext } from '@/lib/authz/request-context';
import { APIError } from '@/lib/core/errors';
import { routeParam } from '@/lib/http/admin-input';
import { FEEDBACK_COMMENT_MAX } from '@/features/feedback/feedback-constants';
import { submitModuleFeedback } from '@/features/feedback/server/feedback.service';

const score = z.number().int().min(1).max(5);
const schema = z.object({
  usefulness: score,
  understanding: score,
  clarity: score,
  support: score.nullable(),
  comment: z.string().trim().max(FEEDBACK_COMMENT_MAX).nullable(),
});
type Input = z.infer<typeof schema>;

export const POST = apiHandler<Input>({ schema })(async (_req, routeCtx, input) => {
  const ctx = await getRequestContext();
  if (!ctx.person) throw new APIError('Authentication required', 'UNAUTHENTICATED');

  return submitModuleFeedback({
    institutionId: ctx.institution.id,
    personId: ctx.person.id,
    enrollmentId: await routeParam(routeCtx.params, 'enrollmentId'),
    moduleId: await routeParam(routeCtx.params, 'moduleId'),
    input,
  });
});
