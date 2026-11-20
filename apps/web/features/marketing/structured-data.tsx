import { headers } from 'next/headers';
import { siteUrl } from '@/lib/seo/site-url';
import { getTranslations } from 'next-intl/server';
import { faqPage, serializeJsonLd } from '@/lib/seo/json-ld';
import type { LandingInstitution } from './landing';

/** JSON-LD de la portada (SEO-08), solo con datos visibles en la página. */
export async function StructuredData({ institution }: { institution: LandingInstitution }) {
  const nonce = (await headers()).get('x-nonce') ?? undefined;
  const base = siteUrl();
  const t = await getTranslations('landing');
  // Las mismas preguntas que se ven en la sección de la portada.
  const faq = Object.values(t.raw('faq.items') as Record<string, { q: string; a: string }>);
  const graph = [
    {
      '@type': 'EducationalOrganization',
      '@id': `${base}/#organizacion`,
      name: institution.name,
      url: `${base}/`,
      logo: `${base}/brand/alba-logo-horizontal.png`,
      email: institution.supportEmail,
      ...(institution.supportPhone ? { telephone: institution.supportPhone } : {}),
    },
    {
      '@type': 'WebSite',
      '@id': `${base}/#sitio`,
      name: institution.name,
      url: `${base}/`,
      inLanguage: 'es-CO',
      publisher: { '@id': `${base}/#organizacion` },
    },
    faqPage(faq),
  ];
  return (
    <script
      type="application/ld+json"
      nonce={nonce}
      dangerouslySetInnerHTML={{ __html: serializeJsonLd(graph) }}
    />
  );
}
