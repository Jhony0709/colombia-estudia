/**
 * PATCH /api/admin/modules/[moduleId] — renombrar, archivar o mover.
 * SSOT: plan/06-cohortes-y-personas.md:19-22 (orden por arrastre **y** botones subir/bajar;
 * reference/03-ui/accesibilidad.md:55 — el arrastre siempre lleva alternativa por teclado).
 * AMBIGUO: no estaba en reference/02-api/endpoints.md; añadido en §11b.
 */

import { z } from 'zod';
import { apiHandler } from '@/lib/http/api-handler';
import { requireInstitutionId, routeParam } from '@/lib/http/admin-input';
import {
  renameModule,
  archiveModule,
  moveModule,
} from '@/features/admin/server/curriculum.service';

const schema = z.discriminatedUnion('op', [
  z.object({
    op: z.literal('rename'),
    name: z.string().trim().min(1, 'El nombre es obligatorio').max(160),
  }),
  z.object({ op: z.literal('archive') }),
  z.object({ op: z.literal('move'), direction: z.enum(['up', 'down']) }),
]);

type Input = z.infer<typeof schema>;

export const PATCH = apiHandler<Input>({ schema, capability: 'institution.manage' })(async (
  _req,
  ctx,
  input
) => {
  const institutionId = requireInstitutionId(ctx.institutionId);
  const actorId = ctx.personId ?? null;
  const moduleId = await routeParam(ctx.params, 'moduleId');

  switch (input.op) {
    case 'rename':
      return renameModule({ institutionId, actorId, moduleId, name: input.name.trim() });
    case 'archive':
      return archiveModule({ institutionId, actorId, moduleId });
    case 'move':
      return moveModule({ institutionId, actorId, moduleId, direction: input.direction });
  }
});
