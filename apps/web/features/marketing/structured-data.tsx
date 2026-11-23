import { headers } from 'next/headers';
import { siteUrl } from '@/lib/seo/site-url';
import { getTranslations } from 'next-intl/server';
import { faqPage, serializeJsonLd } from '@/lib/seo/json-ld';
import type { LandingInstitution } from './landing';
import { FAQ_ITEMS, type LandingPrices } from './sections/faq';

/** JSON-LD de la portada (SEO-08), solo con datos visibles en la página. */
export async function StructuredData({
  institution,
  prices,
}: {
  institution: LandingInstitution;
  prices: LandingPrices;
}) {
  const nonce = (await headers()).get('x-nonce') ?? undefined;
  const base = siteUrl();
  const t = await getTranslations('landing');
  // Las mismas preguntas que se ven en la sección de la portada.
  const faq = FAQ_ITEMS.map((key) => ({
    q: t(`faq.items.${key}.q`),
    a: t(`faq.items.${key}.a`, { ...prices }),
  }));
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
