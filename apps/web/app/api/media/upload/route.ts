/**
 * POST /api/media/upload — URL firmada de Storage; `MediaAsset PENDING`.
 * SSOT: reference/02-api/endpoints.md:59, plan/04-seguridad.md:63-69.
 *
 * Devuelve una URL para que el navegador suba **directo** a Storage. El archivo no pasa por
 * aquí: lo que pasa por aquí es la decisión de si se le deja sitio, y esa decisión se toma
 * sobre datos declarados. La comprobación de verdad es `confirm`.
 */

import { z } from 'zod';
import { apiHandler } from '@/lib/http/api-handler';
import { getRequestContext } from '@/lib/authz/request-context';
import { APIError } from '@/lib/core/errors';
import { requestUpload } from '@/features/content/server/media.service';

const schema = z.object({
  kind: z.enum(['IMAGE', 'DOCUMENT', 'AUDIO', 'SUBMISSION']),
  mimeType: z.string().min(1).max(128),
  sizeBytes: z.number().int().positive(),
});

type Input = z.infer<typeof schema>;

/**
 * La capacidad depende de qué se sube (19/9): un archivo de entrega lo sube el estudiante con
 * `lesson.progress.own`; todo lo demás es material del autor. Por eso el handler no fija una
 * capacidad y se comprueba aquí, con el mismo error que pondría `apiHandler`.
 */
const CAPABILITY: Record<Input['kind'], 'lesson.author' | 'lesson.progress.own'> = {
  IMAGE: 'lesson.author',
  DOCUMENT: 'lesson.author',
  AUDIO: 'lesson.author',
  SUBMISSION: 'lesson.progress.own',
};

export const POST = apiHandler<Input>({ schema })(async (_req, _ctx, input) => {
  const ctx = await getRequestContext();
  if (!ctx.person) throw new APIError('Authentication required', 'UNAUTHENTICATED');
  const needed = CAPABILITY[input.kind];
  if ((ctx.capabilities.get(needed)?.length ?? 0) === 0) {
    throw new APIError(`Missing capability: ${needed}`, 'INSUFFICIENT_CAPABILITY');
  }

  return requestUpload({
    institutionId: ctx.institution.id,
    actorId: ctx.person.id,
    kind: input.kind,
    mimeType: input.mimeType,
    sizeBytes: input.sizeBytes,
  });
});
