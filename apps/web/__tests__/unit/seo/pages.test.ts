/**
 * Páginas públicas de contenido (plan/13-seo.md, fase 0): el registro alimenta el sitemap y las
 * rutas públicas, cada página existe y tiene su copy, y los datos estructurados salen bien formados.
 */

import { existsSync } from 'node:fs';
import { join } from 'node:path';
import sitemap from '@/app/sitemap';
import { isProtected } from '@/lib/authz/routes';
import { SITE_PAGES, SITE_PAGE_PATHS, sitePage } from '@/lib/seo/pages';
import { breadcrumbList, faqPage, serializeJsonLd, webPage } from '@/lib/seo/json-ld';
import { pageMetadata } from '@/lib/seo/page-metadata';
import messages from '@/messages/es-CO.json';

const copy = messages.sitePages as unknown as Record<
  string,
  {
    nav: string;
    meta: { title: string; description: string };
    h1: string;
    lead: string;
    sections: Array<{ id: string; title: string }>;
    faq: Array<{ q: string; a: string }>;
    sources: Array<{ url: string }>;
    related: string[];
  }
>;

describe('registro de páginas', () => {
  it.each(SITE_PAGES.map((page) => [page.key, page.path]))(
    '%s (%s) es pública, existe y está en el sitemap',
    (key, path) => {
      expect(isProtected(path)).toBe(false);
      expect(existsSync(join(process.cwd(), 'app', path, 'page.tsx'))).toBe(true);
      expect(sitemap().some((entry) => entry.url.endsWith(path))).toBe(true);
      expect(sitePage(key).path).toBe(path);
    }
  );

  it('lo que no está en el registro sigue detrás del login', () => {
    expect(isProtected('/bachillerato-por-ciclos/otra')).toBe(true);
    expect(isProtected('/requisitos-internos')).toBe(true);
    expect(SITE_PAGE_PATHS).not.toContain('/aprender');
  });

  it('el sitemap no promociona el ingreso', () => {
    const urls = sitemap().map((entry) => entry.url);
    expect(urls.some((url) => url.includes('/auth/'))).toBe(false);
    expect(urls.filter((url) => url.endsWith('/'))).toHaveLength(1);
  });
});

describe('copy de cada página', () => {
  it.each(SITE_PAGES.map((page) => page.key))('%s: título, descripción y un solo tema', (key) => {
    const page = copy[key]!;
    expect(page.nav.length).toBeGreaterThan(0);
    expect(page.meta.title.length).toBeLessThanOrEqual(60);
    expect(page.meta.description.length).toBeGreaterThanOrEqual(70);
    expect(page.meta.description.length).toBeLessThanOrEqual(160);
    expect(page.h1.length).toBeGreaterThan(0);
    expect(page.lead.length).toBeGreaterThan(40);
    const ids = page.sections.map((section) => section.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const item of page.faq) {
      expect(item.q.trim().endsWith('?') || item.q.includes('¿')).toBe(true);
      expect(item.a.length).toBeGreaterThan(20);
    }
    for (const source of page.sources) expect(source.url.startsWith('https://')).toBe(true);
    for (const related of page.related) {
      expect(SITE_PAGES.some((other) => other.key === related && related !== key)).toBe(true);
    }
  });
});

describe('metadata y datos estructurados', () => {
  it('canónica propia y tarjeta social', () => {
    const meta = pageMetadata({ title: 'T', description: 'D', path: '/requisitos' });
    expect(meta.alternates).toEqual({ canonical: '/requisitos' });
    expect(meta.openGraph).toMatchObject({ url: '/requisitos', title: 'T' });
    // Con `openGraph` propio la imagen del layout se pierde: la página la repite (23/11).
    expect(meta.openGraph).toMatchObject({ images: [{ url: '/opengraph-image.png' }] });
  });

  it('migas, preguntas y página, con URL absolutas', () => {
    const crumbs = breadcrumbList('https://alba.test', [
      { name: 'Inicio', path: '/' },
      { name: 'Requisitos', path: '/requisitos' },
    ]);
    expect(crumbs.itemListElement[1]).toEqual({
      '@type': 'ListItem',
      position: 2,
      name: 'Requisitos',
      item: 'https://alba.test/requisitos',
    });
    expect(faqPage([{ q: '¿Sí?', a: 'Sí.' }]).mainEntity[0]).toMatchObject({
      name: '¿Sí?',
      acceptedAnswer: { text: 'Sí.' },
    });
    expect(
      webPage('https://alba.test', {
        path: '/requisitos',
        title: 'T',
        description: 'D',
        reviewed: '2026-11-19',
      })
    ).toMatchObject({ url: 'https://alba.test/requisitos', dateModified: '2026-11-19' });
  });

  it('el JSON no puede cerrar su `<script>`', () => {
    const json = serializeJsonLd([{ name: '</script><script>alert(1)' }]);
    expect(json).not.toContain('<');
    expect(JSON.parse(json)['@graph'][0].name).toBe('</script><script>alert(1)');
  });
});
