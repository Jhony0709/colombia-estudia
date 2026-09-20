'use client';

/**
 * Enrol, withdraw and extend, from the cohort detail.
 * SSOT: plan/06-cohortes-y-personas.md:72-77.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { FormField, FormInput } from '@/components/atoms/form-field';
import { Button } from '@/components/atoms/button';
import { Alert } from '@/components/atoms/alert';

function useEnrollmentMutation() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  async function send(
    url: string,
    method: 'POST' | 'PATCH',
    body: unknown,
    okMessage: string
  ): Promise<boolean> {
    setBusy(true);
    setError(null);
    setDone(null);
    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const payload = await res.json();
      if (!res.ok) {
        setError(payload?.error?.message ?? 'No se pudo completar la acción.');
        return false;
      }
      // Un aviso del servidor (p. ej., la política de cartera) se enseña junto al éxito.
      const warning = (payload?.data as { warning?: string | null } | undefined)?.warning;
      setDone(warning ? `${okMessage} ${warning}` : okMessage);
      router.refresh();
      return true;
    } catch {
      setError('No se pudo completar la acción.');
      return false;
    } finally {
      setBusy(false);
    }
  }

  return { busy, error, done, send };
}

export function EnrollForm({ cohortId, disabled }: { cohortId: string; disabled: boolean }) {
  const t = useTranslations('enrollments');
  const { busy, error, done, send } = useEnrollmentMutation();
  const [handle, setHandle] = useState('');

  if (disabled) {
    return <p className="type-body text-text-muted">{t('closedForEnrolment')}</p>;
  }

  return (
    <form
      className="max-w-reading flex flex-wrap items-end gap-2"
      noValidate
      onSubmit={async (e) => {
        e.preventDefault();
        const ok = await send(
          `/api/cohorts/${cohortId}/enrollments`,
          'POST',
          { personHandle: handle },
          t('enrolled')
        );
        if (ok) setHandle('');
      }}
    >
      <div className="min-w-64 flex-1">
        <FormField
          label={t('personHandle')}
          name="personHandle"
          required
          hint={t('personHandleHint')}
        >
          <FormInput
            name="personHandle"
            value={handle}
            onChange={(e) => setHandle(e.target.value)}
          />
        </FormField>
      </div>
      <Button type="submit" variant="secondary" loading={busy} disabled={handle.trim() === ''}>
        {t('enrol')}
      </Button>
      <div role="status" aria-live="polite" className="w-full">
        {error && <Alert severity="error">{error}</Alert>}
        {done && <Alert severity="success">{done}</Alert>}
      </div>
    </form>
  );
}

export function EnrollmentActions({
  enrollmentId,
  name,
  status,
}: {
  enrollmentId: string;
  name: string;
  status: string;
}) {
  const t = useTranslations('enrollments');
  const { busy, error, send } = useEnrollmentMutation();
  const [mode, setMode] = useState<'none' | 'withdraw' | 'extend'>('none');
  const [reason, setReason] = useState('');
  const [accessUntil, setAccessUntil] = useState('');

  if (status === 'WITHDRAWN') {
    return <span className="type-caption text-text-muted">{t('alreadyWithdrawn')}</span>;
  }

  return (
    <div className="space-y-2">
      {error && <Alert severity="error">{error}</Alert>}

      {mode === 'none' && (
        <div className="flex gap-2">
          <Button
            variant="quiet"
            onClick={() => setMode('extend')}
            aria-label={t('extendNamed', { name })}
          >
            {t('extend')}
          </Button>
          <Button
            variant="quiet"
            onClick={() => setMode('withdraw')}
            aria-label={t('withdrawNamed', { name })}
          >
            {t('withdraw')}
          </Button>
        </div>
      )}

      {mode === 'withdraw' && (
        <form
          className="space-y-2"
          noValidate
          onSubmit={async (e) => {
            e.preventDefault();
            const ok = await send(
              `/api/cohorts/enrollments/${enrollmentId}`,
              'PATCH',
              { op: 'withdraw', reason },
              t('withdrawn')
            );
            if (ok) setMode('none');
          }}
        >
          <FormField
            label={t('reason')}
            name={`reason-${enrollmentId}`}
            required
            hint={t('reasonHint')}
          >
            <FormInput
              name={`reason-${enrollmentId}`}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </FormField>
          <div className="flex gap-2">
            <Button type="submit" loading={busy} disabled={reason.trim() === ''}>
              {t('confirmWithdraw')}
            </Button>
            <Button variant="quiet" onClick={() => setMode('none')} disabled={busy}>
              {t('cancel')}
            </Button>
          </div>
        </form>
      )}

      {mode === 'extend' && (
        <form
          className="space-y-2"
          noValidate
          onSubmit={async (e) => {
            e.preventDefault();
            const ok = await send(
              `/api/cohorts/enrollments/${enrollmentId}`,
              'PATCH',
              { op: 'extend', accessUntil },
              t('extended')
            );
            if (ok) setMode('none');
          }}
        >
          <FormField
            label={t('newAccessUntil')}
            name={`accessUntil-${enrollmentId}`}
            required
            hint={t('newAccessUntilHint')}
          >
            <FormInput
              name={`accessUntil-${enrollmentId}`}
              type="date"
              value={accessUntil}
              onChange={(e) => setAccessUntil(e.target.value)}
            />
          </FormField>
          <div className="flex gap-2">
            <Button type="submit" loading={busy} disabled={accessUntil === ''}>
              {t('confirmExtend')}
            </Button>
            <Button variant="quiet" onClick={() => setMode('none')} disabled={busy}>
              {t('cancel')}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
