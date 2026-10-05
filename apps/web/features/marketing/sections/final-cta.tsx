import { getTranslations } from 'next-intl/server';
import { ArrowRight, MessageCircle } from 'lucide-react';
import { SiteContainer } from '../site-container';
import { MediaPlaceholder } from '../media-placeholder';
import { WaveSeparator } from '../brand/wave-separator';
import { WhatsAppIcon } from '../brand/whatsapp-icon';
import { CtaLink } from '../cta-link';
import { Reveal } from '../motion/Reveal';
import { motionTokens } from '../motion/tokens';
import type { ContactLink } from '../contact-links';

/**
 * Cierre (ALBA, 5/10): navy a sangre con el paisaje detrás bajo un velo, el sol de la marca
 * asomando y la onda que lo une a la sección de arriba. «Quiero conocer mi ruta» es el registro
 * público; con sesión, la acción es hablar con orientación.
 *
 * Movimiento («tomas acción»): al entrar, el paisaje se asienta (1.04 → 1 en 1 s), la estela
 * amarilla de la onda sube, el sol crece de .96 a 1, el título sube y los botones aparecen.
 * Una vez: nada pulsa ni se repite.
 */
export async function FinalCta({ contact, signedIn }: { contact: ContactLink; signedIn: boolean }) {
  const t = await getTranslations('landing.final');
  const external = contact.external;
  return (
    <section
      id="contacto"
      aria-labelledby="final-title"
      className="site-on-dark relative isolate overflow-hidden bg-[var(--site-navy)]"
    >
      <Reveal
        variant="settle"
        duration={motionTokens.duration.settle}
        className="absolute inset-0 -z-10"
      >
        <MediaPlaceholder
          id="home-final"
          rounded="none"
          className="aspect-auto h-full w-full"
          sizes="100vw"
        />
      </Reveal>
      <div aria-hidden="true" className="site-final-veil absolute inset-0 -z-10" />
      {/* El sol asomando por el borde de abajo, como sobre el horizonte: el amanecer de ALBA. */}
      <Reveal
        variant="grow"
        duration={motionTokens.duration.slow}
        className="absolute -bottom-28 -right-10 -z-10 size-56 sm:-bottom-36 sm:right-[10%] sm:size-72"
      >
        <span
          aria-hidden="true"
          className="block size-full rounded-full bg-[var(--site-yellow)] opacity-90"
        />
      </Reveal>
      <WaveSeparator from="white" variant="swell" accent="sun" tall cut />

      <SiteContainer className="relative pb-20 pt-6 lg:pb-28">
        <div className="max-w-[38rem] space-y-6">
          <Reveal className="space-y-6">
            <p className="site-eyebrow m-0">{t('eyebrow')}</p>
            <h2 id="final-title" className="site-h2 m-0 !text-[clamp(2rem,1.3rem+2.4vw,3.25rem)]">
              <span className="block">{t('titleA')}</span>
              <span className="site-accent block">{t('titleB')}</span>
            </h2>
          </Reveal>
          <Reveal variant="fade" delay={0.16} className="flex flex-wrap gap-3 pt-2">
            {signedIn ? null : (
              <CtaLink href="/registro" variant="yellow">
                {t('cta')}
                <ArrowRight aria-hidden="true" className="size-4" />
              </CtaLink>
            )}
            <CtaLink contact={contact} variant={signedIn ? 'yellow' : 'ghost'}>
              {external ? (
                <WhatsAppIcon className="size-5" />
              ) : (
                <MessageCircle aria-hidden="true" className="size-5" />
              )}
              {t('ctaSecondary')}
            </CtaLink>
          </Reveal>
        </div>
      </SiteContainer>
    </section>
  );
}
