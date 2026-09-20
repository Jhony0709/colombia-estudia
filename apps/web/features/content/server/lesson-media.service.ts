import 'server-only';

/**
 * Los medios que un tema referencia, con lo que hace falta para arreglarlos.
 * SSOT: plan/07-contenido-y-migracion.md:35, revisión de UX del 18/9.
 *
 * Existe porque faltaba una pantalla, no una regla. `video-needs-captions`
 * (`packages/domain/src/publish-validation.ts`) avisa de un video sin subtítulos revisados ni
 * transcripción —desde el 19/9 avisa, no bloquea (PRODUCT_DECISIONS.md)—, y hasta el 18/9 el
 * único escritor de esos dos campos era `registerVimeoVideo`: un video guardado con
 * `captionsSource: NONE` no se podía corregir desde ningún sitio.
 *
 * Los datos ya estaban en la página. `render-assets.ts:57-67` carga estas mismas filas para
 * pintar la vista previa, y `:27` construye la dirección de Vimeo a partir de `providerRef`.
 * Es decir: la pantalla que decía «no sé qué video es» estaba reproduciéndolo.
 */

import { parseLessonMarkdown } from '@colombia-estudia/types';
import { createTenantClient } from '@/lib/db/tenant';
import { APIError } from '@/lib/core/errors';

export interface LessonMediaItem {
  mediaAssetId: string;
  kind: string;
  provider: string;
  /** El id en Vimeo, o la ruta en el bucket. Lo que permite decir **cuál** es. */
  providerRef: string;
  durationSeconds: number | null;
  captionsSource: string;
  hasTranscript: boolean;
  /** Si este medio es hoy la razón por la que el tema no publica. */
  /** Sin subtítulos revisados ni transcripción. Desde el 19/9 avisa; no impide publicar. */
  missingCaptions: boolean;
}

/** Video y audio necesitan subtítulos revisados o transcripción; lo demás, no. */
const NEEDS_CAPTIONS = new Set(['VIDEO', 'AUDIO']);

export async function listLessonMedia({
  institutionId,
  versionId,
}: {
  institutionId: string;
  versionId: string;
}): Promise<LessonMediaItem[]> {
  const db = createTenantClient(institutionId);

  const version = await db.lessonVersion.findFirst({
    where: { id: versionId },
    select: { content: true },
  });

  if (!version) throw new APIError('Lesson version not found', 'NOT_FOUND');

  // Se lee lo GUARDADO, igual que la validación y la vista previa: así el panel habla del
  // mismo texto del que hablan los avisos.
  const ids = [...new Set(parseLessonMarkdown(version.content).assets.map((a) => a.id))];
  if (ids.length === 0) return [];

  const rows = await db.mediaAsset.findMany({
    where: { id: { in: ids }, archivedAt: null },
    select: {
      id: true,
      kind: true,
      provider: true,
      providerRef: true,
      durationSeconds: true,
      captionsSource: true,
      transcriptPath: true,
    },
  });

  // En el orden en que aparecen en el tema, no en el que los devuelva la base: quien mira
  // el panel está mirando también el texto.
  const byId = new Map(rows.map((row) => [row.id, row]));

  return ids.flatMap((id): LessonMediaItem[] => {
    const row = byId.get(id);
    if (!row) return [];

    const hasTranscript = row.transcriptPath !== null;

    return [
      {
        mediaAssetId: row.id,
        kind: row.kind,
        provider: row.provider,
        providerRef: row.providerRef,
        durationSeconds: row.durationSeconds,
        captionsSource: row.captionsSource,
        hasTranscript,
        missingCaptions:
          NEEDS_CAPTIONS.has(row.kind) && row.captionsSource !== 'REVIEWED' && !hasTranscript,
      },
    ];
  });
}
