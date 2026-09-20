/** @jest-environment node */
/**
 * Qué es de verdad un archivo.
 * SSOT: plan/04-seguridad.md:67 y su criterio de salida F3 (línea 113): "subida con magic
 * bytes probada con un SVG renombrado a `.png` (rechazado)".
 */

import { sniffFormat, verifyMagicBytes, HEADER_BYTES } from '@/lib/media/magic-bytes';

const bytes = (...parts: Array<number[] | string>): Uint8Array => {
  const out: number[] = [];
  for (const part of parts) {
    if (typeof part === 'string') out.push(...[...part].map((c) => c.charCodeAt(0)));
    else out.push(...part);
  }
  return new Uint8Array(out);
};

const PNG = bytes([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], [0, 0, 0, 13]);
const JPEG = bytes([0xff, 0xd8, 0xff, 0xe0], 'JFIF');
const WEBP = bytes('RIFF', [0x24, 0, 0, 0], 'WEBP');
const WAV = bytes('RIFF', [0x24, 0, 0, 0], 'WAVE');
const PDF = bytes('%PDF-1.7\n');
const MP3_ID3 = bytes('ID3', [3, 0, 0]);
const MP3_SYNC = bytes([0xff, 0xfb, 0x90, 0x00]);
const M4A = bytes([0, 0, 0, 0x20], 'ftypM4A ');
const OGG = bytes('OggS', [0, 2]);

describe('sniffFormat', () => {
  it.each([
    ['png', PNG],
    ['jpeg', JPEG],
    ['webp', WEBP],
    ['wav', WAV],
    ['pdf', PDF],
    ['mp3', MP3_ID3],
    ['mp3', MP3_SYNC],
    ['m4a', M4A],
    ['ogg', OGG],
  ])('reconoce %s', (expected, sample) => {
    expect(sniffFormat(sample)).toBe(expected);
  });

  it('distingue WEBP de WAV, que comparten la cabecera RIFF', () => {
    expect(sniffFormat(WEBP)).toBe('webp');
    expect(sniffFormat(WAV)).toBe('wav');
    expect(sniffFormat(bytes('RIFF', [0, 0, 0, 0], 'AVI '))).toBe('unknown');
  });

  it('reconoce un SVG aunque venga precedido de BOM, saltos o prólogo XML', () => {
    expect(sniffFormat(bytes('<svg xmlns="x"/>'))).toBe('svg');
    expect(sniffFormat(bytes('<?xml version="1.0"?>\n<svg xmlns="x"/>'))).toBe('svg');
    expect(sniffFormat(bytes([0xef, 0xbb, 0xbf], '\n\n   <svg xmlns="x"/>'))).toBe('svg');
    expect(sniffFormat(bytes('<SVG XMLNS="x"/>'))).toBe('svg');
  });

  it('no confunde con SVG un XML cualquiera', () => {
    expect(sniffFormat(bytes('<?xml version="1.0"?><rss><channel/></rss>'))).toBe('unknown');
  });
});

describe('verifyMagicBytes', () => {
  // El criterio de salida, literal.
  it('RECHAZA un SVG renombrado a .png y dice que es un SVG', () => {
    const svg = bytes('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');

    const result = verifyMagicBytes(svg, 'image/png');

    expect(result.ok).toBe(false);
    expect(result.actual).toBe('svg');
    expect(result.message).toContain('SVG');
  });

  it('rechaza HTML disfrazado de imagen', () => {
    const result = verifyMagicBytes(bytes('<!DOCTYPE html><html></html>'), 'image/png');

    expect(result.ok).toBe(false);
    expect(result.actual).toBe('html');
  });

  it.each([
    ['image/png', PNG],
    ['image/jpeg', JPEG],
    ['image/webp', WEBP],
    ['application/pdf', PDF],
    ['audio/mpeg', MP3_ID3],
    ['audio/mp4', M4A],
    ['audio/ogg', OGG],
    ['audio/wav', WAV],
  ])('acepta %s cuando el contenido lo es', (mime, sample) => {
    expect(verifyMagicBytes(sample, mime).ok).toBe(true);
  });

  it('rechaza cuando el contenido es de otro formato conocido, y nombra los dos', () => {
    const result = verifyMagicBytes(PDF, 'image/png');

    expect(result.ok).toBe(false);
    expect(result.message).toContain('image/png');
    expect(result.message).toContain('PDF');
  });

  it('rechaza bytes que no reconoce', () => {
    expect(verifyMagicBytes(bytes([0, 1, 2, 3, 4]), 'image/png').ok).toBe(false);
  });

  it('rechaza un MIME que no está en la tabla, aunque el contenido sea válido', () => {
    expect(verifyMagicBytes(PNG, 'image/svg+xml').ok).toBe(false);
  });

  it('no se cae con un archivo vacío', () => {
    expect(() => verifyMagicBytes(new Uint8Array(0), 'image/png')).not.toThrow();
    expect(verifyMagicBytes(new Uint8Array(0), 'image/png').ok).toBe(false);
  });

  it('64 bytes bastan: la firma más larga cabe de sobra', () => {
    expect(HEADER_BYTES).toBeGreaterThanOrEqual(12);
    expect(verifyMagicBytes(WEBP.slice(0, 12), 'image/webp').ok).toBe(true);
  });
});
