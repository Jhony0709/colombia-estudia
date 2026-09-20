/**
 * Qué es de verdad un archivo, según sus primeros bytes.
 * SSOT: plan/04-seguridad.md:67 ("`confirm` descarga la cabecera del objeto y verifica
 * magic bytes contra la extensión; lo que no coincide se borra y se audita") y el criterio
 * de salida F3 (línea 113): un SVG renombrado a `.png` es rechazado.
 *
 * Puro: bytes entran, veredicto sale. Sin red, sin base de datos, sin Supabase. Es la
 * pieza de seguridad de toda la subida, así que tiene que poder probarse en milisegundos
 * y con archivos inventados a mano.
 *
 * Primero **identifica** y luego compara, en ese orden y no al revés. Saber que el archivo
 * es un SVG permite decirlo ("esto es un SVG, no un PNG") en vez de soltar un "formato
 * inválido" que no le dice a nadie qué hacer.
 */

/** Lo que sabemos reconocer. `svg` y `html` están para poder **nombrarlos** al rechazarlos. */
export type SniffedFormat =
  | 'png'
  | 'jpeg'
  | 'webp'
  | 'gif'
  | 'pdf'
  | 'mp3'
  | 'm4a'
  | 'ogg'
  | 'wav'
  | 'svg'
  | 'html'
  | 'unknown';

/** 64 bytes alcanzan para todas las firmas de esta tabla, incluida la sonda de texto. */
export const HEADER_BYTES = 64;

const startsWith = (bytes: Uint8Array, signature: readonly number[], offset = 0): boolean => {
  if (bytes.length < offset + signature.length) return false;
  return signature.every((byte, index) => bytes[offset + index] === byte);
};

const ascii = (text: string): number[] => [...text].map((c) => c.charCodeAt(0));

/**
 * Los primeros bytes como texto, saltando BOM y espacios en blanco.
 *
 * Hace falta porque los formatos peligrosos son de texto y no tienen una firma fija: un
 * SVG puede empezar por `<?xml`, por `<svg`, por un comentario o por tres saltos de línea.
 */
function leadingText(bytes: Uint8Array): string {
  let start = 0;
  // BOM UTF-8
  if (startsWith(bytes, [0xef, 0xbb, 0xbf])) start = 3;

  let text = '';
  for (let i = start; i < bytes.length; i += 1) {
    const byte = bytes[i];
    if (byte === undefined) break;
    text += String.fromCharCode(byte);
  }

  return text.trimStart().toLowerCase();
}

/** Qué es este archivo, mirando solo su cabecera. */
export function sniffFormat(bytes: Uint8Array): SniffedFormat {
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'png';
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return 'jpeg';
  if (startsWith(bytes, ascii('GIF87a')) || startsWith(bytes, ascii('GIF89a'))) return 'gif';
  if (startsWith(bytes, ascii('%PDF-'))) return 'pdf';
  if (startsWith(bytes, ascii('OggS'))) return 'ogg';

  // RIFF sirve para WAV y para WEBP: los distingue el tipo en el byte 8.
  if (startsWith(bytes, ascii('RIFF'))) {
    if (startsWith(bytes, ascii('WEBP'), 8)) return 'webp';
    if (startsWith(bytes, ascii('WAVE'), 8)) return 'wav';
    return 'unknown';
  }

  // MP4 y derivados llevan `ftyp` en el byte 4, no al principio.
  if (startsWith(bytes, ascii('ftyp'), 4)) return 'm4a';

  // MP3: o etiqueta ID3, o el sincronismo de trama MPEG.
  if (startsWith(bytes, ascii('ID3'))) return 'mp3';
  const first = bytes[0];
  const second = bytes[1];
  if (first === 0xff && second !== undefined && (second & 0xe0) === 0xe0) return 'mp3';

  const text = leadingText(bytes);
  if (text.startsWith('<svg') || (text.startsWith('<?xml') && text.includes('<svg'))) {
    return 'svg';
  }
  if (text.startsWith('<!doctype html') || text.startsWith('<html')) return 'html';

  return 'unknown';
}

/** Qué formato real acepta cada MIME declarado. */
const EXPECTED: Record<string, readonly SniffedFormat[]> = {
  'image/png': ['png'],
  'image/jpeg': ['jpeg'],
  'image/webp': ['webp'],
  'image/gif': ['gif'],
  'application/pdf': ['pdf'],
  'audio/mpeg': ['mp3'],
  'audio/mp4': ['m4a'],
  'audio/ogg': ['ogg'],
  'audio/wav': ['wav'],
};

export interface VerifyResult {
  ok: boolean;
  /** Lo que el archivo es de verdad, aunque no coincida con lo declarado. */
  actual: SniffedFormat;
  /** En español, con el arreglo dentro. */
  message?: string;
}

/**
 * ¿El archivo es lo que dijo ser?
 *
 * Un `false` aquí significa borrar el objeto y auditarlo: alguien declaró una cosa y subió
 * otra, y eso no se distingue de un intento.
 */
export function verifyMagicBytes(bytes: Uint8Array, declaredMime: string): VerifyResult {
  const actual = sniffFormat(bytes);

  if (actual === 'svg') {
    return {
      ok: false,
      actual,
      message:
        'El contenido del archivo es un SVG, sea cual sea su extensión. Los SVG no se admiten porque pueden ejecutar código: exporta la imagen como PNG o JPG.',
    };
  }

  if (actual === 'html') {
    return {
      ok: false,
      actual,
      message: 'El contenido del archivo es HTML, no una imagen ni un documento.',
    };
  }

  const expected = EXPECTED[declaredMime.toLowerCase()];
  if (!expected) {
    return {
      ok: false,
      actual,
      message: 'Este tipo de archivo no se admite aquí.',
    };
  }

  if (!expected.includes(actual)) {
    return {
      ok: false,
      actual,
      message:
        actual === 'unknown'
          ? 'El contenido del archivo no corresponde a su extensión.'
          : `El archivo dice ser ${declaredMime} pero su contenido es ${actual.toUpperCase()}.`,
    };
  }

  return { ok: true, actual };
}
