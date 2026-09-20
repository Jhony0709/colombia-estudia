import { getTranslations } from 'next-intl/server';
import { Plus } from 'lucide-react';
import { SiteContainer } from '../site-container';
import { Underline } from '../brand-shapes';

const ITEMS = ['legal', 'requirements', 'when', 'schedule', 'icfes', 'diploma', 'price'] as const;

/**
 * Preguntas frecuentes con `<details>` nativo: teclado, lector de pantalla y sin JavaScript.
 * Respuestas redactadas a partir de validaya.com/preguntas-frecuentes (19/9), con nuestras
 * palabras; el precio se remite al contacto porque el de la web no dice a qué corresponde.
 */
export async function Faq() {
  const t = await getTranslations('landing.faq');
  return (
    <section id="preguntas" aria-labelledby="faq-title" className="scroll-mt-20 pb-20 lg:pb-24">
      <SiteContainer className="grid gap-10 lg:grid-cols-[2fr_3fr] lg:gap-16">
        <div className="space-y-3 lg:sticky lg:top-28 lg:self-start">
          <h2 id="faq-title" className="site-h2">
            {t('title')}
          </h2>
          <Underline />
          <p className="site-lead">{t('lead')}</p>
        </div>
        <div className="site-stagger border-b border-[var(--site-line)]">
          {ITEMS.map((key) => (
            <details key={key} className="site-faq">
              <summary>
                {t(`items.${key}.q`)}
                <Plus aria-hidden="true" className="size-5" />
              </summary>
              <div className="site-body">{t(`items.${key}.a`)}</div>
            </details>
          ))}
        </div>
      </SiteContainer>
    </section>
  );
}
