import { getTranslations } from 'next-intl/server';
import { SiteContainer } from '../site-container';
import { MediaPlaceholder } from '../media-placeholder';
import { CornerRibbon } from '../brand-shapes';
import { CtaLink } from '../cta-link';
import type { ContactLink } from '../contact-links';

/** Banda azul profundo: copy a la izquierda, persona a la derecha, cinta de marca en la esquina. */
export async function Banner({ contact }: { contact: ContactLink }) {
  const t = await getTranslations('landing.banner');
  return (
    <section aria-labelledby="banner-title" className="py-20 lg:py-24">
      <SiteContainer>
        <div className="site-panel site-on-dark relative grid overflow-hidden bg-[var(--site-blue-deep)] md:grid-cols-[1.2fr_1fr]">
          <div className="relative space-y-5 p-8 sm:p-12 lg:p-16">
            {/* Cinta de marca en la esquina de la banda, como las cabeceras del manual. */}
            <CornerRibbon className="pointer-events-none absolute -top-1 right-0 w-40 sm:w-52" />
            <h2 id="banner-title" className="site-h2">
              {t('title')}
            </h2>
            <p className="site-lead max-w-[34rem]">{t('body')}</p>
            <CtaLink contact={contact} variant="white" className="mt-2">
              {t('cta')}
            </CtaLink>
          </div>
          <MediaPlaceholder
            id="banner-student"
            rounded="none"
            className="hidden md:block md:aspect-auto md:h-full"
            sizes="(min-width: 768px) 40vw, 0px"
          />
        </div>
      </SiteContainer>
    </section>
  );
}
