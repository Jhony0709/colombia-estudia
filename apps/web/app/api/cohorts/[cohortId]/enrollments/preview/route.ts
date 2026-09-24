/**
 * POST /api/cohorts/[cohortId]/enrollments/preview — lo que pasaría al matricular, sin
 * matricular.
 * SSOT: reference/02-api/endpoints.md (Cohorts), revisión UX del 23/9 (pieza 5).
 *
 * `POST` y no `GET` aunque solo lee: el documento o el correo de la persona van en el
 * cuerpo, nunca en la URL (Ley 1581; una URL acaba en el historial y en los logs).
 */

import { z } from 'zod';
import { apiHandler } from '@/lib/http/api-handler';
import { requireInstitutionId, routeParam } from '@/lib/http/admin-input';
import { previewEnrollment } from '@/features/cohorts/server/enrollments.service';

const schema = z.object({
  personHandle: z.string().trim().min(1, 'Indica el documento o el correo de la persona'),
});

type Input = z.infer<typeof schema>;

export const POST = apiHandler<Input>({ schema, capability: 'cohort.manage' })(
  async (_req, ctx, input) =>
    previewEnrollment({
      institutionId: requireInstitutionId(ctx.institutionId),
      cohortId: await routeParam(ctx.params, 'cohortId'),
      personHandle: input.personHandle,
    })
);
