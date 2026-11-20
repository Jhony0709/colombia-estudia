import type { Metadata } from 'next';

/**
 * Metadata de una página pública (plan/13-seo.md, fase 0.3): título, descripción, canónica y
 * tarjetas sociales. El título pasa por la plantilla del layout, que le pone la marca.
 */
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
    openGraph: { title, description, url: path, type: 'article' },
    twitter: { card: 'summary_large_image', title, description },
  };
}
