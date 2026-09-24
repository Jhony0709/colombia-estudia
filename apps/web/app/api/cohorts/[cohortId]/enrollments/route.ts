/**
 * POST /api/cohorts/[cohortId]/enrollments — matricular a una persona.
 * SSOT: reference/02-api/endpoints.md:65 — "Calcula `isMinorAtEnrollment` y `accessUntil`;
 * exige `birthDate`".
 */

import { z } from 'zod';
import { apiHandler } from '@/lib/http/api-handler';
import { requireInstitutionId, routeParam } from '@/lib/http/admin-input';
import { enrollPerson } from '@/features/cohorts/server/enrollments.service';

const schema = z.object({
  personHandle: z.string().trim().min(1, 'Indica el documento o el correo de la persona'),
  /** Grado de entrada (20/9): posición del primer módulo de su ruta. Nulo = todo el programa. */
  startsAtModule: z.number().int().min(1).nullable().optional(),
});

type Input = z.infer<typeof schema>;

export const POST = apiHandler<Input>({ schema, capability: 'cohort.manage' })(
  async (_req, ctx, input) =>
    enrollPerson({
      institutionId: requireInstitutionId(ctx.institutionId),
      actorId: ctx.personId ?? null,
      cohortId: await routeParam(ctx.params, 'cohortId'),
      personHandle: input.personHandle,
      startsAtModule: input.startsAtModule ?? null,
    })
);
