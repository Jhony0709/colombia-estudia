import type { MetadataRoute } from 'next';
import { siteUrl } from '@/lib/seo/site-url';
import { SITE_PAGES } from '@/lib/seo/pages';

/** Portada, páginas de contenido (del registro) y registro. El login no se promociona. */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl();
  return [
    { url: `${base}/`, priority: 1 },
    ...SITE_PAGES.map((page) => ({
      url: `${base}${page.path}`,
      lastModified: page.lastReviewed,
      priority: 0.8,
    })),
    { url: `${base}/registro`, priority: 0.5 },
    { url: `${base}/politica-de-datos`, priority: 0.2 },
  ];
}
