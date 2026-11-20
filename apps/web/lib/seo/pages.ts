/**
 * Las páginas públicas de contenido (plan/13-seo.md, fase 0.2). De aquí salen el sitemap
 * (`app/sitemap.ts`) y la lista de rutas públicas (`lib/authz/routes.ts`): una página nueva que
 * no esté aquí queda detrás del login y fuera del sitemap. Sin dependencias: lo lee el middleware.
 */
export const SITE_PAGES = [
  { key: 'bogota', path: '/bachillerato-para-adultos-bogota', lastReviewed: '2026-11-19' },
  { key: 'ciclos', path: '/bachillerato-por-ciclos', lastReviewed: '2026-11-19' },
  { key: 'requisitos', path: '/requisitos', lastReviewed: '2026-11-19' },
  { key: 'faq', path: '/preguntas-frecuentes', lastReviewed: '2026-11-19' },
  { key: 'contacto', path: '/contacto', lastReviewed: '2026-11-19' },
] as const;

export type SitePageKey = (typeof SITE_PAGES)[number]['key'];

export const SITE_PAGE_PATHS: readonly string[] = SITE_PAGES.map((page) => page.path);

export function sitePage(key: SitePageKey) {
  return SITE_PAGES.find((page) => page.key === key)!;
}
