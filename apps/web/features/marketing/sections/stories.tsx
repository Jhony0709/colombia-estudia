import { getTranslations } from 'next-intl/server';
import { ArrowRight } from 'lucide-react';
import { SiteContainer } from '../site-container';
import { StoryVisual } from '../brand/story-visual';
import { CtaLink } from '../cta-link';
import { Reveal } from '../motion/Reveal';
import type { ContactLink } from '../contact-links';

/**
 * «No empiezas de cero» (ALBA, 5/10): la sección navy es el contenedor, no una tarjeta. Copy a
 * la izquierda y la foto en óvalo con las ondas a la derecha. Todavía no hay historias
 * publicadas: el CTA invita a contar la propia (contacto), no a una página que no existe.
 *
 * Movimiento: el fondo navy aparece sin más; el texto sube y la foto se descubre desde abajo.
 */
export async function Stories({ contact }: { contact: ContactLink }) {
  const t = await getTranslations('landing.stories');
  return (
    <section
      id="historias"
      aria-labelledby="historias-title"
      className="site-on-dark scroll-mt-20 overflow-hidden bg-[var(--site-navy)] pb-12 pt-4 lg:pb-16"
    >
      <SiteContainer className="grid items-center gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-16">
        <Reveal className="space-y-6">
          <p className="site-eyebrow m-0">{t('eyebrow')}</p>
          <h2 id="historias-title" className="site-h2 m-0">
            <span className="block">{t('titleA')}</span>
            <span className="site-accent block">{t('titleB')}</span>
          </h2>
          <div className="max-w-[32rem] space-y-3">
            <p className="site-lead m-0">{t('body1')}</p>
            <p className="site-lead m-0">{t('body2')}</p>
          </div>
          <CtaLink contact={contact} variant="yellow">
            {t('cta')}
            <ArrowRight aria-hidden="true" className="size-4" />
          </CtaLink>
        </Reveal>
        <StoryVisual className="mx-auto w-full max-w-[28rem] lg:-mr-10 lg:max-w-none xl:-mr-20" />
      </SiteContainer>
    </section>
  );
}
