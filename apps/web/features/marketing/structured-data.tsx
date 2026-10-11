import { headers } from 'next/headers';
import { siteUrl } from '@/lib/seo/site-url';
import type { LandingInstitution } from './landing';

/** JSON-LD de la portada (SEO-08), solo con datos visibles en la página. */
export async function StructuredData({ institution }: { institution: LandingInstitution }) {
  const nonce = (await headers()).get('x-nonce') ?? undefined;
  const base = siteUrl();
  const data = {
    '@context': 'https://schema.org',
    '@graph': [
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
    ],
  };
  return (
    <script
      type="application/ld+json"
      nonce={nonce}
      // `<` escapado: el JSON no puede cerrar el `<script>`.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, '\\u003c') }}
    />
  );
}
