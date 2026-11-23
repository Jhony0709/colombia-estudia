import { getTranslations } from 'next-intl/server';
import { ArrowRight, ChevronDown } from 'lucide-react';
import { SiteContainer } from '../site-container';
import type { ContactLink } from '../contact-links';
import { Reveal } from '../motion/Reveal';
import { FaqItem } from './faq-item';

export const FAQ_ITEMS = ['work', 'schedule', 'route', 'years', 'legal', 'price'] as const;
const ITEMS = FAQ_ITEMS;
/** Precios de la plataforma para la respuesta de «¿Cuánto cuesta?» (23/11). */
export interface LandingPrices {
  modulePrice: string;
  total: string;
}
// La guía que amplía cada respuesta (23/11): enlaces internos hacia las páginas de contenido.
const MORE: Partial<Record<(typeof FAQ_ITEMS)[number], string>> = {
  route: '/bachillerato-por-ciclos',
  legal: '/quienes-somos',
  price: '/cuanto-cuesta-el-bachillerato',
};

/**
 * Preguntas (ALBA, 5/10): título a la izquierda, acordeón a la derecha; en el teléfono, título
 * arriba. `<details>` nativo: teclado, lector de pantalla y sin JavaScript; ninguna abierta al
 * cargar. Las cuatro primeras son las del manual; las dos últimas (validez y precio) siguen
 * porque son las que más se preguntan antes de escribir.
 *
 * Movimiento («reduces incertidumbre»): el acordeón abre y cierra con su alto en 220 ms
 * (`FaqItem`); el chevron gira. Nada más.
 */
export async function Faq({ contact, prices }: { contact: ContactLink; prices: LandingPrices }) {
  const t = await getTranslations('landing.faq');
  return (
    <section
      id="preguntas"
      aria-labelledby="faq-title"
      className="scroll-mt-20 bg-[var(--site-bg)] py-16 lg:py-24"
    >
      <SiteContainer className="grid gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16">
        <Reveal className="space-y-4 lg:sticky lg:top-28 lg:self-start">
          <p className="site-eyebrow m-0">{t('eyebrow')}</p>
          <h2 id="faq-title" className="site-h2 m-0">
            <span className="block">{t('titleA')}</span>
            <span className="block">{t('titleB')}</span>
          </h2>
          <p className="site-body m-0">{t('lead')}</p>
          <a
            href={contact.href}
            target={contact.external ? '_blank' : undefined}
            rel={contact.external ? 'noreferrer' : undefined}
            className="site-link"
          >
            {t('write')}
            <ArrowRight aria-hidden="true" className="size-4" />
          </a>
        </Reveal>
        <Reveal delay={0.1} className="border-t border-[var(--site-line)]">
          {ITEMS.map((key) => (
            <FaqItem
              key={key}
              question={
                <>
                  {t(`items.${key}.q`)}
                  <ChevronDown aria-hidden="true" className="size-5" />
                </>
              }
            >
              {t(`items.${key}.a`, { ...prices })}
              {MORE[key] && (
                <>
                  {' '}
                  <a href={MORE[key]} className="site-link">
                    {t(`more.${key}`)}
                  </a>
                </>
              )}
            </FaqItem>
          ))}
        </Reveal>
      </SiteContainer>
    </section>
  );
}
