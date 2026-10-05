import { getTranslations } from 'next-intl/server';
import { MessageCircle, Route, TrendingUp } from 'lucide-react';
import { SiteContainer } from '../site-container';
import { AnimatedTimeline } from '../motion/AnimatedTimeline';
import { Reveal } from '../motion/Reveal';
import { Stagger } from '../motion/Stagger';

/**
 * «Un proceso simple, humano y a tu ritmo» (ALBA, 5/10). En escritorio, una línea curva (SVG)
 * con un punto amarillo sobre cada paso; los puntos están en los extremos de los tramos de la
 * curva, así que caen siempre sobre la línea. En el teléfono, la línea es vertical. Sin tarjetas.
 *
 * Movimiento («entiendes cómo avanzar»): la curva se dibuja con el scroll y cada paso se
 * activa cuando la línea llega a su punto (`AnimatedTimeline`).
 */
export async function ProcessTimeline() {
  const t = await getTranslations('landing.process');
  const steps = [
    ['tell', MessageCircle],
    ['route', Route],
    ['advance', TrendingUp],
  ] as const;
  return (
    <section
      id="como-funciona"
      aria-labelledby="como-title"
      className="scroll-mt-20 bg-[var(--site-bg)] py-16 lg:py-24"
    >
      <SiteContainer>
        <Reveal className="max-w-[40rem] space-y-3">
          <p className="site-eyebrow m-0">{t('eyebrow')}</p>
          <h2 id="como-title" className="site-h2 m-0">
            {t('titleA')} <span className="site-accent">{t('titleB')}</span>
          </h2>
        </Reveal>

        <AnimatedTimeline>
          <Stagger
            as="ol"
            className="relative m-0 grid list-none gap-10 border-l-2 border-[var(--site-blue)] p-0 pl-8 lg:mt-6 lg:grid-cols-3 lg:gap-12 lg:border-l-0 lg:pl-0"
          >
            {steps.map(([key, Icon], i) => (
              <li key={key} data-step className="relative lg:text-center">
                {/* En el teléfono, el punto va sobre la línea vertical. */}
                <span
                  aria-hidden="true"
                  className="site-timeline-dot absolute -left-[2.55rem] top-3 lg:hidden"
                />
                <div className="site-step-marker flex items-center gap-4 lg:justify-center">
                  <span className="site-step-number">{String(i + 1).padStart(2, '0')}</span>
                  <Icon aria-hidden="true" className="size-7 text-[var(--site-blue)]" />
                </div>
                <h3 className="site-h3 m-0 mt-3">{t(`steps.${key}.title`)}</h3>
                <p className="site-small m-0 mt-1 lg:mx-auto lg:max-w-[16rem]">
                  {t(`steps.${key}.body`)}
                </p>
              </li>
            ))}
          </Stagger>
        </AnimatedTimeline>
      </SiteContainer>
    </section>
  );
}
