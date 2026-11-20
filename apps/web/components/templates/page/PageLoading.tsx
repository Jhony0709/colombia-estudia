import { useTranslations } from 'next-intl';
import { Page } from './Page';

const BLOCK = 'bg-surface-sunken rounded-card motion-safe:animate-pulse';

/** El hueco de una página mientras el servidor la arma: título y dos bloques. */
export function PageLoading({ wide = false }: { wide?: boolean }) {
  const t = useTranslations('button');
  return (
    <Page wide={wide}>
      <div role="status" aria-live="polite" className="space-y-8">
        <span className="sr-only">{t('loading')}</span>
        <div aria-hidden className="space-y-3">
          <div className={`${BLOCK} h-9 w-64 max-w-full`} />
          <div className={`${BLOCK} h-4 w-96 max-w-full`} />
        </div>
        <div aria-hidden className={`${BLOCK} h-40`} />
        <div aria-hidden className={`${BLOCK} h-64`} />
      </div>
    </Page>
  );
}
