/**
 * Cliente de Vimeo: metadatos y pistas de texto.
 * SSOT: plan/07-contenido-y-migracion.md:46-50 (§5).
 *
 * Los videos del programa actual ya viven en Vimeo y ahí se quedan (decisión del plan): no
 * se migran archivos, se registran ids. Lo que este archivo aporta es lo que la validación
 * de publicación necesita saber — cuánto dura y si tiene subtítulos.
 */

import 'server-only';

const API = 'https://api.vimeo.com';

/** Vimeo versiona por cabecera; sin esto la forma de la respuesta puede cambiar bajo los pies. */
const ACCEPT = 'application/vnd.vimeo.*+json;version=3.4';

export interface VimeoVideo {
  id: string;
  name: string;
  durationSeconds: number;
}

export interface VimeoTextTrack {
  /** `captions` o `subtitles`. */
  type: string;
  language: string;
  name: string;
  /** URL del VTT; caduca, así que se descarga en el momento y no se guarda. */
  link: string;
  active: boolean;
}

export interface VimeoRef {
  id: string;
  /**
   * El hash de privacidad de un video no listado, si venía en lo que se pegó.
   * Hoy no se guarda en ningún sitio: ver la nota de `registerVimeoVideo`.
   */
  hash: string | null;
}

/**
 * Lo que sea que pegue el autor, convertido en un id de video.
 *
 * Los autores no pegan un id: pegan lo que tienen a mano. Estas son las formas reales:
 *
 * - el número suelto;
 * - `vimeo.com/123456789`, con `#t=30s` o con parámetros detrás;
 * - `vimeo.com/manage/videos/123456789` — **la URL del panel de Vimeo**, que es la que
 *   sale al copiar desde "Mis videos", y por tanto la más probable de todas;
 * - `vimeo.com/123456789/abcdef0123` y `player.vimeo.com/video/123456789?h=abcdef0123`,
 *   las dos formas de un video no listado;
 * - el `<iframe>` entero del botón "Embed", con o sin el `<div>` responsive alrededor;
 * - las URL de canal, grupo, álbum y ondemand, que llevan el id al final.
 *
 * Devolver `null` es una respuesta, no un fallo: quien pega mal una URL merece un mensaje.
 */
export function parseVimeoRef(input: string): VimeoRef | null {
  const value = input.trim();
  if (value === '') return null;

  if (/^\d+$/.test(value)) return { id: value, hash: null };

  // Las rutas con segmento intermedio (manage, channels, groups, album, ondemand) van
  // primero: en `vimeo.com/album/12345/video/67890` el id bueno es el segundo número, y
  // un patrón más flojo se quedaría con el del álbum.
  const structured = value.match(
    /vimeo\.com\/(?:manage\/videos|channels\/[^/]+|groups\/[^/]+\/videos|album\/\d+\/video|ondemand\/[^/]+)\/(\d+)/i
  );
  const direct = value.match(/vimeo\.com\/(?:video\/)?(\d+)/i);

  const id = structured?.[1] ?? direct?.[1];
  if (!id) return null;

  // El hash viaja de dos maneras: como `?h=` en la URL del reproductor, o como segundo
  // segmento después del id en la URL normal.
  const query = value.match(/[?&]h=([0-9a-z]+)/i);
  const segment = new RegExp(`vimeo\\.com/(?:video/)?${id}/([0-9a-z]+)`, 'i').exec(value);

  return { id, hash: query?.[1] ?? segment?.[1] ?? null };
}

/** Solo el id. Se mantiene porque es lo que necesita casi todo el que llama. */
export function parseVimeoId(input: string): string | null {
  return parseVimeoRef(input)?.id ?? null;
}

/** `null` cuando no hay token configurado: no es un fallo, es otro camino. */
function token(): string | null {
  return process.env.VIMEO_ACCESS_TOKEN || null;
}

export const hasVimeoToken = (): boolean => token() !== null;

/**
 * Metadatos por oEmbed: público, sin credenciales, y suficiente para lo que se necesita.
 *
 * Es el camino cuando no hay `VIMEO_ACCESS_TOKEN`. Da título y duración de cualquier video
 * **público**; de uno privado o no listado no da nada, y eso es correcto —sin credenciales no
 * hay por qué poder leerlo—.
 *
 * Lo que oEmbed **no** da son las pistas de texto. Por eso, por este camino, `captionsSource`
 * sale siempre `NONE`: no saber si tiene subtítulos y suponer que sí es justo el error que la
 * validación de publicación existe para impedir.
 */
async function oembedVideo(id: string): Promise<VimeoVideo | null> {
  let response: Response;

  // Se distingue «Vimeo dice que no» de «no se pudo preguntar»: para quien está en la
  // pantalla son problemas distintos —uno se arregla cambiando la dirección, el otro no— y
  // devolver `null` para los dos deja a un autor peleándose con una URL correcta.
  try {
    response = await fetch(
      `https://vimeo.com/api/oembed.json?url=${encodeURIComponent(`https://vimeo.com/${id}`)}`,
      { cache: 'no-store' }
    );
  } catch (error) {
    throw new Error(
      `No se pudo consultar Vimeo: ${error instanceof Error ? error.message : 'error de red'}`
    );
  }

  // 403 y 404 son la respuesta de Vimeo a «ese video no es tuyo o no existe». Cualquier otro
  // código es un problema de Vimeo o nuestro, y se dice.
  if (response.status === 403 || response.status === 404) return null;
  if (!response.ok) {
    throw new Error(`Vimeo respondió ${response.status} al pedir los datos del video`);
  }

  const body = asRecord(await response.json());
  if (!body) return null;

  const duration = body.duration;

  return {
    id,
    name: typeof body.title === 'string' ? body.title : `Video ${id}`,
    durationSeconds: typeof duration === 'number' ? Math.round(duration) : 0,
  };
}

async function vimeoFetch(path: string): Promise<unknown> {
  const bearer = token();
  if (!bearer) return null;

  const response = await fetch(`${API}${path}`, {
    headers: { Authorization: `bearer ${bearer}`, Accept: ACCEPT },
    // Los metadatos de un video cambian poco, pero no queremos servir una caché nuestra
    // cuando el autor acaba de subir los subtítulos y vuelve a intentarlo.
    cache: 'no-store',
  });

  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new Error(`Vimeo respondió ${response.status} en ${path}`);
  }

  return response.json();
}

const asRecord = (value: unknown): Record<string, unknown> | null =>
  typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null;

/**
 * Metadatos del video. `null` si Vimeo no lo conoce o el token no lo alcanza.
 *
 * Sin token cae a oEmbed, que solo ve los videos públicos. Antes lanzaba, y el registro de un
 * video devolvía un 500 sin explicación: para un entorno sin credenciales de Vimeo, «no se
 * puede» era la única respuesta posible aunque el video fuera público.
 */
export async function getVimeoVideo(id: string): Promise<VimeoVideo | null> {
  if (!hasVimeoToken()) return oembedVideo(id);

  const body = asRecord(await vimeoFetch(`/videos/${id}`));
  if (!body) return null;

  const duration = body.duration;

  return {
    id,
    name: typeof body.name === 'string' ? body.name : `Video ${id}`,
    durationSeconds: typeof duration === 'number' ? Math.round(duration) : 0,
  };
}

/**
 * Las pistas de texto del video. Lista vacía si no tiene **o si no se pueden consultar**:
 * oEmbed no las expone, así que sin token la respuesta honesta es «no sé», que aquí se
 * traduce en `NONE` y en que el tema no publique sin transcripción.
 */
export async function getVimeoTextTracks(id: string): Promise<VimeoTextTrack[]> {
  const body = asRecord(await vimeoFetch(`/videos/${id}/texttracks`));
  const data = body?.data;
  if (!Array.isArray(data)) return [];

  return data.flatMap((entry): VimeoTextTrack[] => {
    const track = asRecord(entry);
    if (!track) return [];

    return [
      {
        type: typeof track.type === 'string' ? track.type : '',
        language: typeof track.language === 'string' ? track.language : '',
        name: typeof track.name === 'string' ? track.name : '',
        link: typeof track.link === 'string' ? track.link : '',
        active: track.active === true,
      },
    ];
  });
}

/**
 * Qué `captionsSource` corresponde a estas pistas.
 *
 * **Nunca devuelve `REVIEWED`**, y es deliberado. La API de Vimeo no distingue de forma
 * fiable una pista generada automáticamente de una que alguien escribió y revisó, y
 * equivocarse hacia `REVIEWED` significa publicar un tema diciendo que sus subtítulos
 * están revisados cuando no lo están — que es exactamente la barrera que la validación de
 * publicación existe para levantar. `REVIEWED` solo lo pone el autor, a mano, tras verlos
 * (plan/07:48).
 */
export function captionsSourceFor(tracks: VimeoTextTrack[]): 'NONE' | 'AUTO' {
  const usable = tracks.filter(
    (track) => track.link !== '' && (track.type === 'captions' || track.type === 'subtitles')
  );

  return usable.length > 0 ? 'AUTO' : 'NONE';
}

/** La pista en español, o la primera que haya. */
export function pickTrack(tracks: VimeoTextTrack[]): VimeoTextTrack | null {
  const usable = tracks.filter((track) => track.link !== '');
  const spanish = usable.find((track) => track.language.toLowerCase().startsWith('es'));

  return spanish ?? usable[0] ?? null;
}

/** Descarga el VTT de una pista. `null` si no se puede: no es motivo para fallar el registro. */
export async function downloadTrack(track: VimeoTextTrack): Promise<string | null> {
  try {
    const response = await fetch(track.link, { cache: 'no-store' });
    if (!response.ok) return null;

    const text = await response.text();
    return text.trimStart().startsWith('WEBVTT') ? text : null;
  } catch {
    return null;
  }
}
