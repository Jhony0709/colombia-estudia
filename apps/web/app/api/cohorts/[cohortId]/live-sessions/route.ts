/**
 * GET/POST /api/cohorts/[cohortId]/live-sessions — sesiones en vivo de una cohorte.
 * SSOT: endpoints.md:80, plan/08 §5.
 */

import { z } from 'zod';
import { apiHandler } from '@/lib/http/api-handler';
import { getRequestContext } from '@/lib/authz/request-context';
import { routeParam, optionalText, blankToNull } from '@/lib/http/admin-input';
import { APIError } from '@/lib/core/errors';
import {
  listLiveSessions,
  createLiveSession,
} from '@/features/cohorts/server/live-sessions.service';

const liveSessionSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: optionalText(2_000).optional(),
  startsAt: z.string().datetime({ offset: true }),
  endsAt: z.string().datetime({ offset: true }),
  url: z.string().trim().url().max(2_000),
  recordingId: z.string().cuid().nullable().optional(),
});

type Input = z.infer<typeof liveSessionSchema>;

export const GET = apiHandler({ capability: 'cohort.manage' })(async (_req, routeCtx) => {
  const ctx = await getRequestContext();
  return listLiveSessions({
    institutionId: ctx.institution.id,
    cohortId: await routeParam(routeCtx.params, 'cohortId'),
    includeArchived: true,
  });
});

export const POST = apiHandler<Input>({ schema: liveSessionSchema, capability: 'cohort.manage' })(
  async (_req, routeCtx, input) => {
    const ctx = await getRequestContext();
    if (!ctx.person) throw new APIError('Authentication required', 'UNAUTHENTICATED');

    return createLiveSession({
      institutionId: ctx.institution.id,
      actorId: ctx.person.id,
      cohortId: await routeParam(routeCtx.params, 'cohortId'),
      input: {
        title: input.title,
        description: input.description ? blankToNull(input.description) : null,
        startsAt: new Date(input.startsAt),
        endsAt: new Date(input.endsAt),
        url: input.url,
        recordingId: input.recordingId ?? null,
      },
    });
  }
);
