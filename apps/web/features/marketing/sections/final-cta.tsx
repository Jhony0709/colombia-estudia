import { getTranslations } from 'next-intl/server';
import { MessageCircle } from 'lucide-react';
import { SiteContainer } from '../site-container';
import { MediaPlaceholder } from '../media-placeholder';
import { CornerRibbon } from '../brand-shapes';
import { CtaLink } from '../cta-link';
import type { ContactLink } from '../contact-links';

/** CTA final: azul profundo, cinta en la esquina, foto de grupo y el botón amarillo de marca. */
export async function FinalCta({ contact }: { contact: ContactLink }) {
  const t = await getTranslations('landing.final');
  return (
    <section id="contacto" aria-labelledby="final-title" className="scroll-mt-20 pb-20 lg:pb-24">
      <SiteContainer>
        <div className="site-panel site-on-dark relative grid overflow-hidden bg-[var(--site-blue-deep)] md:grid-cols-2">
          <div className="relative space-y-5 p-8 sm:p-12 lg:p-16">
            {/* Cinta de marca en la esquina de la banda, como las cabeceras del manual. */}
            <CornerRibbon className="pointer-events-none absolute -top-1 right-0 w-40 sm:w-52" />
            <h2 id="final-title" className="site-h2">
              {t('title')}
            </h2>
            <p className="site-lead max-w-[34rem]">{t('body')}</p>
            <CtaLink contact={contact} variant="yellow" className="mt-2">
              <MessageCircle aria-hidden="true" className="size-5" />
              {contact.external ? t('cta') : t('ctaEmail')}
            </CtaLink>
          </div>
          <MediaPlaceholder
            id="final-students"
            rounded="none"
            className="md:aspect-auto md:h-full"
            sizes="(min-width: 768px) 50vw, 100vw"
          />
        </div>
      </SiteContainer>
    </section>
  );
}
