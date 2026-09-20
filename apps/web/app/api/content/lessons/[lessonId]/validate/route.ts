/**
 * POST /api/content/lessons/[lessonId]/validate — el panel de avisos del editor.
 * SSOT: plan/07-contenido-y-migracion.md:22-26 — "Es la misma función en el editor
 * (aviso en vivo, con debounce) y en `POST …/publish`".
 * AMBIGUO: el contrato no nombra esta ruta. Sin ella el editor tendría que reimplementar
 * la validación en el cliente, y entonces habría dos verdades. Registrada en endpoints.md.
 *
 * Valida lo que hay **guardado**, no lo que se manda: el autosave escribe cada cinco
 * segundos, así que validar el DRAFT guardado evita mandar el documento entero dos veces y
 * garantiza que el aviso habla del mismo texto que se publicaría.
 */

import { z } from 'zod';
import { apiHandler } from '@/lib/http/api-handler';
import { requireInstitutionId } from '@/lib/http/admin-input';
import { validateDraft } from '@/features/content/server/lessons.service';

const schema = z.object({ versionId: z.string().cuid() });

type Input = z.infer<typeof schema>;

export const POST = apiHandler<Input>({ schema, capability: 'lesson.author' })(
  async (_req, ctx, input) =>
    validateDraft({
      institutionId: requireInstitutionId(ctx.institutionId),
      versionId: input.versionId,
    })
);
