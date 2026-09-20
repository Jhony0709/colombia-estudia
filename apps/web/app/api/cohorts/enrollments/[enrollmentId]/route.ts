/**
 * PATCH /api/cohorts/enrollments/[enrollmentId] — retirar o prorrogar.
 * SSOT: reference/02-api/endpoints.md:66, plan/06-cohortes-y-personas.md:72-77.
 *
 * La ruta es hermana de `/api/cohorts/[cohortId]`: Next resuelve el segmento estático
 * `enrollments` antes que el dinámico, así que no hay ambigüedad.
 */

import { z } from 'zod';
import { apiHandler } from '@/lib/http/api-handler';
import { requireInstitutionId, routeParam } from '@/lib/http/admin-input';
import {
  withdrawEnrollment,
  extendEnrollment,
} from '@/features/cohorts/server/enrollments.service';

const schema = z.discriminatedUnion('op', [
  z.object({
    op: z.literal('withdraw'),
    reason: z.string().trim().min(1, 'El motivo del retiro es obligatorio').max(500),
  }),
  z.object({
    op: z.literal('extend'),
    accessUntil: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Usa una fecha con formato AAAA-MM-DD'),
  }),
]);

type Input = z.infer<typeof schema>;

export const PATCH = apiHandler<Input>({ schema, capability: 'cohort.manage' })(async (
  _req,
  ctx,
  input
) => {
  const institutionId = requireInstitutionId(ctx.institutionId);
  const actorId = ctx.personId ?? null;
  const enrollmentId = await routeParam(ctx.params, 'enrollmentId');

  return input.op === 'withdraw'
    ? withdrawEnrollment({ institutionId, actorId, enrollmentId, reason: input.reason })
    : extendEnrollment({
        institutionId,
        actorId,
        enrollmentId,
        accessUntil: new Date(input.accessUntil),
      });
});
