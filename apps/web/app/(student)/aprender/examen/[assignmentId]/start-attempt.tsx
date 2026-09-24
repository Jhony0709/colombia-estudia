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
import { PrimaryActionTracker } from '@/components/molecules/primary-action-tracker';
import { Alert } from '@/components/atoms/alert';
import { apiErrorText } from '@/lib/http/api-error-text';
import { useSlowRequest } from '@/lib/net/slow-request';
import { RequestStatus } from '@/components/molecules/request-status';

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

  // La espera que se ve (E1, 23/9): si el servidor tarda, la pantalla lo dice; si no
  // contesta, «Reintentar». Empezar dos veces no crea dos intentos: el servidor devuelve el
  // abierto (`attempt.service.ts#startAttempt`), así que reintentar es seguro.
  const wait = useSlowRequest({
    screen: 'assessment',
    action: continuing ? 'attempt_continue' : 'attempt_start',
    request: 'attempt_start',
  });

  const start = async () => {
    setBusy(true);
    setError(null);
    wait.reset();
    const attemptId = await wait.run(async () => {
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
        return null;
      }
      return payload.data.attemptId;
    });
    if (attemptId) {
      router.push(`/aprender/examen/${assignmentId}/intento/${attemptId}`);
      return;
    }
    setBusy(false);
  };

  return (
    <div className="space-y-3">
      {/* E0 (23/9): la acción principal de «Antes de empezar» se mide (mostrada / pulsada). */}
      <PrimaryActionTracker
        screen="assessment"
        action={continuing ? 'attempt_continue' : 'attempt_start'}
        assignmentId={assignmentId}
        form="ASSESSMENT"
      >
        <Button size="lg" disabled={busy} onClick={() => void start()}>
          {busy ? t('starting') : continuing ? t('continue') : t('start')}
        </Button>
      </PrimaryActionTracker>
      {error && <Alert severity="error">{error}</Alert>}
      <RequestStatus
        phase={wait.phase}
        elapsedSeconds={wait.elapsedSeconds}
        onRetry={() => void start()}
        kept="nothing"
      />
    </div>
  );
}
