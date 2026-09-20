'use client';

/**
 * "Enviar invitaciones a N personas", con confirmación.
 * SSOT: plan/06-cohortes-y-personas.md:57-63.
 *
 * Dos pulsaciones a propósito: la primera cuenta y enseña a quién, la segunda envía. Es la
 * única acción de esta pantalla que sale del sistema y llega al correo de una persona;
 * enviarla de un clic sin decir cuántas son es como se manda una tanda a la lista
 * equivocada.
 */

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/atoms/button';
import { Alert } from '@/components/atoms/alert';

interface Candidate {
  personId: string;
  name: string;
  email: string | null;
  skip: 'no-email' | 'has-account' | 'pending-invitation' | null;
}

interface Plan {
  candidates: Candidate[];
  sendable: number;
}

interface Result {
  sent: number;
  failed: Array<{ personId: string; name: string; reason: string }>;
  skipped: number;
}

export function BulkInvitations({ cohortId }: { cohortId: string }) {
  const t = useTranslations('bulkInvitations');
  const [plan, setPlan] = useState<Plan | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState<'plan' | 'send' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setBusy('plan');
    setError(null);
    setResult(null);
    try {
      const res = await fetch(`/api/cohorts/${cohortId}/invitations`);
      const payload = await res.json();
      if (!res.ok) {
        setError(payload?.error?.message ?? t('genericError'));
        return;
      }
      setPlan(payload as Plan);
    } catch {
      setError(t('genericError'));
    } finally {
      setBusy(null);
    }
  };

  const send = async () => {
    setBusy('send');
    setError(null);
    try {
      const res = await fetch(`/api/cohorts/${cohortId}/invitations`, { method: 'POST' });
      const payload = await res.json();
      if (!res.ok) {
        setError(payload?.error?.message ?? t('genericError'));
        return;
      }
      setResult(payload as Result);
      setPlan(null);
    } catch {
      setError(t('genericError'));
    } finally {
      setBusy(null);
    }
  };

  const skipped = plan?.candidates.filter((c) => c.skip !== null) ?? [];

  return (
    <div className="space-y-4">
      {error !== null && <Alert severity="error">{error}</Alert>}

      {result !== null && (
        <>
          <Alert severity={result.failed.length > 0 ? 'warning' : 'success'}>
            {t('result', {
              sent: result.sent,
              failed: result.failed.length,
              skipped: result.skipped,
            })}
          </Alert>
          {result.failed.length > 0 && (
            <div className="space-y-2">
              <h3 className="type-overline text-text-muted uppercase">{t('failedTitle')}</h3>
              <ul className="space-y-1">
                {result.failed.map((f) => (
                  <li key={f.personId} className="type-caption text-text-muted">
                    {f.name}: {f.reason}
                  </li>
                ))}
              </ul>
              <p className="type-caption text-text-muted max-w-reading">{t('retryHint')}</p>
            </div>
          )}
        </>
      )}

      {plan === null ? (
        <Button
          type="button"
          variant="secondary"
          loading={busy === 'plan'}
          disabled={busy !== null}
          onClick={() => void load()}
        >
          {t('prepare')}
        </Button>
      ) : (
        <div className="space-y-3">
          <Alert severity={plan.sendable > 0 ? 'info' : 'warning'}>
            {t('confirmSummary', { count: plan.sendable, skipped: skipped.length })}
          </Alert>

          {skipped.length > 0 && (
            <details className="type-body text-text">
              <summary className="min-h-touch flex cursor-pointer items-center">
                {t('whoIsSkipped', { count: skipped.length })}
              </summary>
              <ul className="mt-2 space-y-1">
                {skipped.map((c) => (
                  <li key={c.personId} className="type-caption text-text-muted">
                    {c.name}: {t(`skip.${c.skip}`)}
                  </li>
                ))}
              </ul>
            </details>
          )}

          <div className="flex flex-wrap gap-3">
            <Button
              type="button"
              loading={busy === 'send'}
              disabled={plan.sendable === 0 || busy !== null}
              onClick={() => void send()}
            >
              {t('send', { count: plan.sendable })}
            </Button>
            <Button
              type="button"
              variant="quiet"
              disabled={busy !== null}
              onClick={() => setPlan(null)}
            >
              {t('cancel')}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
