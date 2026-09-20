/**
 * Alta de medios: subida a Storage y registro de videos de Vimeo.
 * SSOT: reference/02-api/endpoints.md:59-61, plan/04-seguridad.md:63-69,
 * plan/07-contenido-y-migracion.md:46-50.
 *
 * El archivo **nunca pasa por nuestro servidor**: se pide una URL firmada, el navegador
 * sube directo a Storage, y después `confirm` comprueba qué quedó allí. Por eso `confirm`
 * no es un trámite: es el único momento en que alguien mira el contenido real del archivo.
 *
 * El `MediaAsset` nace `PENDING`. Si `confirm` no llega nunca, ahí se queda y no lo
 * referencia ninguna versión publicada: la validación de publicación exige `READY`.
 */

import 'server-only';

import { createTenantClient } from '@/lib/db/tenant';
import { APIError } from '@/lib/core/errors';
import { logger } from '@/lib/observability/logger';
import { checkUploadRequest, MEDIA_KIND, MAX_BYTES, type UploadKind } from '@/lib/media/limits';
import { verifyMagicBytes } from '@/lib/media/magic-bytes';
import {
  objectPath,
  createUploadUrl,
  readObjectHead,
  removeObject,
  pathBelongsTo,
  putText,
} from '@/lib/media/storage';
import {
  parseVimeoRef,
  getVimeoVideo,
  getVimeoTextTracks,
  captionsSourceFor,
} from '@/lib/media/vimeo';

export interface UploadTicket {
  mediaAssetId: string;
  path: string;
  signedUrl: string;
  token: string;
  maxBytes: number;
}

/**
 * Reserva el sitio y devuelve la URL firmada.
 *
 * El `mimeType` que llega es una declaración del cliente y se trata como tal: aquí decide
 * si **se permite pedir** la subida, y la extensión sale de nuestra tabla, nunca del nombre
 * del archivo. Quién es el archivo de verdad se averigua en `confirm`.
 */
export async function requestUpload({
  institutionId,
  actorId,
  kind,
  mimeType,
  sizeBytes,
}: {
  institutionId: string;
  actorId: string;
  kind: UploadKind;
  mimeType: string;
  sizeBytes: number;
}): Promise<UploadTicket> {
  const check = checkUploadRequest(kind, mimeType, sizeBytes);
  if (!check.ok || !check.extension) {
    throw new APIError(check.message ?? 'Archivo no admitido', 'VALIDATION_ERROR');
  }

  const db = createTenantClient(institutionId);

  const asset = await db.mediaAsset.create({
    data: {
      institutionId,
      kind: MEDIA_KIND[kind],
      provider: 'STORAGE',
      // Se rellena justo después con la ruta: el id lo pone la base y la ruta lo lleva
      // dentro, así que no se puede saber antes de crear la fila.
      providerRef: `pending:${Date.now()}:${Math.random().toString(36).slice(2)}`,
      status: 'PENDING',
      mimeType,
      uploadedById: actorId,
    },
    select: { id: true },
  });

  const path = objectPath({
    institutionId,
    kind: MEDIA_KIND[kind],
    id: asset.id,
    extension: check.extension,
  });

  await db.mediaAsset.update({ where: { id: asset.id }, data: { providerRef: path } });

  const { signedUrl, token } = await createUploadUrl(path);

  return {
    mediaAssetId: asset.id,
    path,
    signedUrl,
    token,
    maxBytes: MAX_BYTES[kind],
  };
}

export interface ConfirmResult {
  mediaAssetId: string;
  status: 'READY';
  sizeBytes: number | null;
}

/**
 * Comprueba lo que se subió de verdad y lo deja `READY`, o lo borra.
 *
 * Lo que no coincide **se borra y se audita** (plan/04-seguridad.md:67-68). Borrar no es
 * limpieza: un archivo que declaró ser una cosa y es otra no debe quedarse en el bucket
 * esperando a que alguien le dé una URL firmada.
 */
export async function confirmUpload({
  institutionId,
  actorId,
  mediaAssetId,
  altText,
  onlyOwn = false,
}: {
  institutionId: string;
  actorId: string;
  mediaAssetId: string;
  altText?: string | null;
  /** Un estudiante solo confirma lo que él subió (19/9): el `where` lleva `uploadedById`. */
  onlyOwn?: boolean;
}): Promise<ConfirmResult> {
  const db = createTenantClient(institutionId);

  const asset = await db.mediaAsset.findFirst({
    where: { id: mediaAssetId, ...(onlyOwn ? { uploadedById: actorId } : {}) },
    select: {
      id: true,
      kind: true,
      provider: true,
      providerRef: true,
      status: true,
      mimeType: true,
    },
  });

  if (!asset) throw new APIError('Media asset not found', 'NOT_FOUND');
  if (asset.provider !== 'STORAGE') {
    throw new APIError('Este medio no es una subida a Storage', 'VALIDATION_ERROR');
  }
  if (asset.status === 'READY') {
    throw new APIError('Este archivo ya estaba confirmado', 'CONFLICT');
  }
  // Cinturón: la ruta se compuso aquí, pero si alguna vez dejara de hacerlo, una ruta de
  // otra institución no puede ni leerse ni borrarse desde aquí.
  if (!pathBelongsTo(asset.providerRef, institutionId)) {
    throw new APIError(
      'La ruta del archivo no pertenece a la institución',
      'INSUFFICIENT_CAPABILITY'
    );
  }

  const head = await readObjectHead(asset.providerRef);
  const verdict = verifyMagicBytes(head.bytes, asset.mimeType ?? '');

  if (!verdict.ok) {
    await removeObject(asset.providerRef).catch((error: unknown) => {
      // Si el borrado falla, el rechazo sigue en pie y queda el rastro para limpiarlo.
      logger.error(
        { mediaAssetId, err: error instanceof Error ? error.message : String(error) },
        'no se pudo borrar un archivo rechazado'
      );
    });

    await db.$transaction(async (tx) => {
      await tx.mediaAsset.update({
        where: { id: mediaAssetId },
        data: { status: 'ERROR' },
      });
      await tx.auditLog.create({
        data: {
          institutionId,
          actorId,
          entity: 'media',
          entityId: mediaAssetId,
          action: 'rejected',
          after: {
            declaredMime: asset.mimeType,
            actualFormat: verdict.actual,
            path: asset.providerRef,
          },
        },
      });
    });

    throw new APIError(verdict.message ?? 'El archivo no es lo que dice ser', 'VALIDATION_ERROR');
  }

  await db.mediaAsset.update({
    where: { id: mediaAssetId },
    data: {
      status: 'READY',
      ...(head.sizeBytes !== null ? { sizeBytes: head.sizeBytes } : {}),
      ...(altText !== undefined ? { altText: altText === '' ? null : altText } : {}),
    },
  });

  return { mediaAssetId, status: 'READY', sizeBytes: head.sizeBytes };
}

export interface VimeoRegistration {
  mediaAssetId: string;
  durationSeconds: number;
  captionsSource: 'NONE' | 'AUTO' | 'REVIEWED';
  name: string;
  /**
   * `true` si lo que se pegó traía hash de privacidad, es decir, si el video está **no
   * listado**. Se devuelve y NO se guarda: `MediaAsset` no tiene dónde, y el contrato
   * (`reference/06-external-integrations/README.md:22-24`) dice que el embed se protege
   * restringiendo el dominio en Vimeo, no con el hash — es decir, da por hecho que el id
   * basta para reproducir. Si resulta que los videos de la institución sí son no listados,
   * ese supuesto no se sostiene y hace falta una columna. Decisión pendiente, registrada
   * en `docs/estado.md`; mientras tanto esto es lo que permite detectarlo en vez de
   * descubrirlo con el player en blanco.
   */
  unlisted: boolean;
}

/**
 * Registra un video de Vimeo por su id o su URL.
 *
 * Idempotente por `@@unique([institutionId, provider, providerRef])`: pegar dos veces el
 * mismo video actualiza el registro en vez de duplicarlo, porque duplicar aquí dejaría dos
 * `MediaAsset` para el mismo video y cada uno con sus subtítulos.
 */
/**
 * Guarda la transcripción como `.vtt` si ya lo es, y como `.txt` si es texto corrido.
 *
 * No se convierte texto a WebVTT: un VTT inventado a partir de un párrafo llevaría marcas de
 * tiempo falsas, y una transcripción sincronizada que miente sobre el segundo es peor que un
 * texto que no promete sincronía.
 */
async function storeTranscript({
  institutionId,
  mediaAssetId,
  text,
}: {
  institutionId: string;
  mediaAssetId: string;
  text: string;
}): Promise<string> {
  const isVtt = text.trimStart().toUpperCase().startsWith('WEBVTT');
  const path = objectPath({
    institutionId,
    kind: 'transcript',
    id: mediaAssetId,
    extension: isVtt ? 'vtt' : 'txt',
  });

  await putText(path, text, isVtt ? 'text/vtt; charset=utf-8' : 'text/plain; charset=utf-8');
  return path;
}

/**
 * Corrige la accesibilidad de un medio ya registrado: su transcripción, o la afirmación de
 * que alguien vio sus subtítulos.
 *
 * Hasta hoy esto solo se podía hacer al registrar el video (`registerVimeoVideo`), así que un
 * video guardado sin subtítulos comprobables quedaba impublicable para siempre: el validador
 * lo rechazaba y no había ninguna pantalla capaz de cambiar ninguno de los dos campos.
 *
 * `REVIEWED` no se quita desde aquí. Lo puso una persona que miró los subtítulos; un formulario
 * enviado sin marcar la casilla no es alguien diciendo que estaban mal, es alguien que vino a
 * pegar una transcripción.
 */
export async function updateMediaAccessibility({
  institutionId,
  mediaAssetId,
  transcript,
  captionsReviewed,
}: {
  institutionId: string;
  mediaAssetId: string;
  transcript?: string | null;
  captionsReviewed?: boolean;
}): Promise<{
  mediaAssetId: string;
  captionsSource: string;
  hasTranscript: boolean;
}> {
  const db = createTenantClient(institutionId);

  const asset = await db.mediaAsset.findFirst({
    where: { id: mediaAssetId, archivedAt: null },
    select: { id: true, captionsSource: true, transcriptPath: true },
  });

  if (!asset) throw new APIError('Media asset not found', 'NOT_FOUND');

  const text = transcript?.trim() ? transcript.trim() : null;
  const transcriptPath = text
    ? await storeTranscript({ institutionId, mediaAssetId: asset.id, text })
    : null;

  const captionsSource =
    captionsReviewed === true || asset.captionsSource === 'REVIEWED'
      ? 'REVIEWED'
      : asset.captionsSource;

  await db.mediaAsset.update({
    where: { id: asset.id },
    data: {
      captionsSource,
      // Sin texto nuevo se deja la que hubiera: abrir el panel y guardar no es pedir que se
      // borre una transcripción.
      ...(transcriptPath ? { transcriptPath } : {}),
    },
  });

  return {
    mediaAssetId: asset.id,
    captionsSource,
    hasTranscript: transcriptPath !== null || asset.transcriptPath !== null,
  };
}

export async function registerVimeoVideo({
  institutionId,
  actorId,
  input,
  transcript,
  captionsReviewed = false,
}: {
  institutionId: string;
  actorId: string;
  input: string;
  /**
   * La transcripción, escrita o pegada por el autor.
   *
   * Un video sin subtítulos revisados y sin transcripción **no publica** —esa regla se puso
   * el 18/9 al quitar la excepción de legado, y no se toca—. Pegar el texto es la forma más
   * corta de cumplirla cuando los subtítulos de Vimeo no se pueden verificar: el autor la
   * tiene, y el estudiante que no oye la necesita.
   */
  transcript?: string | null;
  /**
   * El autor afirma que vio los subtítulos del video y están bien.
   *
   * Es la única forma de que `captionsSource` llegue a `REVIEWED`, y es a propósito: la API
   * de Vimeo no distingue de forma fiable unos subtítulos automáticos de unos revisados, y
   * por oEmbed ni siquiera se ven. Quien lo afirma es una persona que miró, no una consulta.
   */
  captionsReviewed?: boolean;
}): Promise<VimeoRegistration> {
  const ref = parseVimeoRef(input);
  if (!ref) {
    throw new APIError(
      'No se reconoce ese video. Pega la dirección de Vimeo, el código de inserción o solo el número del video.',
      'VALIDATION_ERROR'
    );
  }

  const { id, hash } = ref;

  const video = await getVimeoVideo(id);
  if (!video) {
    throw new APIError(
      'Vimeo no encuentra ese video, o la cuenta no tiene acceso a él.',
      'NOT_FOUND'
    );
  }

  const tracks = await getVimeoTextTracks(id);
  const captionsSource = captionsReviewed ? 'REVIEWED' : captionsSourceFor(tracks);

  const db = createTenantClient(institutionId);

  const existing = await db.mediaAsset.findFirst({
    where: { provider: 'VIMEO', providerRef: id },
    select: { id: true, captionsSource: true },
  });

  const text = transcript?.trim() ? transcript.trim() : null;

  if (existing) {
    const transcriptPath = text
      ? await storeTranscript({ institutionId, mediaAssetId: existing.id, text })
      : null;

    await db.mediaAsset.update({
      where: { id: existing.id },
      data: {
        status: 'READY',
        durationSeconds: video.durationSeconds,
        // `REVIEWED` lo puso una persona mirando los subtítulos; una consulta a la API no
        // lo puede deshacer.
        ...(existing.captionsSource === 'REVIEWED' ? {} : { captionsSource }),
        // Sin texto nuevo se deja la que hubiera: registrar otra vez un video no es motivo
        // para borrar su transcripción.
        ...(transcriptPath ? { transcriptPath } : {}),
      },
    });

    return {
      mediaAssetId: existing.id,
      durationSeconds: video.durationSeconds,
      captionsSource,
      name: video.name,
      unlisted: hash !== null,
    };
  }

  const asset = await db.mediaAsset.create({
    data: {
      institutionId,
      kind: 'VIDEO',
      provider: 'VIMEO',
      providerRef: id,
      status: 'READY',
      durationSeconds: video.durationSeconds,
      captionsSource,
      uploadedById: actorId,
    },
    select: { id: true },
  });

  // Después de crear, porque la ruta del objeto lleva el id del asset: así una transcripción
  // suelta en Storage siempre se puede atribuir a su video.
  if (text) {
    const transcriptPath = await storeTranscript({
      institutionId,
      mediaAssetId: asset.id,
      text,
    });
    await db.mediaAsset.update({ where: { id: asset.id }, data: { transcriptPath } });
  }

  return {
    mediaAssetId: asset.id,
    durationSeconds: video.durationSeconds,
    captionsSource,
    name: video.name,
    unlisted: hash !== null,
  };
}
