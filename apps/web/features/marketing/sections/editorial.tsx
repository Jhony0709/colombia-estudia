import { getTranslations } from 'next-intl/server';
import { SiteContainer } from '../site-container';
import { MediaPlaceholder } from '../media-placeholder';
import { CtaLink } from '../cta-link';

/** Panel editorial: foto grande y un panel blanco superpuesto a la derecha. Sección, no tarjeta. */
export async function Editorial() {
  const t = await getTranslations('landing.editorial');
  return (
    <section aria-labelledby="editorial-title" className="pb-20 lg:pb-24">
      <SiteContainer>
        <div className="relative">
          <MediaPlaceholder
            id="editorial-colombia"
            rounded="sheet"
            className="site-panel lg:aspect-[21/9]"
            sizes="(min-width: 1024px) 1240px, 100vw"
          />
          <div className="site-float mx-4 -mt-16 max-w-lg space-y-4 p-7 sm:p-9 lg:absolute lg:right-12 lg:top-1/2 lg:mx-0 lg:mt-0 lg:w-[42%] lg:-translate-y-1/2">
            <h2 id="editorial-title" className="site-h2">
              {t('title')}
            </h2>
            <p className="site-body">{t('body')}</p>
            <CtaLink href="#como-funciona" className="mt-2">
              {t('cta')}
            </CtaLink>
          </div>
        </div>
      </SiteContainer>
    </section>
  );
}
