/** @jest-environment node */
/**
 * Preguntas de la portada (23/11): el precio sale de la plataforma, igual en la página y en
 * FAQPage, y cada respuesta enlaza a su guía. SSOT: features/marketing/sections/faq.tsx.
 */

import { renderToStaticMarkup } from 'react-dom/server';

type Messages = Record<string, unknown>;
const read = (root: Messages, path: string) =>
  path.split('.').reduce<unknown>((node, part) => (node as Messages)?.[part], root);

jest.mock('next-intl/server', () => ({
  getTranslations: async (namespace: string) => {
    const root = read(jest.requireActual('@/messages/es-CO.json'), namespace) as Messages;
    const t = (key: string, values: Record<string, string> = {}) =>
      String(read(root, key)).replace(/\{(\w+)\}/g, (_, name: string) => values[name] ?? '');
    t.raw = (key: string) => read(root, key);
    return t;
  },
}));
jest.mock('next/headers', () => ({ headers: async () => ({ get: () => 'nonce-1' }) }));
jest.mock('@/features/marketing/sections/faq-item', () => ({
  FaqItem: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
jest.mock('@/features/marketing/motion/Reveal', () => ({
  Reveal: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

import { Faq } from '@/features/marketing/sections/faq';
import { StructuredData } from '@/features/marketing/structured-data';

const prices = { modulePrice: '$95.000', total: '$1.300.000' };
const contact = { href: 'https://wa.me/1', external: true, label: 'WhatsApp' };

it('el precio y los enlaces a las guías se ven en la respuesta', async () => {
  const html = renderToStaticMarkup(await Faq({ contact: contact as never, prices }));
  expect(html).toContain('etapas de $95.000');
  expect(html).toContain('cuesta $1.300.000');
  expect(html).toContain('href="/cuanto-cuesta-el-bachillerato"');
  expect(html).toContain('href="/bachillerato-por-ciclos"');
  expect(html).not.toMatch(/\{\w+\}/);
});

it('FAQPage dice lo mismo que la página', async () => {
  const institution = {
    name: 'ALBA',
    supportEmail: 'info@alba.test',
    supportPhone: null,
    dataPolicyUrl: null,
  };
  const html = renderToStaticMarkup(await StructuredData({ institution, prices }));
  expect(html).toContain('cuesta $1.300.000');
  expect(html).not.toMatch(/\{\w+\}/);
});
