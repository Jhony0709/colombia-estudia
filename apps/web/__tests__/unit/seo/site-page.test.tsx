/** @jest-environment node */
/**
 * La plantilla de las páginas de contenido, con el copy real: un solo `h1`, la respuesta arriba,
 * los enlaces internos y los datos estructurados que salen en el HTML.
 */

import { renderToStaticMarkup } from 'react-dom/server';
import messages from '@/messages/es-CO.json';
import { SITE_PAGES } from '@/lib/seo/pages';

type Messages = Record<string, unknown>;
const read = (root: Messages, path: string) =>
  path.split('.').reduce<unknown>((node, part) => (node as Messages)?.[part], root);

jest.mock('@/lib/authz/request-context', () => ({
  getRequestContext: async () => ({
    person: null,
    institution: {
      name: 'ALBA Futuro Educativo',
      supportEmail: 'info@alba.test',
      supportPhone: '+57 301 000 0000',
      dataPolicyUrl: null,
    },
  }),
}));
jest.mock('next/headers', () => ({ headers: async () => ({ get: () => 'nonce-1' }) }));
jest.mock('next-intl/server', () => ({
  getTranslations: async (namespace: string) => {
    const root = read(jest.requireActual('@/messages/es-CO.json'), namespace) as Messages;
    const t = (key: string, values: Record<string, string> = {}) =>
      String(read(root, key)).replace(/\{(\w+)\}/g, (_, name: string) => values[name] ?? '');
    t.raw = (key: string) => read(root, key);
    return t;
  },
  getFormatter: async () => ({ dateTime: () => '19 de noviembre de 2026' }),
}));
jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));
jest.mock('@/app/fonts/site', () => ({ lexend: { variable: '' } }));
jest.mock('@/features/marketing/site.css', () => ({}), { virtual: true });
jest.mock('@/features/marketing/sections/site-header', () => ({ SiteHeader: () => null }));
jest.mock('@/features/marketing/sections/site-footer', () => ({ SiteFooter: () => null }));
jest.mock('@/features/marketing/sections/floating-contact', () => ({
  FloatingContact: () => null,
}));

import { fillCopy, SitePage, sitePageMetadata } from '@/features/marketing/site-page';

const copy = messages.sitePages as unknown as Record<string, { h1: string; lead: string }>;
// Lo que las páginas con datos de la plataforma (23/11) reciben en producción.
const VALUES: Record<string, Record<string, string | number | null>> = {
  precio: {
    modules: 10,
    modulePrice: '$90.000',
    stages: '$900.000',
    graduationFee: '$350.000',
    total: '$1.250.000',
    months: 6,
    certificatePrice: '$11.000',
    certificateBusinessDays: 3,
  },
  nosotros: {
    name: 'ALBA Futuro Educativo',
    legalName: null,
    taxId: null,
    supportEmail: 'info@alba.test',
    supportPhone: '+57 301 000 0000',
  },
};
const render = async (key: (typeof SITE_PAGES)[number]['key']) =>
  renderToStaticMarkup(await SitePage({ pageKey: key, values: VALUES[key] }));

describe.each(SITE_PAGES.map((page) => [page.key, page.path] as const))('%s', (key, path) => {
  it('un solo h1, la respuesta arriba y las dos acciones', async () => {
    const html = await render(key);
    expect(html.match(/<h1/g)).toHaveLength(1);
    expect(html.indexOf(copy[key]!.lead.slice(0, 30))).toBeLessThan(html.indexOf('<h2'));
    expect(html).toContain('https://wa.me/573010000000?text=');
    expect(html).toContain('href="/registro"');
    expect(html).toContain('Revisado el 19 de noviembre de 2026');
  });

  it('datos estructurados válidos, con migas hacia esta página', async () => {
    const html = await render(key);
    const json = /<script type="application\/ld\+json" nonce="nonce-1">(.*?)<\/script>/.exec(html);
    const graph = JSON.parse(json![1]!)['@graph'] as Array<Record<string, unknown>>;
    const crumbs = graph.find((node) => node['@type'] === 'BreadcrumbList') as {
      itemListElement: Array<{ item: string }>;
    };
    expect(crumbs.itemListElement.at(-1)!.item.endsWith(path)).toBe(true);
    expect(graph.some((node) => node['@type'] === 'WebPage')).toBe(true);
  });

  it('metadata con canónica propia', async () => {
    const meta = await sitePageMetadata(key, VALUES[key]);
    expect(meta.alternates).toEqual({ canonical: path });
    expect(String(meta.description).length).toBeGreaterThan(70);
  });
});

it('las preguntas visibles son las mismas que van en FAQPage', async () => {
  const html = await render('faq');
  const graph = JSON.parse(
    /<script type="application\/ld\+json" nonce="nonce-1">(.*?)<\/script>/.exec(html)![1]!
  )['@graph'] as Array<{ '@type': string; mainEntity?: Array<{ name: string }> }>;
  const faq = graph.find((node) => node['@type'] === 'FAQPage')!;
  expect(faq.mainEntity).toHaveLength(10);
  for (const question of faq.mainEntity!) expect(html).toContain(question.name);
});

it('contacto dice dónde está y a quién atiende', async () => {
  const html = await render('contacto');
  expect(html).toContain('mailto:info@alba.test');
  expect(html).toContain('"addressLocality":"Bogotá"');
});

it('precios: los valores de la plataforma, sin llaves sueltas', async () => {
  const html = await render('precio');
  expect(html).toContain('$1.250.000');
  expect(html).toContain('10 etapas');
  expect(html).not.toMatch(/\{\w+\}/);
});

it('quiénes somos: sin razón social ni NIT no muestra esas líneas', async () => {
  const html = await render('nosotros');
  expect(html).toContain('Marca: ALBA Futuro Educativo');
  expect(html).not.toContain('NIT:');
  const withNit = renderToStaticMarkup(
    await SitePage({ pageKey: 'nosotros', values: { ...VALUES.nosotros, taxId: '900.123.456-7' } })
  );
  expect(withNit).toContain('NIT: 900.123.456-7');
  expect(withNit).toContain('"taxID":"900.123.456-7"');
});

it('fillCopy quita el texto que nombra un dato que falta', () => {
  expect(fillCopy({ items: ['A: {a}', 'B: {b}', 'C'] }, { a: 1, b: '' })).toEqual({
    items: ['A: 1', 'C'],
  });
});
