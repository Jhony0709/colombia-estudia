'use client';

/**
 * «Inscribirme» en un curso gratuito abierto (25/9). Un botón, una petición, y al volver la
 * página se vuelve a pedir al servidor (`router.refresh()`): la matrícula nueva ya sale
 * arriba como «Empieza por aquí» sin que nadie recargue.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/atoms/button';
import { useAnnounce } from '@/lib/a11y/announce';
import { apiErrorText } from '@/lib/http/api-error-text';

export function EnrollButton({
  cohortId,
  moduleId,
  courseName,
}: {
  cohortId: string;
  moduleId: string;
  courseName: string;
}) {
  const t = useTranslations('learn.catalog');
  const router = useRouter();
  const { announce } = useAnnounce();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const enroll = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/learn/catalog/${cohortId}/enroll`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ moduleId }),
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok) {
        setError(apiErrorText(payload, t('error')));
        return;
      }
      announce(t('enrolled', { name: courseName }));
      router.refresh();
    } catch {
      setError(t('error'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2">
      <Button type="button" loading={busy} onClick={() => void enroll()}>
        {t('cta')}
        <span className="sr-only"> {courseName}</span>
      </Button>
      {error && (
        <p role="alert" className="type-caption text-status-error-base m-0">
          {error}
        </p>
      )}
    </div>
  );
}
