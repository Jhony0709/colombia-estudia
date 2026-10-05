import { getTranslations } from 'next-intl/server';
import { ArrowRight } from 'lucide-react';
import { SiteContainer } from '../site-container';
import { MediaPlaceholder } from '../media-placeholder';
import { CtaLink } from '../cta-link';
import { Reveal } from '../motion/Reveal';
import { Stagger } from '../motion/Stagger';
import { motionTokens } from '../motion/tokens';
import type { MediaId } from '../media';

/**
 * «Personas reales, historias reales» (ALBA, 5/10): copy a la izquierda y un mosaico de tres
 * fotos a la derecha —una vertical grande y dos apaisadas apiladas—, con la etiqueta sobre cada
 * una (velo navy funcional: el texto blanco siempre ≥ 4.5:1). En el teléfono el mosaico se
 * mantiene asimétrico en dos columnas, más bajo.
 *
 * Movimiento («te identificas»): las fotos se descubren de abajo arriba en orden —la grande,
 * arriba a la derecha, abajo a la derecha— cada 100 ms; la etiqueta sube 4 px después.
 */
const TILES: ReadonlyArray<{ id: MediaId; label: 'place' | 'work' | 'future'; className: string }> =
  [
    { id: 'home-mosaic-place', label: 'place', className: 'row-span-2' },
    { id: 'home-mosaic-work', label: 'work', className: '' },
    { id: 'home-mosaic-future', label: 'future', className: '' },
  ];

export async function RealPeople() {
  const t = await getTranslations('landing.people');
  return (
    <section aria-labelledby="people-title" className="bg-[var(--site-bg)] pb-16 lg:pb-24">
      <SiteContainer className="grid items-center gap-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16">
        <Reveal className="space-y-6">
          <p className="site-eyebrow m-0">{t('eyebrow')}</p>
          <h2 id="people-title" className="site-h2 m-0">
            <span className="block">{t('titleA')}</span>
            <span className="block">{t('titleB')}</span>
          </h2>
          <p className="site-lead m-0 max-w-[30rem]">{t('body')}</p>
          <CtaLink href="#programas" variant="secondary">
            {t('cta')}
            <ArrowRight aria-hidden="true" className="size-4" />
          </CtaLink>
        </Reveal>

        <Stagger
          as="ul"
          variant="mask"
          step={motionTokens.stagger.loose}
          duration={motionTokens.duration.slow}
          round="var(--site-r-panel)"
          className="m-0 grid h-[24rem] list-none grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] grid-rows-2 gap-3 p-0 sm:h-[30rem] sm:gap-4 lg:h-[32rem]"
        >
          {TILES.map((tile) => (
            <li
              key={tile.id}
              className={`site-zoom site-zoom--soft relative overflow-hidden rounded-[var(--site-r-panel)] ${tile.className}`}
            >
              <MediaPlaceholder
                id={tile.id}
                rounded="none"
                className="aspect-auto h-full w-full"
                sizes="(min-width: 1024px) 30vw, 50vw"
              />
              <div aria-hidden="true" className="site-photo-scrim absolute inset-0" />
              <p
                data-mo-label
                className="site-photo-label absolute inset-x-0 bottom-0 m-0 p-4 sm:p-5"
              >
                {t(`labels.${tile.label}`)}
              </p>
            </li>
          ))}
        </Stagger>
      </SiteContainer>
    </section>
  );
}
