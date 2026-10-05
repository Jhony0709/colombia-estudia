import { getTranslations } from 'next-intl/server';
import { HeartHandshake, SlidersHorizontal, Sun, TrendingUp } from 'lucide-react';
import { SiteContainer } from '../site-container';
import { Stagger } from '../motion/Stagger';
import { motionTokens } from '../motion/tokens';

/**
 * Franja de valores de la marca (ALBA, 5/10): icono, título y una frase, sobre el gris nube.
 * Entra como grupo (50 ms entre valores): el texto aparece y el icono crece de .92 a 1.
 */
export async function ValueStrip() {
  const t = await getTranslations('landing.values');
  const items = [
    ['closeness', HeartHandshake, false],
    ['clarity', Sun, true],
    ['flexibility', SlidersHorizontal, false],
    ['progress', TrendingUp, true],
  ] as const;
  return (
    <section aria-label={t('label')} className="bg-[var(--site-canvas)] py-12 lg:py-14">
      <SiteContainer>
        <Stagger
          as="ul"
          variant="fade"
          step={motionTokens.stagger.tight}
          className="m-0 grid list-none gap-8 p-0 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6"
        >
          {items.map(([key, Icon, sun]) => (
            <li key={key} className="flex items-start gap-4">
              <span data-mo-icon className={sun ? 'site-icon site-icon--sun' : 'site-icon'}>
                <Icon aria-hidden="true" className="size-5" />
              </span>
              <span>
                <span className="block font-semibold text-[var(--site-navy)]">
                  {t(`items.${key}.title`)}
                </span>
                <span className="site-small block">{t(`items.${key}.body`)}</span>
              </span>
            </li>
          ))}
        </Stagger>
      </SiteContainer>
    </section>
  );
}
