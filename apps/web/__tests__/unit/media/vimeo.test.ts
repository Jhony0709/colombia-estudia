/** @jest-environment node */
/**
 * Lo puro del cliente de Vimeo.
 * SSOT: plan/07-contenido-y-migracion.md:46-50.
 */

import { parseVimeoId, parseVimeoRef, captionsSourceFor, pickTrack } from '@/lib/media/vimeo';
import type { VimeoTextTrack } from '@/lib/media/vimeo';

const track = (over: Partial<VimeoTextTrack> = {}): VimeoTextTrack => ({
  type: 'captions',
  language: 'es',
  name: 'Español',
  link: 'https://vimeo.test/track.vtt',
  active: true,
  ...over,
});

const IFRAME =
  '<iframe src="https://player.vimeo.com/video/123456789?h=abcdef0123&badge=0&autopause=0" ' +
  'width="640" height="360" frameborder="0" allow="autoplay; fullscreen" allowfullscreen></iframe>';

const IFRAME_RESPONSIVE =
  '<div style="padding:56.25% 0 0 0;position:relative;">' +
  '<iframe src="https://player.vimeo.com/video/123456789?h=abcdef0123" ' +
  'style="position:absolute;top:0;left:0;width:100%;height:100%;"></iframe></div>' +
  '<script src="https://player.vimeo.com/api/player.js"></script>';

describe('parseVimeoRef', () => {
  // Los autores no pegan ids: pegan lo que tienen a mano. Estas son las formas reales.
  it.each([
    ['el número suelto', '123456789'],
    ['la URL normal', 'https://vimeo.com/123456789'],
    ['la URL con ancla de tiempo', 'https://vimeo.com/123456789#t=30s'],
    ['la URL del PANEL de Vimeo', 'https://vimeo.com/manage/videos/123456789'],
    ['un video no listado, forma de ruta', 'https://vimeo.com/123456789/abcdef0123'],
    [
      'un video no listado, forma de player',
      'https://player.vimeo.com/video/123456789?h=abcdef0123',
    ],
    ['el iframe entero del botón Embed', IFRAME],
    ['el embed responsive con su <div> y su <script>', IFRAME_RESPONSIVE],
    ['una URL de canal', 'https://vimeo.com/channels/staffpicks/123456789'],
    ['una URL de grupo', 'https://vimeo.com/groups/motion/videos/123456789'],
    ['una URL de álbum', 'https://vimeo.com/album/12345/video/123456789'],
    ['una URL de ondemand', 'https://vimeo.com/ondemand/pelicula/123456789'],
    ['espacios alrededor', '  https://vimeo.com/123456789  '],
  ])('saca el id de %s', (_nombre, input) => {
    expect(parseVimeoRef(input)?.id).toBe('123456789');
  });

  // En `vimeo.com/album/12345/video/67890` hay dos números y el bueno es el segundo.
  it('no se queda con el id del álbum en vez del id del video', () => {
    expect(parseVimeoRef('https://vimeo.com/album/12345/video/123456789')?.id).toBe('123456789');
  });

  it('recoge el hash de un video no listado, venga como esté', () => {
    expect(parseVimeoRef('https://vimeo.com/123456789/abcdef0123')?.hash).toBe('abcdef0123');
    expect(parseVimeoRef('https://player.vimeo.com/video/123456789?h=abcdef0123')?.hash).toBe(
      'abcdef0123'
    );
    expect(parseVimeoRef(IFRAME)?.hash).toBe('abcdef0123');
  });

  it('un video público no tiene hash, y eso no es un error', () => {
    expect(parseVimeoRef('https://vimeo.com/123456789')?.hash).toBeNull();
    expect(parseVimeoRef('123456789')?.hash).toBeNull();
  });

  it.each(['', '   ', 'no soy una url', 'https://youtube.com/watch?v=abc'])(
    'devuelve null y no lanza con %p',
    (input) => {
      expect(parseVimeoRef(input)).toBeNull();
      expect(parseVimeoId(input)).toBeNull();
    }
  );
});

describe('captionsSourceFor', () => {
  it('sin pistas usables es NONE', () => {
    expect(captionsSourceFor([])).toBe('NONE');
    expect(captionsSourceFor([track({ link: '' })])).toBe('NONE');
    expect(captionsSourceFor([track({ type: 'metadata' })])).toBe('NONE');
  });

  it('con pistas es AUTO', () => {
    expect(captionsSourceFor([track()])).toBe('AUTO');
    expect(captionsSourceFor([track({ type: 'subtitles' })])).toBe('AUTO');
  });

  // La regla que sostiene la validación de publicación.
  it('NUNCA devuelve REVIEWED: eso solo lo pone una persona tras verlos', () => {
    const muchas = [track(), track({ type: 'subtitles' }), track({ active: false })];

    expect(captionsSourceFor(muchas)).not.toBe('REVIEWED');
    expect(['NONE', 'AUTO']).toContain(captionsSourceFor(muchas));
  });
});

describe('pickTrack', () => {
  it('prefiere el español', () => {
    const elegida = pickTrack([track({ language: 'en' }), track({ language: 'es-CO' })]);

    expect(elegida?.language).toBe('es-CO');
  });

  it('si no hay español coge la primera usable', () => {
    expect(pickTrack([track({ link: '' }), track({ language: 'en' })])?.language).toBe('en');
  });

  it('sin pistas usables devuelve null', () => {
    expect(pickTrack([])).toBeNull();
    expect(pickTrack([track({ link: '' })])).toBeNull();
  });
});
