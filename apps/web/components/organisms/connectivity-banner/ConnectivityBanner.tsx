'use client';

/**
 * «Sin conexión», arriba de todo, mientras el navegador diga que no la hay (23/9,
 * `docs/ux/decision-ux-2309.md`). `role="status"`: se anuncia sin interrumpir. Lo que ya
 * cargó sigue usable; la evidencia del tema y el intento reintentan solos al volver
 * (`evidence-recorder.tsx`, autosave del intento). No es una app offline: es no dejar a
 * nadie creyendo que el botón está roto cuando lo que se cayó son los datos.
 */

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { WifiOff } from 'lucide-react';

export function ConnectivityBanner() {
  const t = useTranslations('connectivity');
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    setOffline(!navigator.onLine);
    const on = () => setOffline(false);
    const off = () => setOffline(true);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  if (!offline) return null;

  return (
    <div
      role="status"
      className="bg-status-warning-muted text-status-warning-base type-caption flex items-center justify-center gap-2 px-4 py-2"
    >
      <WifiOff aria-hidden className="size-4 shrink-0" />
      <span>{t('offline')}</span>
    </div>
  );
}
