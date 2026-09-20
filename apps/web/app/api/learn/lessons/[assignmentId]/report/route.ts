/**
 * POST /api/learn/lessons/[assignmentId]/report — «Reportar un problema» con el tema.
 * SSOT: endpoints.md:40 (`lesson.read`), plan/08 §2.
 */

import { z } from 'zod';
import { apiHandler } from '@/lib/http/api-handler';
import { getRequestContext } from '@/lib/authz/request-context';
import { routeParam, optionalText, blankToNull } from '@/lib/http/admin-input';
import { APIError } from '@/lib/core/errors';
import { PROBLEM_REASONS, reportLessonProblem } from '@/features/learn/server/report.service';

const schema = z.object({
  reason: z.enum(PROBLEM_REASONS),
  details: optionalText(1_000).optional(),
});

type Input = z.infer<typeof schema>;

export const POST = apiHandler<Input>({ schema, capability: 'lesson.read' })(async (
  _req,
  routeCtx,
  input
) => {
  const ctx = await getRequestContext();
  if (!ctx.person) throw new APIError('Authentication required', 'UNAUTHENTICATED');
  return reportLessonProblem({
    institutionId: ctx.institution.id,
    personId: ctx.person.id,
    assignmentId: await routeParam(routeCtx.params, 'assignmentId'),
    reason: input.reason,
    details: input.details ? blankToNull(input.details) : null,
  });
});
