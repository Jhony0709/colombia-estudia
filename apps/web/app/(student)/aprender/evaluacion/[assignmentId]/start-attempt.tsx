'use client';

/**
 * «Empezar» / «Continuar»: pide el intento al servidor y navega a él.
 * El servidor es idempotente (un intento abierto se devuelve en vez de crear otro), así
 * que un doble clic no gasta dos intentos.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/atoms/button';
import { Alert } from '@/components/atoms/alert';
import { apiErrorText } from '@/lib/http/api-error-text';

export function StartAttempt({
  assignmentId,
  continuing,
}: {
  assignmentId: string;
  continuing: boolean;
}) {
  const t = useTranslations('learn.assessment');
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const start = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/learn/assessments/${assignmentId}/attempts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const payload = (await res.json().catch(() => null)) as {
        data?: { attemptId: string };
      } | null;
      if (!res.ok || !payload?.data) {
        setError(apiErrorText(payload, t('startError')));
        router.refresh();
        return;
      }
      router.push(`/aprender/evaluacion/${assignmentId}/intento/${payload.data.attemptId}`);
    } catch {
      setError(t('startError'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <Button size="lg" disabled={busy} onClick={() => void start()}>
        {busy ? t('starting') : continuing ? t('continue') : t('start')}
      </Button>
      {error && <Alert severity="error">{error}</Alert>}
    </div>
  );
}
