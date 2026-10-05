import { getTranslations } from 'next-intl/server';
import { ChevronRight, Compass, Clock3, UsersRound } from 'lucide-react';
import { SiteContainer } from '../site-container';
import { PhotoMask } from '../brand/photo-mask';
import { AlbaWave } from '../brand/alba-wave';
import { MaskReveal } from '../motion/MaskReveal';
import { Reveal } from '../motion/Reveal';
import { Stagger } from '../motion/Stagger';

/**
 * «Volver a estudiar puede sentirse diferente» (5/10): la realidad adulta. Foto grande con la
 * curva de la marca a la izquierda, copy y tres filas a la derecha. Cada fila lleva a donde se
 * explica lo que promete (la flecha no es decorado: es un enlace).
 *
 * Movimiento («reconocemos tu realidad»): la foto se descubre desde la izquierda, el texto
 * llega desde la derecha y las filas entran escalonadas (70 ms, 12 px).
 */
export async function AdultLearning() {
  const t = await getTranslations('landing.adult');
  const features = [
    ['schedule', Clock3, '#preguntas'],
    ['support', UsersRound, '#programas'],
    ['path', Compass, '#como-funciona'],
  ] as const;
  return (
    <section
      aria-labelledby="adult-title"
      className="overflow-hidden bg-[var(--site-bg)] py-16 lg:py-24"
    >
      <SiteContainer className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
        <MaskReveal from="left" className="relative lg:-ml-8 xl:-ml-16">
          <PhotoMask
            id="home-adult"
            shape="arc"
            className="aspect-[4/3] w-full sm:aspect-[16/11] lg:aspect-square"
            sizes="(min-width: 1024px) 45vw, 100vw"
          />
          <AlbaWave variant="side" className="absolute inset-x-0 -bottom-px h-[24%]" />
        </MaskReveal>

        <div className="space-y-6">
          <Reveal variant="slide-left" className="space-y-6">
            <p className="site-eyebrow m-0">{t('eyebrow')}</p>
            <h2 id="adult-title" className="site-h2 m-0">
              {t('titleA')} <span className="site-accent">{t('titleB')}</span>
            </h2>
            <p className="site-lead m-0 max-w-[34rem]">{t('body')}</p>
          </Reveal>
          <Stagger as="ul" distance={12} className="m-0 flex list-none flex-col gap-3 p-0 pt-2">
            {features.map(([key, Icon, href]) => (
              <li key={key}>
                <a href={href} className="site-row">
                  <span className="site-icon">
                    <Icon aria-hidden="true" className="size-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[0.9375rem] font-semibold text-[var(--site-navy)]">
                      {t(`features.${key}.title`)}
                    </span>
                    <span className="site-small block">{t(`features.${key}.body`)}</span>
                  </span>
                  <ChevronRight
                    aria-hidden="true"
                    className="site-row-arrow size-5 shrink-0 text-[var(--site-ink-3)]"
                  />
                </a>
              </li>
            ))}
          </Stagger>
        </div>
      </SiteContainer>
    </section>
  );
}
