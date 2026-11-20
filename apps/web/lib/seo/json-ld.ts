/** Datos estructurados reutilizables (plan/13-seo.md, fase 0.4). Puros: se prueban sin render. */

export interface Crumb {
  name: string;
  path: string;
}

export function breadcrumbList(base: string, crumbs: Crumb[]) {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((crumb, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: crumb.name,
      item: `${base}${crumb.path}`,
    })),
  };
}

export function faqPage(items: Array<{ q: string; a: string }>) {
  return {
    '@type': 'FAQPage',
    mainEntity: items.map((item) => ({
      '@type': 'Question',
      name: item.q,
      acceptedAnswer: { '@type': 'Answer', text: item.a },
    })),
  };
}

export function webPage(
  base: string,
  page: { path: string; title: string; description: string; reviewed: string }
) {
  return {
    '@type': 'WebPage',
    '@id': `${base}${page.path}#pagina`,
    url: `${base}${page.path}`,
    name: page.title,
    description: page.description,
    inLanguage: 'es-CO',
    dateModified: page.reviewed,
    isPartOf: { '@id': `${base}/#sitio` },
    publisher: { '@id': `${base}/#organizacion` },
  };
}

/** El JSON de un `<script type="application/ld+json">`, con `<` escapado para que no lo cierre. */
export function serializeJsonLd(graph: object[]): string {
  return JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }).replace(
    /</g,
    '\\u003c'
  );
}
