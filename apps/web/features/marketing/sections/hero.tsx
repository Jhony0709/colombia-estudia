import { getTranslations } from 'next-intl/server';
import { ArrowRight, Clock3, MapPin, Users } from 'lucide-react';
import { SiteContainer } from '../site-container';
import { CtaLink } from '../cta-link';
import { PhotoMask } from '../brand/photo-mask';
import { AlbaWave } from '../brand/alba-wave';
import { Parallax } from '../motion/Parallax';

/**
 * Hero (ALBA, 5/10). Copy y beneficios a la izquierda (45 %), la foto en el arco de la marca a
 * la derecha (55 %), y las ondas del isotipo cerrando la sección por abajo: no hay línea recta
 * entre el hero y lo que sigue. En el teléfono: copy y CTA, foto, beneficios, ondas
 * (`.site-hero-grid`, site.css).
 *
 * Movimiento (5/10): la entrada al cargar es CSS (`site.css`, «Hero»), no JavaScript: ocurre
 * con el primer pintado, sin esperar a hidratar, y no retrasa el LCP. Orden: cabecera, eyebrow,
 * título, entradilla, CTA, beneficios, foto (recorte de arriba abajo), ondas (cada capa desde un
 * eje). El parallax (foto, sol, ondas) es de Motion y solo en escritorio con ratón.
 */
export async function Hero() {
  const t = await getTranslations('landing.hero');
  return (
    <section
      id="inicio"
      aria-labelledby="hero-title"
      className="relative overflow-hidden bg-[var(--site-bg)]"
    >
      <SiteContainer className="site-hero-grid relative pb-28 pt-8 sm:pb-36 lg:min-h-[44rem] lg:pb-44 lg:pt-14">
        <div className="site-hero-copy space-y-6 lg:self-end">
          <p className="site-eyebrow m-0">{t('eyebrow')}</p>
          <h1 id="hero-title" className="site-h1 m-0 outline-none" tabIndex={-1}>
            <span className="block">{t('titleA')}</span>
            <span className="site-accent block">{t('titleB')}</span>
          </h1>
          <p className="site-lead m-0 max-w-[30rem]">{t('lead')}</p>
          <div className="site-hero-ctas flex flex-wrap gap-3 pt-1">
            <CtaLink href="#programas">
              {t('ctaPrimary')}
              <ArrowRight aria-hidden="true" className="size-4" />
            </CtaLink>
            <CtaLink href="#como-funciona" variant="secondary">
              {t('ctaSecondary')}
            </CtaLink>
          </div>
        </div>

        <div className="site-hero-visual relative lg:-mb-40 lg:-mr-8 xl:-mr-16">
          {/* Un sol detrás del arco: el amanecer de la marca, sin texto ni contenido. */}
          <Parallax distance={-30} className="absolute -left-6 top-10 hidden lg:block">
            <span className="site-hero-sun block size-24 rounded-full bg-[var(--site-yellow)]" />
          </Parallax>
          <Parallax distance={40} decorative={false} className="lg:h-full">
            <PhotoMask
              id="home-hero"
              shape="arch"
              priority
              className="site-hero-photo aspect-auto h-[22rem] w-full sm:h-[28rem] lg:h-full lg:min-h-[34rem]"
              sizes="(min-width: 1024px) 50vw, 100vw"
            />
          </Parallax>
        </div>

        <HeroBenefits label={t('benefitsLabel')} />
      </SiteContainer>

      {/* Un 4 % más ancha por cada lado: las capas entran en horizontal y no deben dejar hueco. */}
      <Parallax
        distance={20}
        className="site-hero-waves absolute -bottom-px left-[-4%] h-[6.5rem] w-[108%] sm:h-[8.5rem] lg:h-[12rem]"
      >
        <AlbaWave variant="hero" className="h-full" />
      </Parallax>
    </section>
  );
}

/** Tres beneficios en línea: icono, título y una frase. Sin tarjetas. */
async function HeroBenefits({ label }: { label: string }) {
  const t = await getTranslations('landing.hero.benefits');
  const items = [
    ['pace', Clock3],
    ['support', Users],
    ['anywhere', MapPin],
  ] as const;
  return (
    <ul
      aria-label={label}
      className="site-hero-benefits m-0 grid list-none gap-5 p-0 sm:grid-cols-3 sm:gap-6 lg:self-start"
    >
      {items.map(([key, Icon]) => (
        <li key={key} className="flex items-start gap-3 sm:flex-col sm:gap-2">
          <Icon aria-hidden="true" className="size-6 shrink-0 text-[var(--site-blue)]" />
          <span>
            <span className="block text-[0.9375rem] font-semibold text-[var(--site-navy)]">
              {t(`${key}.title`)}
            </span>
            <span className="site-small block">{t(`${key}.body`)}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}
