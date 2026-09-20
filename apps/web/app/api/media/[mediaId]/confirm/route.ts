/**
 * POST /api/media/[mediaId]/confirm — verifica el objeto subido y lo deja `READY`.
 * SSOT: reference/02-api/endpoints.md:60, plan/04-seguridad.md:67-68.
 *
 * Aquí es donde se mira el archivo de verdad: se leen sus primeros bytes y se comparan con
 * lo que dijo ser. Lo que no coincide se borra del bucket y se audita. Es el criterio de
 * salida F3 del plan de seguridad: un SVG renombrado a `.png` muere en esta ruta.
 */

import { z } from 'zod';
import { apiHandler } from '@/lib/http/api-handler';
import { getRequestContext } from '@/lib/authz/request-context';
import { routeParam, optionalText } from '@/lib/http/admin-input';
import { APIError } from '@/lib/core/errors';
import { confirmUpload } from '@/features/content/server/media.service';

const schema = z.object({
  /** Obligatorio para imágenes, pero eso lo exige la validación de publicación, no esto. */
  altText: optionalText(300),
});

type Input = z.infer<typeof schema>;

export const POST = apiHandler<Input>({ schema })(async (_req, handlerCtx, input) => {
  const ctx = await getRequestContext();
  if (!ctx.person) throw new APIError('Authentication required', 'UNAUTHENTICATED');
  // Autor o estudiante que entrega (19/9): al estudiante `confirmUpload` le exige además que
  // el asset lo haya subido él (`onlyOwn`).
  const isAuthor = (ctx.capabilities.get('lesson.author')?.length ?? 0) > 0;
  const isStudent = (ctx.capabilities.get('lesson.progress.own')?.length ?? 0) > 0;
  if (!isAuthor && !isStudent) {
    throw new APIError('Missing capability: lesson.author', 'INSUFFICIENT_CAPABILITY');
  }

  return confirmUpload({
    institutionId: ctx.institution.id,
    actorId: ctx.person.id,
    mediaAssetId: await routeParam(handlerCtx.params, 'mediaId'),
    altText: input.altText,
    onlyOwn: !isAuthor,
  });
});
