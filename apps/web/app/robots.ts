import type { MetadataRoute } from 'next';
import { siteUrl } from '@/lib/seo/site-url';

/** Solo producción se rastrea; `/auth/*` no se bloquea para que su `noindex` se vea (SEO-01). */
export default function robots(): MetadataRoute.Robots {
  if (process.env.VERCEL_ENV !== 'production') {
    return { rules: { userAgent: '*', disallow: '/' } };
  }
  return {
    rules: { userAgent: '*', allow: '/', disallow: '/api/' },
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
