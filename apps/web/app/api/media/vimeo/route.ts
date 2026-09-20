/**
 * POST /api/media/vimeo — registra un video por id o URL.
 * SSOT: reference/02-api/endpoints.md:61, plan/07-contenido-y-migracion.md:46-50.
 *
 * Consulta duración y pistas de texto. `captionsSource` sale `AUTO` como mucho: `REVIEWED`
 * solo lo pone el autor tras verlos, porque publicar diciendo que unos subtítulos están
 * revisados cuando no lo están es justo lo que la validación de publicación evita.
 */

import { z } from 'zod';
import { apiHandler } from '@/lib/http/api-handler';
import { getRequestContext } from '@/lib/authz/request-context';
import { APIError } from '@/lib/core/errors';
import { registerVimeoVideo } from '@/features/content/server/media.service';

const schema = z.object({
  video: z.string().trim().min(1, 'Pega la dirección del video o su número'),
  /**
   * Opcional aquí y obligatoria para publicar: un video sin subtítulos revisados y sin
   * transcripción no pasa la validación. Se permite registrar primero y transcribir después.
   */
  transcript: z.string().max(200_000).optional(),
  /** Solo lo pone una persona que vio los subtítulos. Ver `registerVimeoVideo`. */
  captionsReviewed: z.boolean().optional(),
});

type Input = z.infer<typeof schema>;

export const POST = apiHandler<Input>({ schema, capability: 'lesson.author' })(async (
  _req,
  _ctx,
  input
) => {
  const ctx = await getRequestContext();
  if (!ctx.person) throw new APIError('Authentication required', 'UNAUTHENTICATED');

  return registerVimeoVideo({
    institutionId: ctx.institution.id,
    actorId: ctx.person.id,
    input: input.video,
    transcript: input.transcript,
    captionsReviewed: input.captionsReviewed,
  });
});
