/**
 * Contenido de una cohorte abierta (23/9).
 * GET  — lo publicado del programa que la cohorte todavía no tiene asignado.
 * POST — lo asigna: `{ items: [{ kind, id }] }`, o `{ items: [] }` para todo lo pendiente.
 *
 * Existe porque abrir congela el contenido y, hasta ahora, un tema publicado después de
 * abrir no tenía cómo llegar a la cohorte salvo a mano en la base.
 */

import { z } from 'zod';
import { apiHandler } from '@/lib/http/api-handler';
import { requireInstitutionId, routeParam } from '@/lib/http/admin-input';
import {
  assignPublishedContent,
  listPendingContentUpdates,
} from '@/features/cohorts/server/cohorts.service';

export const GET = apiHandler({ capability: 'cohort.manage' })(async (_req, ctx) =>
  listPendingContentUpdates({
    institutionId: requireInstitutionId(ctx.institutionId),
    cohortId: await routeParam(ctx.params, 'cohortId'),
  })
);

const schema = z.object({
  items: z
    .array(z.object({ kind: z.enum(['lesson', 'assessment']), id: z.string().cuid() }))
    .max(200),
});

type Input = z.infer<typeof schema>;

export const POST = apiHandler<Input>({ schema, capability: 'cohort.manage' })(
  async (_req, ctx, input) =>
    assignPublishedContent({
      institutionId: requireInstitutionId(ctx.institutionId),
      actorId: ctx.personId ?? null,
      cohortId: await routeParam(ctx.params, 'cohortId'),
      items: input.items,
    })
);
