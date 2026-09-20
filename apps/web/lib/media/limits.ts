/**
 * Qué se puede subir, de qué tamaño, y con qué extensión acaba en Storage.
 * SSOT: plan/04-seguridad.md:63-69 y su tabla de amenazas (línea 20).
 *
 * Es una **allowlist**: lo que no está aquí no se sube. Una lista de prohibidos siempre
 * va por detrás del siguiente formato que a alguien se le ocurra.
 *
 * SVG no está y no va a estar: es un documento XML que ejecuta scripts, así que un SVG
 * servido desde nuestro dominio es XSS con otro nombre. La amenaza está nombrada en
 * `plan/04-seguridad.md:20` y aquí es donde se corta.
 */

export type UploadKind = 'IMAGE' | 'DOCUMENT' | 'AUDIO' | 'SUBMISSION';

/** Tamaños de `plan/04-seguridad.md:65-66`. */
export const MAX_BYTES: Record<UploadKind, number> = {
  IMAGE: 10 * 1024 * 1024,
  DOCUMENT: 50 * 1024 * 1024,
  AUDIO: 100 * 1024 * 1024,
  // Las entregas son de la Fase 4; el límite se fija aquí porque el límite es de
  // seguridad, no de la pantalla que lo use.
  SUBMISSION: 20 * 1024 * 1024,
};

/**
 * MIME permitidos por tipo, y la extensión con la que se guarda cada uno.
 *
 * La extensión sale de **esta tabla**, nunca del nombre del archivo que manda el cliente:
 * el nombre es dato del usuario y `factura.pdf.exe` es un nombre perfectamente válido.
 */
export const ALLOWED: Record<UploadKind, Record<string, string>> = {
  IMAGE: {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/webp': 'webp',
  },
  DOCUMENT: {
    'application/pdf': 'pdf',
  },
  AUDIO: {
    'audio/mpeg': 'mp3',
    'audio/mp4': 'm4a',
    'audio/ogg': 'ogg',
    'audio/wav': 'wav',
  },
  SUBMISSION: {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'application/pdf': 'pdf',
  },
};

/** El `MediaKind` del schema que corresponde a cada tipo de subida. */
export const MEDIA_KIND: Record<UploadKind, 'IMAGE' | 'DOCUMENT' | 'AUDIO'> = {
  IMAGE: 'IMAGE',
  DOCUMENT: 'DOCUMENT',
  AUDIO: 'AUDIO',
  // Una entrega es un documento a ojos del catálogo de medios.
  SUBMISSION: 'DOCUMENT',
};

export interface UploadCheck {
  ok: boolean;
  /** En español y con el arreglo dentro: lo lee quien está subiendo, no un desarrollador. */
  message?: string;
  extension?: string;
}

const megabytes = (bytes: number) => Math.round(bytes / (1024 * 1024));

/** ¿Se puede pedir una URL de subida para esto? */
export function checkUploadRequest(
  kind: UploadKind,
  mimeType: string,
  sizeBytes: number
): UploadCheck {
  const allowed = ALLOWED[kind];
  const extension = allowed[mimeType.toLowerCase()];

  if (!extension) {
    if (mimeType.toLowerCase() === 'image/svg+xml') {
      return {
        ok: false,
        message:
          'Los archivos SVG no se pueden subir porque pueden ejecutar código. Exporta la imagen como PNG o JPG.',
      };
    }
    return {
      ok: false,
      message: `Este tipo de archivo no se admite aquí. Se aceptan: ${Object.keys(allowed).join(', ')}.`,
    };
  }

  if (!Number.isInteger(sizeBytes) || sizeBytes <= 0) {
    return { ok: false, message: 'El tamaño del archivo no es válido.' };
  }

  const max = MAX_BYTES[kind];
  if (sizeBytes > max) {
    return {
      ok: false,
      message: `El archivo pesa ${megabytes(sizeBytes)} MB y el máximo son ${megabytes(max)} MB.`,
    };
  }

  return { ok: true, extension };
}
