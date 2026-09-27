'use client';

/**
 * Subir una imagen desde el navegador (27/9): la misma tubería para la portada del componente,
 * el bloque de imagen del editor y lo que se pega o se suelta en él.
 *
 * Pasos, como en GitHub y como manda `plan/04-seguridad.md`: validar tipo y tamaño en cliente
 * (error inmediato, sin pedir nada al servidor) → reescalar en un canvas (lado mayor ≤ 2000 px,
 * WebP 0.85: una captura Retina de 4 MB queda en ~200 KB, y el canvas suelta el EXIF con el
 * GPS de una foto del teléfono) → `POST /api/media/upload` (sitio y URL firmada) → PUT directo a
 * Storage → `POST /api/media/[id]/confirm`, que es quien comprueba los bytes. Lo que sale es el
 * `mediaAssetId`; el `alt` lo pone quien lo usa, porque es contenido, no archivo.
 */

import { useCallback, useState } from 'react';
import { apiErrorText } from '@/lib/http/api-error-text';

export const IMAGE_ACCEPT = 'image/png,image/jpeg,image/webp';
export const IMAGE_MAX_MB = 10;
const MAX_EDGE = 2000;

export type UploadError = 'type' | 'size' | 'upload';

export interface ImageUploadResult {
  mediaAssetId: string;
  /** Vista previa local (`blob:`); quien la usa la suelta con `URL.revokeObjectURL`. */
  previewUrl: string;
  /** Lo que se subió de verdad, ya reescalado. */
  bytes: number;
}

async function readJson(res: Response): Promise<unknown> {
  return res.json().catch(() => null);
}

/**
 * Reescala si hace falta. Si el navegador no puede (sin `createImageBitmap` o `toBlob`), se
 * sube el original: el servidor sigue validando tamaño y tipo.
 */
async function downscale(file: File): Promise<Blob> {
  if (typeof createImageBitmap !== 'function') return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.type === 'image/webp') return file;
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/webp', 0.85)
    );
    // Un PNG pequeño puede pesar menos que su WebP: se queda el más ligero.
    return blob && blob.size < file.size ? blob : file;
  } catch {
    return file;
  }
}

export function useImageUpload() {
  const [busy, setBusy] = useState(false);

  const upload = useCallback(
    async (
      file: File
    ): Promise<
      { ok: true; result: ImageUploadResult } | { ok: false; error: UploadError; message?: string }
    > => {
      if (!IMAGE_ACCEPT.split(',').includes(file.type)) return { ok: false, error: 'type' };
      if (file.size > IMAGE_MAX_MB * 1024 * 1024) return { ok: false, error: 'size' };

      setBusy(true);
      try {
        const blob = await downscale(file);
        const mimeType = blob.type || file.type;

        const ticketRes = await fetch('/api/media/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ kind: 'IMAGE', mimeType, sizeBytes: blob.size }),
        });
        const ticket = (await readJson(ticketRes)) as {
          data?: { mediaAssetId: string; signedUrl: string };
        } | null;
        if (!ticketRes.ok || !ticket?.data) {
          return { ok: false, error: 'upload', message: apiErrorText(ticket, '') || undefined };
        }

        const put = await fetch(ticket.data.signedUrl, {
          method: 'PUT',
          headers: { 'Content-Type': mimeType, 'x-upsert': 'false' },
          body: blob,
        });
        if (!put.ok) return { ok: false, error: 'upload' };

        const confirmRes = await fetch(`/api/media/${ticket.data.mediaAssetId}/confirm`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        });
        if (!confirmRes.ok) {
          return {
            ok: false,
            error: 'upload',
            message: apiErrorText(await readJson(confirmRes), '') || undefined,
          };
        }

        return {
          ok: true,
          result: {
            mediaAssetId: ticket.data.mediaAssetId,
            previewUrl: URL.createObjectURL(blob),
            bytes: blob.size,
          },
        };
      } catch {
        return { ok: false, error: 'upload' };
      } finally {
        setBusy(false);
      }
    },
    []
  );

  return { upload, busy };
}

/** Las imágenes de un portapapeles o de un arrastre; vacío si no hay ninguna. */
export function imageFilesFrom(data: DataTransfer | null): File[] {
  if (!data) return [];
  return Array.from(data.files).filter((file) => file.type.startsWith('image/'));
}
