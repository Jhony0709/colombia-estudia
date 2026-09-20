import { getTranslations } from 'next-intl/server';
import { Accessibility, ClipboardCheck, Smartphone, Users } from 'lucide-react';
import { SiteContainer } from '../site-container';

/** La barra flotante de la referencia, con hechos y no con cifras, montada sobre el hero. */
export async function FactsBar() {
  const t = await getTranslations('landing.facts');
  const facts = [
    ['cohorts', Users],
    ['virtual', Smartphone],
    ['feedback', ClipboardCheck],
    ['accessible', Accessibility],
  ] as const;
  return (
    <SiteContainer>
      <ul
        aria-label={t('label')}
        className="site-float site-stagger m-0 grid list-none grid-cols-1 gap-5 px-5 py-6 sm:grid-cols-2 sm:px-8 lg:grid-cols-4"
      >
        {facts.map(([key, Icon]) => (
          <li key={key} className="flex items-center gap-3">
            <span className="site-icon-pill">
              <Icon aria-hidden="true" className="size-5" />
            </span>
            <span className="font-medium">{t(key)}</span>
          </li>
        ))}
      </ul>
    </SiteContainer>
  );
}
