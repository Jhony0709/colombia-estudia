/**
 * Vista previa de un borrador: el mismo render que verá el estudiante.
 * SSOT: plan/07-contenido-y-migracion.md:35 ("vista previa con el render real").
 *
 * "El render real" es literal: llama a `renderLessonHtml`, la misma función que usará el
 * player de la Fase 4. Una vista previa que renderizara por su cuenta sería una vista previa
 * de algo que no existe, y el autor descubriría la diferencia con el tema ya publicado.
 *
 * Las URLs de los assets se firman aquí y duran diez minutos: la vista previa es una foto,
 * no una página viva. Si el autor la deja abierta media hora, las imágenes dejarán de
 * cargar — y eso es correcto, porque significa que nadie puede sacar de aquí un enlace
 * permanente a un archivo del bucket privado.
 */

import 'server-only';

import { renderLessonHtml } from '@colombia-estudia/types';
import { createTenantClient } from '@/lib/db/tenant';
import { APIError } from '@/lib/core/errors';
import { parseLessonMarkdown } from '@colombia-estudia/types';
import { resolveRenderAssets } from './render-assets';

export interface PreviewResult {
  html: string;
  /** Assets citados que no se pudieron resolver: se enseñan aparte, no se esconden. */
  missingAssets: string[];
}

export async function previewDraft({
  institutionId,
  versionId,
}: {
  institutionId: string;
  versionId: string;
}): Promise<PreviewResult> {
  const db = createTenantClient(institutionId);

  const version = await db.lessonVersion.findFirst({
    where: { id: versionId },
    select: {
      content: true,
      lesson: { select: { language: true } },
    },
  });

  if (!version) throw new APIError('Lesson version not found', 'NOT_FOUND');

  const parsed = parseLessonMarkdown(version.content);
  const assetIds = [...new Set(parsed.assets.map((asset) => asset.id))];
  const assets = await resolveRenderAssets({ institutionId, assetIds });

  return {
    html: renderLessonHtml(version.content, assets, { language: version.lesson.language }),
    missingAssets: assetIds.filter((id) => !assets.has(id)),
  };
}
