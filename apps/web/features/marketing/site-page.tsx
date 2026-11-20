/**
 * Una página de contenido del sitio público (plan/13-seo.md, fase 1): la respuesta arriba, las
 * secciones, las preguntas, las fuentes y las dos acciones de siempre. El copy vive en
 * `messages/es-CO.json` (`sitePages.<clave>`) y la ruta en `lib/seo/pages.ts`.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { headers } from 'next/headers';
import { getFormatter, getTranslations } from 'next-intl/server';
import { getRequestContext } from '@/lib/authz/request-context';
import { cn } from '@/lib/utils';
import { lexend } from '@/app/fonts/site';
import { siteUrl } from '@/lib/seo/site-url';
import { sitePage, type SitePageKey } from '@/lib/seo/pages';
import { pageMetadata } from '@/lib/seo/page-metadata';
import { breadcrumbList, faqPage, serializeJsonLd, webPage } from '@/lib/seo/json-ld';
import { primaryContact, whatsappUrl } from './contact-links';
import { CtaLink } from './cta-link';
import { SiteContainer } from './site-container';
import { SiteHeader } from './sections/site-header';
import { SiteFooter } from './sections/site-footer';
import { FloatingContact } from './sections/floating-contact';
import './site.css';

interface PageSection {
  id: string;
  title: string;
  paragraphs?: string[];
  items?: string[];
  table?: { caption: string; head: string[]; rows: string[][] };
  closing?: string[];
}

interface PageCopy {
  nav: string;
  meta: { title: string; description: string };
  eyebrow: string;
  h1: string;
  lead: string;
  whatsappMessage: string;
  sections: PageSection[];
  faq: Array<{ q: string; a: string }>;
  sources: Array<{ label: string; url: string }>;
  related: SitePageKey[];
}

const H2 = 'm-0 text-xl font-semibold text-[var(--site-navy)]';
const BODY = 'site-body m-0';

async function copyOf(key: SitePageKey) {
  const t = await getTranslations('sitePages');
  return { t, copy: t.raw(key) as PageCopy };
}

export async function sitePageMetadata(key: SitePageKey): Promise<Metadata> {
  const { copy } = await copyOf(key);
  return pageMetadata({ ...copy.meta, path: sitePage(key).path });
}

export async function SitePage({ pageKey }: { pageKey: SitePageKey }) {
  const [ctx, { t, copy }, format, nonce] = await Promise.all([
    getRequestContext(),
    copyOf(pageKey),
    getFormatter(),
    headers().then((h) => h.get('x-nonce') ?? undefined),
  ]);
  const { name, supportEmail, supportPhone, dataPolicyUrl } = ctx.institution;
  const institution = { name, supportEmail, supportPhone, dataPolicyUrl };
  const signedIn = ctx.person !== null;
  const page = sitePage(pageKey);
  const base = siteUrl();
  const contact = primaryContact(supportPhone, supportEmail, copy.whatsappMessage);
  const reviewed = format.dateTime(new Date(`${page.lastReviewed}T12:00:00Z`), {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });

  const jsonLd = serializeJsonLd([
    webPage(base, { path: page.path, ...copy.meta, reviewed: page.lastReviewed }),
    breadcrumbList(base, [
      { name: t('common.home'), path: '/' },
      { name: copy.nav, path: page.path },
    ]),
    ...(copy.faq.length > 0 ? [faqPage(copy.faq)] : []),
    // En contacto se dice dónde está y a quién atiende: ahí va en los datos estructurados.
    ...(pageKey === 'contacto'
      ? [
          {
            '@type': 'EducationalOrganization',
            '@id': `${base}/#organizacion`,
            name,
            url: `${base}/`,
            email: supportEmail,
            ...(supportPhone ? { telephone: supportPhone } : {}),
            address: { '@type': 'PostalAddress', addressLocality: 'Bogotá', addressCountry: 'CO' },
            areaServed: { '@type': 'Country', name: 'Colombia' },
          },
        ]
      : []),
  ]);

  const channels = [
    { label: t('common.contactWhatsapp'), value: supportPhone, href: whatsappUrl(supportPhone) },
    { label: t('common.contactEmail'), value: supportEmail, href: `mailto:${supportEmail}` },
    { label: t('common.contactWeb'), value: base.replace(/^https?:\/\//, ''), href: `${base}/` },
  ].filter((row) => row.value && row.href);

  return (
    <div className={cn('site theme-light-scope min-h-screen', lexend.variable)}>
      <SiteHeader signedIn={signedIn} />
      <main id="contenido" className="bg-[var(--site-bg)]">
        <SiteContainer className="max-w-[48rem] space-y-10 py-12 lg:py-16">
          <nav aria-label={t('common.breadcrumb')}>
            <ol className="site-small m-0 flex list-none flex-wrap gap-2 p-0">
              <li>
                <Link href="/" className="site-link">
                  {t('common.home')}
                </Link>
              </li>
              <li aria-hidden>›</li>
              <li aria-current="page">{copy.nav}</li>
            </ol>
          </nav>

          <header className="space-y-4">
            <p className="site-eyebrow m-0">{copy.eyebrow}</p>
            <h1 className="site-h1 m-0 text-balance">{copy.h1}</h1>
            <p className="site-lead m-0">{copy.lead}</p>
            <p className="site-small m-0">
              <time dateTime={page.lastReviewed}>
                {t('common.reviewed', { date: reviewed, name })}
              </time>
            </p>
          </header>

          {pageKey === 'contacto' && (
            <section aria-labelledby="canales-title" className="space-y-4">
              <h2 id="canales-title" className={H2}>
                {t('common.contactTitle')}
              </h2>
              <dl className="m-0 grid gap-x-6 gap-y-2 sm:grid-cols-[auto_1fr]">
                {channels.map((row) => (
                  <div key={row.label} className="contents">
                    <dt className="site-small m-0 font-semibold">{row.label}</dt>
                    <dd className={cn(BODY, 'break-words')}>
                      <a href={row.href ?? undefined} className="site-link">
                        {row.value}
                      </a>
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          )}

          {copy.sections.map((section) => (
            <section
              key={section.id}
              id={section.id}
              aria-labelledby={`${section.id}-title`}
              className="scroll-mt-24 space-y-4"
            >
              <h2 id={`${section.id}-title`} className={H2}>
                {section.title}
              </h2>
              {section.paragraphs?.map((text) => (
                <p key={text} className={BODY}>
                  {text}
                </p>
              ))}
              {section.items && (
                <ul className="m-0 list-disc space-y-2 pl-6">
                  {section.items.map((text) => (
                    <li key={text} className="site-body">
                      {text}
                    </li>
                  ))}
                </ul>
              )}
              {section.table && (
                <div className="overflow-x-auto">
                  <table className="site-body w-full border-collapse text-left">
                    <caption className="sr-only">{section.table.caption}</caption>
                    <thead>
                      <tr>
                        {section.table.head.map((cell) => (
                          <th
                            key={cell}
                            scope="col"
                            className="border-b border-[var(--site-line)] py-2 pr-4 font-semibold text-[var(--site-navy)]"
                          >
                            {cell}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {section.table.rows.map((row) => (
                        <tr key={row[0]}>
                          {row.map((cell, index) =>
                            index === 0 ? (
                              <th
                                key={cell}
                                scope="row"
                                className="border-b border-[var(--site-line)] py-2 pr-4 font-semibold"
                              >
                                {cell}
                              </th>
                            ) : (
                              <td
                                key={cell}
                                className="border-b border-[var(--site-line)] py-2 pr-4"
                              >
                                {cell}
                              </td>
                            )
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {section.closing?.map((text) => (
                <p key={text} className={BODY}>
                  {text}
                </p>
              ))}
            </section>
          ))}

          {copy.faq.length > 0 && (
            <section aria-labelledby="preguntas-title" className="space-y-6">
              {copy.sections.length > 0 && (
                <h2 id="preguntas-title" className={H2}>
                  {t('common.faqTitle')}
                </h2>
              )}
              {copy.faq.map((item) => (
                <div key={item.q} className="space-y-2">
                  {/* Sin secciones (la página de preguntas), cada pregunta es un `h2`. */}
                  {copy.sections.length > 0 ? (
                    <h3 className="m-0 text-lg font-semibold text-[var(--site-navy)]">{item.q}</h3>
                  ) : (
                    <h2 className={H2}>{item.q}</h2>
                  )}
                  <p className={BODY}>{item.a}</p>
                </div>
              ))}
            </section>
          )}

          <section
            aria-labelledby="accion-title"
            className="space-y-4 rounded-2xl border border-[var(--site-line)] bg-white p-6"
          >
            <h2 id="accion-title" className={H2}>
              {t('common.ctaTitle')}
            </h2>
            <p className={BODY}>{t('common.ctaBody')}</p>
            <div className="flex flex-wrap gap-3">
              <CtaLink contact={contact}>
                {contact.external ? t('common.whatsapp') : t('common.write')}
              </CtaLink>
              <CtaLink href={signedIn ? '/ingresar' : '/registro'} variant="secondary">
                {signedIn ? t('common.enter') : t('common.register')}
              </CtaLink>
            </div>
          </section>

          {copy.related.length > 0 && (
            <nav aria-labelledby="relacionadas-title" className="space-y-3">
              <h2 id="relacionadas-title" className={H2}>
                {t('common.related')}
              </h2>
              <ul className="m-0 list-none space-y-1 p-0">
                {copy.related.map((key) => (
                  <li key={key}>
                    <Link
                      href={sitePage(key).path}
                      className="site-link min-h-touch inline-flex items-center"
                    >
                      {(t.raw(key) as PageCopy).nav}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          )}

          {copy.sources.length > 0 && (
            <section aria-labelledby="fuentes-title" className="space-y-3">
              <h2 id="fuentes-title" className={H2}>
                {t('common.sources')}
              </h2>
              <ul className="m-0 list-disc space-y-1 pl-6">
                {copy.sources.map((source) => (
                  <li key={source.url} className="site-small">
                    <a href={source.url} target="_blank" rel="noreferrer" className="site-link">
                      {source.label}
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </SiteContainer>
      </main>
      <SiteFooter institution={institution} signedIn={signedIn} />
      <FloatingContact contact={contact} />
      <script
        type="application/ld+json"
        nonce={nonce}
        dangerouslySetInnerHTML={{ __html: jsonLd }}
      />
    </div>
  );
}
