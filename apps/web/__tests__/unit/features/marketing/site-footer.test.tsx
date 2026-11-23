/** @jest-environment node */
/**
 * El pie del sitio (23/11): cada enlace en su propio `<li>` y las páginas de contenido repartidas
 * en columnas. SSOT: features/marketing/sections/site-footer.tsx.
 */

import { renderToStaticMarkup } from 'react-dom/server';
import { SITE_PAGES } from '@/lib/seo/pages';

type Messages = Record<string, unknown>;
const read = (root: Messages, path: string) =>
  path.split('.').reduce<unknown>((node, part) => (node as Messages)?.[part], root);

jest.mock('next-intl/server', () => ({
  getTranslations: async (namespace: string) => {
    const root = read(jest.requireActual('@/messages/es-CO.json'), namespace) as Messages;
    return (key: string) => String(read(root, key));
  },
}));
jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));
jest.mock('@/features/marketing/brand/alba-logo', () => ({ AlbaLogo: () => null }));

import { GUIDES, SiteFooter } from '@/features/marketing/sections/site-footer';

const institution = {
  name: 'ALBA Futuro Educativo',
  supportEmail: 'info@alba.test',
  supportPhone: '+57 301 000 0000',
  dataPolicyUrl: null,
};

it('cada enlace va en su propio <li> y cada página de contenido sale una vez', async () => {
  const html = renderToStaticMarkup(await SiteFooter({ institution, signedIn: false }));
  for (const page of SITE_PAGES) {
    expect(html.match(new RegExp(`href="${page.path}"`, 'g'))).toHaveLength(1);
  }
  expect(html).not.toMatch(/<\/a><a /);
  expect(html).toContain('>Guías</h2>');
  expect(GUIDES).toEqual(['bogota', 'ciclos', 'validar', 'requisitos', 'faq']);
});
