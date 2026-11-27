/** @jest-environment node */
/**
 * El archivo de un mensaje en la bandeja (27/11): audio con reproductor, foto que se abre en
 * grande, video y documento para descargar. SSOT: app/(staff)/mensajes/message-media.tsx.
 */

import { renderToStaticMarkup } from 'react-dom/server';

type Messages = Record<string, unknown>;
const read = (root: Messages, path: string) =>
  path.split('.').reduce<unknown>((node, part) => (node as Messages)?.[part], root);

jest.mock('next-intl/server', () => ({
  getTranslations: async (namespace: string) => {
    const root = read(jest.requireActual('@/messages/es-CO.json'), namespace) as Messages;
    return (key: string) => String(read(root, key));
  },
}));

import { MessageMedia } from '@/app/(staff)/mensajes/message-media';

const URL_A = '/api/conversations/conv-1/messages/m-1/media';
const html = async (type: string, name: string | null = null) =>
  renderToStaticMarkup(await MessageMedia({ media: { type, name, url: URL_A } }));

describe('MessageMedia', () => {
  it('un audio sale con reproductor, sin precargar', async () => {
    const out = await html('audio');
    expect(out).toContain(`<audio controls="" preload="none" src="${URL_A}"`);
    expect(out).toContain('Descargar el audio');
  });

  it('una foto o un sticker se ven y se abren en otra pestaña', async () => {
    for (const type of ['image', 'sticker']) {
      const out = await html(type);
      expect(out).toContain(`<img src="${URL_A}" alt="Foto que envió la persona"`);
      expect(out).toContain('target="_blank" rel="noopener noreferrer"');
    }
  });

  it('un video sale con reproductor', async () => {
    expect(await html('video')).toContain(`<video controls="" preload="metadata" src="${URL_A}"`);
  });

  it('un documento es un enlace con su nombre; sin nombre, «Documento»', async () => {
    expect(await html('document', 'cedula.pdf')).toMatch(
      /<a href="[^"]+media"[^>]*>.*cedula\.pdf<\/a>/
    );
    expect(await html('document')).toContain('Documento</a>');
  });
});
