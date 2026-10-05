/**
 * PUT /api/cohorts/enrollments/[enrollmentId]/modules/[moduleId] — habilitar, cambiar las
 * fechas o volver a bloquear un componente para una matrícula (`cohort.manage`). Audita y, al
 * habilitar, avisa al estudiante. SSOT: reference/02-api/endpoints.md (3/10).
 */

import { z } from 'zod';
import { apiHandler } from '@/lib/http/api-handler';
import { getRequestContext } from '@/lib/authz/request-context';
import { routeParam } from '@/lib/http/admin-input';
import { APIError } from '@/lib/core/errors';
import { setModuleAccess } from '@/features/cohorts/server/module-access.service';

const day = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Usa una fecha con formato AAAA-MM-DD')
  .nullable()
  .optional();

const schema = z.object({
  unlocked: z.boolean(),
  availableFrom: day,
  availableUntil: day,
});

type Input = z.infer<typeof schema>;

export const PUT = apiHandler<Input>({ schema, capability: 'cohort.manage' })(async (
  _req,
  routeCtx,
  input
) => {
  const ctx = await getRequestContext();
  if (!ctx.person) throw new APIError('Authentication required', 'UNAUTHENTICATED');

  return setModuleAccess({
    institutionId: ctx.institution.id,
    actorId: ctx.person.id,
    enrollmentId: await routeParam(routeCtx.params, 'enrollmentId'),
    moduleId: await routeParam(routeCtx.params, 'moduleId'),
    unlocked: input.unlocked,
    availableFrom: input.availableFrom ?? null,
    availableUntil: input.availableUntil ?? null,
  });
});
