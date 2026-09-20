/**
 * PATCH /api/cohorts/[cohortId]/live-sessions/[sessionId] — editar, archivar o restaurar.
 * SSOT: endpoints.md:80, plan/08 §5.
 */

import { z } from 'zod';
import { apiHandler } from '@/lib/http/api-handler';
import { getRequestContext } from '@/lib/authz/request-context';
import { routeParam, optionalText, blankToNull } from '@/lib/http/admin-input';
import { APIError } from '@/lib/core/errors';
import { updateLiveSession } from '@/features/cohorts/server/live-sessions.service';

const schema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  description: optionalText(2_000).optional(),
  startsAt: z.string().datetime({ offset: true }).optional(),
  endsAt: z.string().datetime({ offset: true }).optional(),
  url: z.string().trim().url().max(2_000).optional(),
  recordingId: z.string().cuid().nullable().optional(),
  archived: z.boolean().optional(),
});

type Input = z.infer<typeof schema>;

export const PATCH = apiHandler<Input>({ schema, capability: 'cohort.manage' })(async (
  _req,
  routeCtx,
  input
) => {
  const ctx = await getRequestContext();
  if (!ctx.person) throw new APIError('Authentication required', 'UNAUTHENTICATED');

  return updateLiveSession({
    institutionId: ctx.institution.id,
    actorId: ctx.person.id,
    cohortId: await routeParam(routeCtx.params, 'cohortId'),
    sessionId: await routeParam(routeCtx.params, 'sessionId'),
    input: {
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.description !== undefined ? { description: blankToNull(input.description) } : {}),
      ...(input.startsAt !== undefined ? { startsAt: new Date(input.startsAt) } : {}),
      ...(input.endsAt !== undefined ? { endsAt: new Date(input.endsAt) } : {}),
      ...(input.url !== undefined ? { url: input.url } : {}),
      ...(input.recordingId !== undefined ? { recordingId: input.recordingId } : {}),
    },
    archive: input.archived,
  });
});
