/**
 * Portada pública (web pública, 19/9). SSOT: reference/01-routing/routes.md (`/`),
 * docs/brand/README.md; referencia visual: docs/brand/landing-reference.png.
 *
 * Tiene piel propia (`site.css`, Lexend) y no sigue los tokens del producto al pie de la
 * letra: es la presentación ante un posible alumno (Jhonny, 19/9). Lo que sí comparte es lo
 * no negociable: contraste AA, foco visible, objetivos de 44 px, HTML semántico.
 *
 * Composición de la referencia con el producto real: hero editorial, barra de hechos (no de
 * cifras), programas en tarjetas, panel editorial, tres pasos, banda azul, preguntas
 * frecuentes, CTA final con foto, pie pequeño y botón flotante de contacto. Sin registro,
 * sin testimonios, sin partners. Siempre en claro.
 */

import { lexend } from '@/app/fonts/site';
import { cn } from '@/lib/utils';
import { primaryContact } from './contact-links';
import { Reveal, StickyHeaderShadow } from './reveal';
import { SiteHeader } from './sections/site-header';
import { Hero } from './sections/hero';
import { FactsBar } from './sections/facts-bar';
import { Programs } from './sections/programs';
import { Editorial } from './sections/editorial';
import { HowItWorks } from './sections/how-it-works';
import { Banner } from './sections/banner';
import { Faq } from './sections/faq';
import { FinalCta } from './sections/final-cta';
import { SiteFooter } from './sections/site-footer';
import { FloatingContact } from './sections/floating-contact';
import './site.css';

export interface LandingInstitution {
  name: string;
  supportEmail: string;
  supportPhone: string | null;
  dataPolicyUrl: string | null;
}

export async function Landing({
  institution,
  signedIn,
}: {
  institution: LandingInstitution;
  signedIn: boolean;
}) {
  const contact = primaryContact(institution.supportPhone, institution.supportEmail);
  return (
    <div className={cn('site theme-light-scope min-h-screen', lexend.variable)}>
      <SiteHeader signedIn={signedIn} contact={contact} />
      <StickyHeaderShadow />
      <main id="contenido">
        <div className="bg-[var(--site-canvas)] pb-12">
          <Hero />
        </div>
        <div className="-mt-12">
          <Reveal>
            <FactsBar />
          </Reveal>
        </div>
        <Reveal>
          <Programs contact={contact} />
        </Reveal>
        <Reveal>
          <Editorial />
        </Reveal>
        <Reveal>
          <HowItWorks />
        </Reveal>
        <Reveal>
          <Banner contact={contact} />
        </Reveal>
        <Reveal>
          <Faq />
        </Reveal>
        <Reveal>
          <FinalCta contact={contact} />
        </Reveal>
      </main>
      <SiteFooter institution={institution} signedIn={signedIn} />
      <FloatingContact contact={contact} />
    </div>
  );
}
