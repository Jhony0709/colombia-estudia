/**
 * «Cómo funciona» (6/10, crítica de /aprender para quien llega): tres pasos que responden la
 * pregunta del primer día —qué hago, cómo sé que avancé, qué obtengo— antes de que haya
 * cualquier dato que mostrar. Se ve sin curso y el primer día; desde el primer paso
 * completado ya no hace falta.
 */

import { getTranslations } from 'next-intl/server';
import { DashCard } from './dashboard-cards';

const STEPS = ['read', 'practice', 'exam'] as const;

export async function HowItWorks() {
  const t = await getTranslations('learn.howItWorks');
  return (
    <DashCard id="como-funciona" title={t('title')}>
      <ol className="motion-stagger m-0 list-none space-y-4 p-0">
        {STEPS.map((step, index) => (
          <li key={step} className="flex gap-3">
            <span
              aria-hidden="true"
              className="bg-surface-sunken text-text type-label inline-flex size-8 shrink-0 items-center justify-center rounded-full"
            >
              {index + 1}
            </span>
            <span className="min-w-0">
              <span className="type-body-emphasis text-text block">{t(`${step}.title`)}</span>
              <span className="type-caption text-text-muted block">{t(`${step}.body`)}</span>
            </span>
          </li>
        ))}
      </ol>
    </DashCard>
  );
}
