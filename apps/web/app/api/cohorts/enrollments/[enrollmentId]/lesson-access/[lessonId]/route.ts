/**
 * PUT /api/cohorts/enrollments/[enrollmentId]/lesson-access/[lessonId] — abrir o cerrar un tema para
 * una matrícula cerrada por defecto (`cohort.manage`, 24/11). Audita y, al abrir, avisa al
 * estudiante. SSOT: reference/02-api/endpoints.md.
 */

import { z } from 'zod';
import { apiHandler } from '@/lib/http/api-handler';
import { getRequestContext } from '@/lib/authz/request-context';
import { routeParam } from '@/lib/http/admin-input';
import { APIError } from '@/lib/core/errors';
import { setLessonAccess } from '@/features/cohorts/server/module-access.service';

const schema = z.object({ unlocked: z.boolean() });

type Input = z.infer<typeof schema>;

export const PUT = apiHandler<Input>({ schema, capability: 'cohort.manage' })(async (
  _req,
  routeCtx,
  input
) => {
  const ctx = await getRequestContext();
  if (!ctx.person) throw new APIError('Authentication required', 'UNAUTHENTICATED');

  return setLessonAccess({
    institutionId: ctx.institution.id,
    actorId: ctx.person.id,
    enrollmentId: await routeParam(routeCtx.params, 'enrollmentId'),
    lessonId: await routeParam(routeCtx.params, 'lessonId'),
    unlocked: input.unlocked,
  });
});
