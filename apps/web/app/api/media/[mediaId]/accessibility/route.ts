/**
 * PATCH /api/media/[mediaId]/accessibility — la transcripción de un medio ya registrado, o
 * la afirmación de que alguien vio sus subtítulos.
 * SSOT: packages/domain/src/publish-validation.ts:270-282, revisión de UX del 18/9.
 * Registrada en endpoints.md.
 *
 * Separada de `POST /api/media/vimeo` porque son dos cosas distintas: aquella registra un
 * video, esta arregla uno que ya está en un tema. Usarla para lo segundo obligaba a insertar
 * la directiva otra vez.
 */

import { z } from 'zod';
import { apiHandler } from '@/lib/http/api-handler';
import { getRequestContext } from '@/lib/authz/request-context';
import { routeParam } from '@/lib/http/admin-input';
import { APIError } from '@/lib/core/errors';
import { updateMediaAccessibility } from '@/features/content/server/media.service';

const schema = z.object({
  transcript: z.string().max(200_000).optional(),
  /** Solo lo pone una persona que vio los subtítulos. Ver `updateMediaAccessibility`. */
  captionsReviewed: z.boolean().optional(),
});

type Input = z.infer<typeof schema>;

export const PATCH = apiHandler<Input>({ schema, capability: 'lesson.author' })(async (
  _req,
  handlerCtx,
  input
) => {
  const ctx = await getRequestContext();
  if (!ctx.person) throw new APIError('Authentication required', 'UNAUTHENTICATED');

  return updateMediaAccessibility({
    institutionId: ctx.institution.id,
    mediaAssetId: await routeParam(handlerCtx.params, 'mediaId'),
    transcript: input.transcript,
    captionsReviewed: input.captionsReviewed,
  });
});
