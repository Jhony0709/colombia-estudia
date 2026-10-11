/** `/politica-de-datos` (Ley 1581, 11/10): responsable de la institución, texto en `dataPolicy`. */

import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { getRequestContext } from '@/lib/authz/request-context';
import { getInstitutionOverview } from '@/features/admin/server/institution.service';
import { siteUrl } from '@/lib/seo/site-url';
import { cn } from '@/lib/utils';
import { lexend } from '@/app/fonts/site';
import { whatsappUrl } from '@/features/marketing/contact-links';
import { SiteContainer } from '@/features/marketing/site-container';
import { SiteHeader } from '@/features/marketing/sections/site-header';
import { SiteFooter } from '@/features/marketing/sections/site-footer';
import '@/features/marketing/site.css';

interface PolicySection {
  id: string;
  title: string;
  paragraphs?: string[];
  items?: string[];
  closing?: string[];
}

interface CookieRow {
  name: string;
  purpose: string;
  duration: string;
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('dataPolicy');
  return {
    title: t('meta.title'),
    description: t('meta.description'),
    alternates: { canonical: '/politica-de-datos' },
  };
}

const H2 = 'm-0 text-xl font-semibold text-[var(--site-navy)]';
const BODY = 'site-body m-0';

export default async function DataPolicyPage() {
  const ctx = await getRequestContext();
  const [{ settings }, t] = await Promise.all([
    getInstitutionOverview(ctx.institution.id),
    getTranslations('dataPolicy'),
  ]);
  const sections = t.raw('sections') as PolicySection[];
  const cookies = t.raw('cookies.rows') as CookieRow[];
  // El domicilio no está en el schema: se declara en los mensajes cuando exista.
  const address = (t.raw('controller') as { addressValue?: string }).addressValue ?? null;
  const date = t('effectiveDate');
  const base = siteUrl();

  const controller = [
    { label: t('controller.brand'), value: settings.name },
    { label: t('controller.legalName'), value: settings.legalName },
    { label: t('controller.taxId'), value: settings.taxId },
    { label: t('controller.address'), value: address },
    {
      label: t('controller.email'),
      value: settings.supportEmail,
      href: `mailto:${settings.supportEmail}`,
    },
    {
      label: t('controller.phone'),
      value: settings.supportPhone,
      href: whatsappUrl(settings.supportPhone),
    },
    { label: t('controller.web'), value: base.replace(/^https?:\/\//, ''), href: `${base}/` },
  ].filter((row) => row.value);

  const toc = [
    { id: 'responsable', title: t('controller.title') },
    ...sections.map(({ id, title }) => ({ id, title })),
    { id: 'cookies', title: t('cookies.title') },
    { id: 'cambios', title: t('changes.title') },
    { id: 'vigencia', title: t('validity.title') },
  ];

  return (
    <div className={cn('site theme-light-scope min-h-screen', lexend.variable)}>
      <SiteHeader signedIn={ctx.person !== null} />
      <main id="contenido" className="bg-[var(--site-bg)]">
        <SiteContainer className="max-w-[48rem] space-y-10 py-12 lg:py-16">
          <header className="space-y-4">
            <p className="site-eyebrow m-0">{t('eyebrow')}</p>
            <h1 className="site-h1 m-0 text-balance">{t('title')}</h1>
            <p className="site-small m-0">
              {t('version', { version: settings.dataPolicyVersion, date })}
            </p>
            <p className="site-lead m-0">{t('intro')}</p>
          </header>

          <nav aria-labelledby="politica-indice">
            <h2 id="politica-indice" className={H2}>
              {t('tocLabel')}
            </h2>
            <ul className="m-0 mt-3 list-none space-y-1 p-0">
              {toc.map((item) => (
                <li key={item.id}>
                  <a
                    href={`#${item.id}`}
                    className="site-link min-h-touch inline-flex items-center"
                  >
                    {item.title}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <section
            id="responsable"
            aria-labelledby="responsable-title"
            className="scroll-mt-24 space-y-4"
          >
            <h2 id="responsable-title" className={H2}>
              {t('controller.title')}
            </h2>
            <p className={BODY}>{t('controller.lead')}</p>
            <dl className="m-0 grid gap-x-6 gap-y-2 sm:grid-cols-[auto_1fr]">
              {controller.map((row) => (
                <div key={row.label} className="contents">
                  <dt className="site-small m-0 font-semibold">{row.label}</dt>
                  <dd className={cn(BODY, 'break-words')}>
                    {row.href ? (
                      <a href={row.href} className="site-link">
                        {row.value}
                      </a>
                    ) : (
                      row.value
                    )}
                  </dd>
                </div>
              ))}
            </dl>
            <p className={BODY}>{t('controller.channels')}</p>
          </section>

          {sections.map((section) => (
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
              {section.closing?.map((text) => (
                <p key={text} className={BODY}>
                  {text}
                </p>
              ))}
            </section>
          ))}

          <section id="cookies" aria-labelledby="cookies-title" className="scroll-mt-24 space-y-4">
            <h2 id="cookies-title" className={H2}>
              {t('cookies.title')}
            </h2>
            <p className={BODY}>{t('cookies.lead')}</p>
            <div className="overflow-x-auto">
              <table className="site-body w-full border-collapse text-left">
                <caption className="sr-only">{t('cookies.caption')}</caption>
                <thead>
                  <tr className="border-b border-[var(--site-line)]">
                    <th scope="col" className="py-2 pr-4 font-semibold">
                      {t('cookies.name')}
                    </th>
                    <th scope="col" className="py-2 pr-4 font-semibold">
                      {t('cookies.purpose')}
                    </th>
                    <th scope="col" className="py-2 font-semibold">
                      {t('cookies.duration')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {cookies.map((row) => (
                    <tr key={row.name} className="border-b border-[var(--site-line)] align-top">
                      <th scope="row" className="py-2 pr-4 font-mono text-sm font-normal">
                        {row.name}
                      </th>
                      <td className="py-2 pr-4">{row.purpose}</td>
                      <td className="py-2">{row.duration}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className={BODY}>{t('cookies.local')}</p>
            <p className={BODY}>{t('cookies.video')}</p>
            <p className={BODY}>{t('cookies.control')}</p>
          </section>

          <section id="cambios" aria-labelledby="cambios-title" className="scroll-mt-24 space-y-4">
            <h2 id="cambios-title" className={H2}>
              {t('changes.title')}
            </h2>
            <p className={BODY}>{t('changes.body')}</p>
          </section>

          <section
            id="vigencia"
            aria-labelledby="vigencia-title"
            className="scroll-mt-24 space-y-4"
          >
            <h2 id="vigencia-title" className={H2}>
              {t('validity.title')}
            </h2>
            <p className={BODY}>{t('validity.body', { date })}</p>
          </section>
        </SiteContainer>
      </main>
      <SiteFooter
        institution={{
          name: ctx.institution.name,
          supportEmail: ctx.institution.supportEmail,
          supportPhone: ctx.institution.supportPhone,
          dataPolicyUrl: ctx.institution.dataPolicyUrl,
        }}
        signedIn={ctx.person !== null}
      />
    </div>
  );
}
