/**
 * PATCH /api/cohorts/[cohortId] — abrir o cerrar.
 * SSOT: plan/06-cohortes-y-personas.md:26-30.
 *
 * Abrir congela el contenido: crea una asignación por tema y por evaluación, cada una atada a
 * la versión publicada en ese momento. Si falta alguna, responde 409 con la lista en
 * `error.details.missing` y no abre nada.
 * AMBIGUO: no estaba en reference/02-api/endpoints.md; añadido en §13.
 */

import { z } from 'zod';
import { apiHandler } from '@/lib/http/api-handler';
import { requireInstitutionId, routeParam } from '@/lib/http/admin-input';
import { openCohort, closeCohort } from '@/features/cohorts/server/cohorts.service';

const schema = z.object({ op: z.enum(['open', 'close']) });

type Input = z.infer<typeof schema>;

export const PATCH = apiHandler<Input>({ schema, capability: 'cohort.manage' })(async (
  _req,
  ctx,
  input
) => {
  const institutionId = requireInstitutionId(ctx.institutionId);
  const actorId = ctx.personId ?? null;
  const cohortId = await routeParam(ctx.params, 'cohortId');

  return input.op === 'open'
    ? openCohort({ institutionId, actorId, cohortId })
    : closeCohort({ institutionId, actorId, cohortId });
});
