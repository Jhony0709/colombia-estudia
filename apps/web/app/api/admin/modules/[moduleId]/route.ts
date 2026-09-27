/**
 * PATCH /api/admin/modules/[moduleId] — renombrar, archivar o mover.
 * SSOT: plan/06-cohortes-y-personas.md:19-22 (orden por arrastre **y** botones subir/bajar;
 * reference/03-ui/accesibilidad.md:55 — el arrastre siempre lleva alternativa por teclado).
 * AMBIGUO: no estaba en reference/02-api/endpoints.md; añadido en §11b.
 */

import { z } from 'zod';
import { apiHandler } from '@/lib/http/api-handler';
import {
  blankToNull,
  optionalText,
  requireInstitutionId,
  routeParam,
} from '@/lib/http/admin-input';
import {
  renameModule,
  updateModule,
  archiveModule,
  moveModule,
  deleteModule,
} from '@/features/admin/server/curriculum.service';

const schema = z.discriminatedUnion('op', [
  z.object({
    op: z.literal('rename'),
    name: z.string().trim().min(1, 'El nombre es obligatorio').max(160),
  }),
  z.object({
    op: z.literal('update'),
    name: z.string().trim().min(1, 'El nombre es obligatorio').max(160),
    grade: z.number().int().min(0).max(13).nullable(),
    description: optionalText(2000).optional(),
    closingText: optionalText(4000).optional(),
    /** La imagen de la tarjeta (25/9): id de un `MediaAsset` IMAGE, `null` la quita, ausente no toca. */
    coverMediaId: z.string().cuid().nullable().optional(),
  }),
  z.object({ op: z.literal('archive') }),
  z.object({ op: z.literal('delete') }),
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
    case 'update':
      return updateModule({
        institutionId,
        actorId,
        moduleId,
        name: input.name.trim(),
        grade: input.grade,
        description: blankToNull(input.description ?? ''),
        closingText: blankToNull(input.closingText ?? ''),
        coverMediaId: input.coverMediaId,
      });
    case 'archive':
      return archiveModule({ institutionId, actorId, moduleId });
    case 'delete':
      return deleteModule({ institutionId, actorId, moduleId });
    case 'move':
      return moveModule({ institutionId, actorId, moduleId, direction: input.direction });
  }
});
