/**
 * Portada pública: ALBA Futuro Educativo (rebranding, 5/10; antes «Colombia Estudia», 19/9).
 * SSOT: reference/01-routing/routes.md (`/`), docs/brand/README.md; referencia visual:
 * docs/brand/alba-landing-reference.png y alba-brand-board.png.
 *
 * Tiene piel propia (`site.css`, Lexend) y no sigue los tokens del producto al pie de la letra:
 * es la presentación ante un posible alumno. Lo que sí comparte es lo no negociable: contraste
 * AA, foco visible, objetivos de 44 px, HTML semántico, movimiento reducido.
 *
 * Una sola narrativa, unida por las ondas del isotipo: hero → la realidad adulta → el programa
 * → historias → el proceso → personas → valores → preguntas → el cierre. Siempre en claro.
 *
 * Movimiento (5/10): `motion/` (tokens y primitivos) y la entrada del hero en `site.css`. Cada
 * sección anima solo lo suyo y una vez; las secciones de color nunca se desvanecen enteras (bajo
 * una onda se vería un hueco). `MotionRoot` va al final: decide qué se oculta al hidratar.
 */

import { lexend } from '@/app/fonts/site';
import { getTranslations } from 'next-intl/server';
import { cn } from '@/lib/utils';
import { primaryContact } from './contact-links';
import { StickyHeaderShadow } from './reveal';
import { MotionRoot } from './motion/MotionRoot';
import { WaveSeparator } from './brand/wave-separator';
import { SiteHeader } from './sections/site-header';
import { Hero } from './sections/hero';
import { AdultLearning } from './sections/adult-learning';
import { Programs } from './sections/programs';
import { Stories } from './sections/stories';
import { ProcessTimeline } from './sections/process-timeline';
import { RealPeople } from './sections/real-people';
import { ValueStrip } from './sections/value-strip';
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
  const t = await getTranslations('landing');
  // El mensaje pre-escrito del chat (28/9): el teléfono sigue saliendo de la institución.
  const contact = primaryContact(
    institution.supportPhone,
    institution.supportEmail,
    t('contact.message', { name: institution.name })
  );
  return (
    <div className={cn('site theme-light-scope min-h-screen', lexend.variable)}>
      <SiteHeader signedIn={signedIn} />
      <StickyHeaderShadow />
      <main id="contenido">
        <Hero />
        <AdultLearning />
        <WaveSeparator from="white" to="tint" variant="fall" accent="blue" origin="left" />
        <Programs contact={contact} />
        <WaveSeparator from="tint" to="navy" variant="rise" accent="sun" origin="right" tall />
        <Stories contact={contact} />
        <WaveSeparator from="navy" to="white" variant="fall" accent="blue" origin="left" />
        <ProcessTimeline />
        <RealPeople />
        <ValueStrip />
        <Faq contact={contact} />
        <FinalCta contact={contact} signedIn={signedIn} />
      </main>
      <SiteFooter institution={institution} signedIn={signedIn} />
      <FloatingContact contact={contact} />
      <MotionRoot />
    </div>
  );
}
