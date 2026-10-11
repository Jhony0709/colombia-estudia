import type { MetadataRoute } from 'next';
import { siteUrl } from '@/lib/seo/site-url';

/** `/sitemap.xml` (SEO-01): las páginas indexables (D3, 11/10). Sin `lastModified` inventado. */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl();
  return ['/', '/registro', '/auth/login', '/politica-de-datos'].map((path) => ({
    url: `${base}${path}`,
  }));
}
