import { getTranslations } from 'next-intl/server';
import { ArrowRight, BadgeCheck, CalendarDays, Captions, Clock3, Users } from 'lucide-react';
import { SiteContainer } from '../site-container';
import { MediaPlaceholder } from '../media-placeholder';
import { HeroShapes } from '../brand-shapes';
import { CtaLink } from '../cta-link';

/**
 * Hero editorial: copy a la izquierda (eyebrow, H1 en dos pesos, entradilla, beneficios,
 * CTAs) y a la derecha la persona cortando la cinta azul, con la ciudad detrás y dos chips
 * flotantes con hechos verdaderos (no "+250 mil estudiantes").
 */
export async function Hero() {
  const t = await getTranslations('landing.hero');
  const benefits = [
    ['flexible', Clock3],
    ['group', Users],
    ['quality', BadgeCheck],
  ] as const;

  return (
    <section aria-labelledby="hero-title" className="relative overflow-hidden">
      {/*
        Fondo del hero en tablet y escritorio (Jhonny, 19/9): la ciudad detrás de todo, con
        una máscara degradada de izquierda a derecha que deja el copy sobre lienzo casi liso y
        descubre la foto hacia la derecha. En el teléfono no hay ciudad: solo la persona y las
        formas. La foto va como `background-image` en site.css (bajo `min-width: 768px`) para
        que el teléfono no la descargue; un `<img>` oculto la descargaría igual.
      */}
      <div aria-hidden="true" className="site-hero-bg absolute inset-0 hidden md:block" />
      <div aria-hidden="true" className="site-hero-mask absolute inset-0 hidden md:block" />
      <SiteContainer className="relative grid items-center gap-12 py-14 md:grid-cols-[1.05fr_1fr] md:gap-10 md:py-20 lg:py-24">
        <div className="site-hero-copy space-y-7">
          <p className="site-eyebrow">{t('eyebrow')}</p>
          <h1 id="hero-title" className="site-h1 outline-none" tabIndex={-1}>
            <span className="block">{t('titleLight')}</span>
            <strong className="block">{t('titleStrong')}</strong>
          </h1>
          <p className="site-lead max-w-[36rem]">{t('lead')}</p>

          <ul className="m-0 flex list-none flex-col gap-4 p-0 sm:flex-row sm:flex-wrap sm:gap-x-8">
            {benefits.map(([key, Icon]) => (
              <li key={key} className="flex items-start gap-3">
                <span className="site-icon-pill">
                  <Icon aria-hidden="true" className="size-5" />
                </span>
                <span>
                  <span className="block font-medium">{t(`benefits.${key}.title`)}</span>
                  <span className="site-small block">{t(`benefits.${key}.body`)}</span>
                </span>
              </li>
            ))}
          </ul>

          <div className="flex flex-wrap gap-3 pt-1">
            <CtaLink href="#programas">
              {t('ctaPrimary')}
              <ArrowRight aria-hidden="true" className="size-5" />
            </CtaLink>
            <CtaLink href="#como-funciona" variant="secondary">
              {t('ctaSecondary')}
            </CtaLink>
          </div>
        </div>

        <HeroVisual chipVideo={t('chipVideo')} chipCohort={t('chipCohort')} />
      </SiteContainer>
    </section>
  );
}

function HeroVisual({ chipVideo, chipCohort }: { chipVideo: string; chipCohort: string }) {
  return (
    <div className="relative mx-auto aspect-square w-full max-w-[34rem]">
      <HeroShapes className="site-hero-shapes absolute inset-0" />
      <MediaPlaceholder
        id="hero-student"
        rounded="none"
        priority
        className="site-hero-photo absolute bottom-0 left-[2%] w-[70%]"
        sizes="(min-width: 768px) 26vw, 64vw"
      />
      <p className="site-chip site-hero-chip site-hero-chip--1 absolute left-0 top-[14%] m-0">
        <CalendarDays aria-hidden="true" className="size-4 text-[var(--site-blue)]" />
        {chipCohort}
      </p>
      <p className="site-chip site-hero-chip site-hero-chip--2 absolute bottom-[10%] right-0 m-0">
        <Captions aria-hidden="true" className="size-4 text-[var(--site-blue)]" />
        {chipVideo}
      </p>
    </div>
  );
}
