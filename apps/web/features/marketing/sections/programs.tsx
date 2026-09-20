import { getTranslations } from 'next-intl/server';
import { ArrowRight, Check, Clock3 } from 'lucide-react';
import { SiteContainer } from '../site-container';
import { MediaPlaceholder } from '../media-placeholder';
import { Underline } from '../brand-shapes';
import { CtaLink } from '../cta-link';
import { PROGRAMS } from '../content';
import type { ContactLink } from '../contact-links';

const INCLUDES = ['modules', 'tutor', 'pace', 'diploma'] as const;

/**
 * "Aprende lo que te impulsa". Con un solo programa, una tarjeta destacada —foto 16:9 arriba
 * y texto debajo, en filas como en el teléfono (Jhonny, 19/9)— y al lado "Lo que incluye":
 * una rejilla de cuatro con una tarjeta se veía vacía. Con dos o más, la rejilla compacta.
 */
export async function Programs({ contact }: { contact: ContactLink }) {
  const t = await getTranslations('landing.programs');
  const single = PROGRAMS.length === 1;
  return (
    <section
      id="programas"
      aria-labelledby="programas-title"
      className="scroll-mt-20 py-20 lg:py-24"
    >
      <SiteContainer>
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div className="max-w-[40rem] space-y-3">
            <h2 id="programas-title" className="site-h2">
              {t('title')}
            </h2>
            <Underline />
            <p className="site-lead">{t('lead')}</p>
          </div>
          <a
            href={contact.href}
            target={contact.external ? '_blank' : undefined}
            rel={contact.external ? 'noreferrer' : undefined}
            className="site-link min-h-touch inline-flex items-center gap-1"
          >
            {t('link')}
            <ArrowRight aria-hidden="true" className="size-4" />
          </a>
        </div>

        <div
          className={single ? 'site-stagger mt-10 grid gap-6 lg:grid-cols-[1.7fr_1fr]' : 'mt-10'}
        >
          <ul
            className={
              single
                ? 'm-0 list-none p-0'
                : 'site-stagger m-0 grid list-none gap-6 p-0 sm:grid-cols-2 lg:grid-cols-4'
            }
          >
            {PROGRAMS.map((p) => (
              <li
                key={p.key}
                className={
                  single
                    ? 'site-card site-card--hover overflow-hidden'
                    : 'site-card site-card--hover overflow-hidden'
                }
              >
                <MediaPlaceholder
                  id={p.media}
                  rounded="none"
                  sizes={
                    single
                      ? '(min-width: 1024px) 60vw, 100vw'
                      : '(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw'
                  }
                />
                <div className={single ? 'flex flex-col gap-3 p-6 sm:p-7' : 'space-y-2 p-5'}>
                  <p className="site-eyebrow m-0">{t('category')}</p>
                  <h3 className={single ? 'site-h2 !text-[1.75rem]' : 'site-h3'}>
                    {t(`items.${p.key}.name`)}
                  </h3>
                  <p className={single ? 'site-body m-0' : 'site-small m-0'}>
                    {t(`items.${p.key}.description`)}
                  </p>
                  <p className="site-small m-0 flex items-center gap-1.5 pt-1">
                    <Clock3 aria-hidden="true" className="size-4 shrink-0" />
                    {t(`items.${p.key}.meta`)}
                  </p>
                  {single && (
                    <CtaLink contact={contact} className="mt-3 self-start">
                      {t('askCta')}
                    </CtaLink>
                  )}
                </div>
              </li>
            ))}
          </ul>

          {single && (
            <aside
              aria-labelledby="includes-title"
              className="site-panel bg-[var(--site-tint)] p-7 sm:p-8 lg:self-start"
            >
              <h3 id="includes-title" className="site-h3">
                {t('includesTitle')}
              </h3>
              <ul className="m-0 mt-4 flex list-none flex-col gap-3 p-0">
                {INCLUDES.map((key) => (
                  <li key={key} className="flex items-start gap-3">
                    <span className="mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-[#fff] text-[var(--site-blue)]">
                      <Check aria-hidden="true" className="size-4" />
                    </span>
                    <span className="site-body">{t(`includes.${key}`)}</span>
                  </li>
                ))}
              </ul>
            </aside>
          )}
        </div>
      </SiteContainer>
    </section>
  );
}
