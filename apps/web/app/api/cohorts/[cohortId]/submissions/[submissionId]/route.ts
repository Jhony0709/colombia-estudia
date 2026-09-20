/**
 * PATCH /api/cohorts/[cohortId]/submissions/[submissionId] — aprobar o devolver.
 * SSOT: reference/02-api/endpoints.md:79, plan/08-aprender-y-evaluar.md:72-76.
 */

import { z } from 'zod';
import { apiHandler } from '@/lib/http/api-handler';
import { getRequestContext } from '@/lib/authz/request-context';
import { routeParam, optionalText, blankToNull } from '@/lib/http/admin-input';
import { APIError } from '@/lib/core/errors';
import { reviewSubmission } from '@/features/cohorts/server/submissions.service';

const schema = z.object({
  decision: z.enum(['APPROVED', 'RETURNED']),
  feedback: optionalText(4_000).optional(),
});

type Input = z.infer<typeof schema>;

export const PATCH = apiHandler<Input>({ schema, capability: 'assessment.grade' })(async (
  _req,
  routeCtx,
  input
) => {
  const ctx = await getRequestContext();
  if (!ctx.person) throw new APIError('Authentication required', 'UNAUTHENTICATED');

  return reviewSubmission({
    institutionId: ctx.institution.id,
    actorId: ctx.person.id,
    cohortId: await routeParam(routeCtx.params, 'cohortId'),
    submissionId: await routeParam(routeCtx.params, 'submissionId'),
    decision: input.decision,
    feedback: input.feedback ? blankToNull(input.feedback) : null,
  });
});
