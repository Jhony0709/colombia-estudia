/**
 * Supabase Storage: rutas, URLs firmadas, cabecera del objeto y borrado.
 * SSOT: plan/04-seguridad.md:63-69 — "subida directa a Storage con URL firmada…, servir
 * siempre por URL firmada corta; nunca bucket público".
 *
 * El bucket es privado. Nada de aquí devuelve una URL pública, y la de lectura caduca en
 * diez minutos: un enlace filtrado en un chat deja de servir antes de que nadie lo reenvíe.
 *
 * `SUPABASE_SECRET_KEY` solo vive en este lado. Todo lo de este archivo es de servidor.
 */

import 'server-only';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { HEADER_BYTES } from './magic-bytes';

export const MEDIA_BUCKET = 'media';

/** Diez minutos, de `plan/04-seguridad.md:20`. */
export const READ_URL_SECONDS = 10 * 60;

/** La subida también caduca: una URL de escritura eterna es una puerta abierta. */
export const UPLOAD_URL_SECONDS = 10 * 60;

function admin(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;

  if (!url || !key) {
    throw new Error(
      'Falta NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SECRET_KEY: Storage no está configurado'
    );
  }

  return createClient(url, key, { auth: { persistSession: false } });
}

/**
 * `institutions/{id}/{kind}/{cuid}.{ext}` — de `plan/04-seguridad.md:65`.
 *
 * La institución va **primera** en la ruta a propósito: las políticas de Storage y
 * cualquier limpieza futura se escriben por prefijo, y un prefijo por institución es el
 * mismo aislamiento por tenant que hay en la base de datos.
 */
export function objectPath({
  institutionId,
  kind,
  id,
  extension,
}: {
  institutionId: string;
  kind: string;
  id: string;
  extension: string;
}): string {
  return `institutions/${institutionId}/${kind.toLowerCase()}/${id}.${extension}`;
}

/** ¿La ruta pertenece a esta institución? Cinturón para cualquier ruta que venga de fuera. */
export function pathBelongsTo(path: string, institutionId: string): boolean {
  return path.startsWith(`institutions/${institutionId}/`);
}

export async function checkStorageBucket(): Promise<'ok' | 'fail'> {
  try {
    const { error } = await admin().storage.from(MEDIA_BUCKET).list('', { limit: 1 });
    return error ? 'fail' : 'ok';
  } catch {
    return 'fail';
  }
}

/** URL firmada para que el navegador suba directo, sin pasar el archivo por nuestro servidor. */
export async function createUploadUrl(path: string): Promise<{ signedUrl: string; token: string }> {
  const { data, error } = await admin().storage.from(MEDIA_BUCKET).createSignedUploadUrl(path);

  if (error || !data) {
    throw new Error(`No se pudo crear la URL de subida: ${error?.message ?? 'sin datos'}`);
  }

  return { signedUrl: data.signedUrl, token: data.token };
}

/**
 * URL de lectura de diez minutos.
 *
 * `download` fuerza `Content-Disposition: attachment` (plan/04-seguridad.md:20): así el
 * navegador guarda el archivo en vez de renderizarlo, que es la otra mitad de la defensa
 * contra un archivo con contenido activo.
 */
export async function createReadUrl(
  path: string,
  { asAttachment = true, fileName }: { asAttachment?: boolean; fileName?: string } = {}
): Promise<string> {
  const { data, error } = await admin()
    .storage.from(MEDIA_BUCKET)
    .createSignedUrl(path, READ_URL_SECONDS, {
      ...(asAttachment ? { download: fileName ?? true } : {}),
    });

  if (error || !data) {
    throw new Error(`No se pudo crear la URL de lectura: ${error?.message ?? 'sin datos'}`);
  }

  return data.signedUrl;
}

export interface ObjectHead {
  bytes: Uint8Array;
  sizeBytes: number | null;
}

/**
 * Los primeros bytes del objeto, sin bajarlo entero.
 *
 * Una petición `Range` de 64 bytes, no una descarga: verificar un PDF de 50 MB no puede
 * costar 50 MB de tránsito. Si el servidor ignorase el `Range` y mandara el archivo
 * completo, los `slice` de abajo se quedan igualmente con la cabecera.
 */
export async function readObjectHead(path: string): Promise<ObjectHead> {
  const signedUrl = await createReadUrl(path, { asAttachment: false });

  const response = await fetch(signedUrl, {
    headers: { Range: `bytes=0-${HEADER_BYTES - 1}` },
  });

  if (!response.ok && response.status !== 206) {
    throw new Error(`No se pudo leer el objeto subido (HTTP ${response.status})`);
  }

  const buffer = await response.arrayBuffer();
  const bytes = new Uint8Array(buffer).slice(0, HEADER_BYTES);

  return { bytes, sizeBytes: await objectSize(path) };
}

/** El tamaño real que quedó en Storage, que es el que vale — no el que declaró el cliente. */
export async function objectSize(path: string): Promise<number | null> {
  try {
    const { data, error } = await admin().storage.from(MEDIA_BUCKET).info(path);
    if (error || !data) return null;
    return typeof data.size === 'number' ? data.size : null;
  } catch {
    return null;
  }
}

/** Borra el objeto. Se llama cuando el contenido no coincide con lo declarado. */
/**
 * Sube texto directamente desde el servidor, sin pasar por el navegador.
 *
 * Los archivos del autor suben con URL firmada (`createUploadUrl`) porque los elige en su
 * disco y no tienen por qué atravesar nuestro servidor. Una transcripción pegada en un
 * formulario ya está aquí: darle la vuelta —firmar una URL para que el navegador vuelva a
 * subir lo que acaba de mandar— serían dos viajes para nada.
 *
 * `upsert` a propósito: corregir una transcripción es reemplazarla, no acumular versiones de
 * un archivo que nadie versiona.
 */
export async function putText(path: string, text: string, contentType: string): Promise<void> {
  const { error } = await admin()
    .storage.from(MEDIA_BUCKET)
    .upload(path, new Blob([text], { type: contentType }), { contentType, upsert: true });

  if (error) {
    throw new Error(`No se pudo guardar el archivo en Storage: ${error.message}`);
  }
}

export async function removeObject(path: string): Promise<void> {
  const { error } = await admin().storage.from(MEDIA_BUCKET).remove([path]);
  if (error) {
    throw new Error(`No se pudo borrar el objeto: ${error.message}`);
  }
}

/**
 * Lee un objeto de texto entero (una transcripción WebVTT, una alternativa textual). Para
 * archivos pequeños: descarga en memoria, sin `Range`. Devuelve `null` si no existe.
 */
export async function readText(path: string): Promise<string | null> {
  const { data, error } = await admin().storage.from(MEDIA_BUCKET).download(path);
  if (error || !data) return null;
  return data.text();
}
