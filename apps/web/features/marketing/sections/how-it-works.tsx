import { getTranslations } from 'next-intl/server';
import { ArrowRight, MessageCircle, Route, Users } from 'lucide-react';
import { SiteContainer } from '../site-container';
import { Underline } from '../brand-shapes';

/** Tres pasos con icono y flecha, horizontal en escritorio y vertical en el teléfono. */
export async function HowItWorks() {
  const t = await getTranslations('landing.how');
  const steps = [
    ['contact', MessageCircle],
    ['enter', Users],
    ['pace', Route],
  ] as const;
  return (
    <section
      id="como-funciona"
      aria-labelledby="como-title"
      className="scroll-mt-20 bg-[var(--site-tint)] py-20 lg:py-24"
    >
      <SiteContainer>
        <div className="mx-auto max-w-[40rem] space-y-3 text-center">
          <h2 id="como-title" className="site-h2">
            {t('title')}
          </h2>
          <Underline className="site-underline--now mx-auto" />
          <p className="site-lead">{t('lead')}</p>
        </div>
        {/* Solo `li` dentro del `ol` (HTML válido): la flecha va dentro del paso, absoluta. */}
        <ol className="site-stagger m-0 mt-12 grid list-none gap-10 p-0 md:grid-cols-3 md:gap-14">
          {steps.map(([key, Icon], i) => (
            <li key={key} className="relative flex flex-col items-center text-center">
              <span className="inline-flex size-[4.5rem] items-center justify-center rounded-full border border-[var(--site-line)] bg-[#fff] text-[var(--site-blue)] shadow-[var(--site-shadow)]">
                <Icon aria-hidden="true" className="size-8" />
              </span>
              <h3 className="site-h3 mt-5">
                {i + 1}. {t(`steps.${key}.title`)}
              </h3>
              <p className="site-small mt-2 max-w-xs">{t(`steps.${key}.body`)}</p>
              {i < steps.length - 1 && (
                <ArrowRight
                  aria-hidden="true"
                  className="absolute -right-9 top-6 hidden size-6 text-[var(--site-blue)] opacity-50 md:block"
                />
              )}
            </li>
          ))}
        </ol>
      </SiteContainer>
    </section>
  );
}
