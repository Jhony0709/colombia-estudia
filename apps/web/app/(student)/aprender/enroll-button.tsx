'use client';

/**
 * «Inscribirme y empezar» en un curso gratuito abierto (25/9; 6/10). Un botón, una petición,
 * y de ahí al primer paso del curso: inscribirse es para empezar. Si todavía no hay nada que
 * abrir (la cohorte empieza más tarde), se vuelve a pedir el panel, que lo explica.
 */

import { useState } from 'react';
import type { Route } from 'next';
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
      const payload = (await res.json().catch(() => null)) as {
        data?: { startHref: string | null };
      } | null;
      if (!res.ok) {
        setError(apiErrorText(payload, t('error')));
        return;
      }
      announce(t('enrolled', { name: courseName }));
      const start = payload?.data?.startHref;
      if (start) router.push(start as Route);
      else router.refresh();
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
