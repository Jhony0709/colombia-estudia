import type { Metadata } from 'next';

/**
 * Metadata de una página pública (plan/13-seo.md, fase 0.3): título, descripción, canónica y
 * tarjetas sociales. El título pasa por la plantilla del layout, que le pone la marca.
 */
const OG_IMAGE = { url: '/opengraph-image.png', width: 1200, height: 630 };

export function pageMetadata({
  title,
  description,
  path,
}: {
  title: string;
  description: string;
  path: string;
}): Metadata {
  return {
    title,
    description,
    alternates: { canonical: path },
    // Al definir `openGraph` se pierde la imagen del layout (`app/opengraph-image.png`): va aquí.
    openGraph: { title, description, url: path, type: 'article', images: [OG_IMAGE] },
    twitter: { card: 'summary_large_image', title, description },
  };
}
