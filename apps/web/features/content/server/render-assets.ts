/**
 * De `MediaAsset` a lo que el render necesita: una URL utilizable y su alternativa.
 * SSOT: plan/07-contenido-y-migracion.md:35, plan/08-aprender-y-evaluar.md:22-28.
 *
 * Vive aparte porque tiene **dos** consumidores que no deben depender uno del otro: la vista
 * previa del autor (`preview.service.ts`) y el player del estudiante
 * (`features/learn/server/lesson.service.ts`). Estaba dentro de la vista previa, y dejarlo
 * ahí habría hecho que el player importara la vista previa, que es al revés de como se lee.
 *
 * Las URLs se firman aquí y duran diez minutos: lo que se sirve es una foto, no una página
 * viva. De aquí no sale un enlace permanente a un archivo del bucket privado.
 */

import 'server-only';

import type { RenderAsset } from '@colombia-estudia/types';
import { createTenantClient } from '@/lib/db/tenant';
import { createReadUrl } from '@/lib/media/storage';

/** La URL con la que se pinta cada asset, según de dónde venga. */
async function sourceFor(asset: {
  provider: string;
  providerRef: string;
  kind: string;
}): Promise<string | null> {
  if (asset.provider === 'VIMEO') {
    return `https://player.vimeo.com/video/${asset.providerRef}`;
  }

  if (asset.provider === 'STORAGE') {
    // Un documento se descarga; una imagen o un audio se muestran. `attachment` en una
    // imagen haría que el navegador la ofreciera como descarga en vez de pintarla.
    return createReadUrl(asset.providerRef, { asAttachment: asset.kind === 'DOCUMENT' });
  }

  // YOUTUBE y MUX están en el enum del schema pero no se usan (decisión: todo el video en
  // Vimeo). Un asset así no se pinta: el render lo dirá en vez de dejar un hueco.
  return null;
}

/**
 * Resuelve los assets que el Markdown referencia a lo que el render necesita.
 *
 * Solo los `READY`: un archivo subido pero sin confirmar no ha pasado la comprobación de
 * magic bytes, así que no se pinta ni siquiera en una vista previa.
 */
export async function resolveRenderAssets({
  institutionId,
  assetIds,
}: {
  institutionId: string;
  assetIds: string[];
}): Promise<Map<string, RenderAsset>> {
  if (assetIds.length === 0) return new Map();

  const db = createTenantClient(institutionId);
  const rows = await db.mediaAsset.findMany({
    where: { id: { in: assetIds }, status: 'READY', archivedAt: null },
    select: {
      id: true,
      kind: true,
      provider: true,
      providerRef: true,
      altText: true,
      transcriptPath: true,
    },
  });

  const resolved = new Map<string, RenderAsset>();

  for (const row of rows) {
    const src = await sourceFor(row);
    if (src === null) continue;

    resolved.set(row.id, {
      id: row.id,
      kind: row.kind,
      src,
      altText: row.altText,
      captionsSrc: null,
    });
  }

  return resolved;
}
