'use client';

/**
 * «Marcar completado» a mano (`progress.override`), con motivo obligatorio.
 * SSOT: plan/06-cohortes-y-personas.md:75, endpoints.md:78.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { FormField, FormInput } from '@/components/atoms/form-field';
import { Button } from '@/components/atoms/button';
import { Alert } from '@/components/atoms/alert';
import { useAnnounce } from '@/lib/a11y/announce';
import { apiErrorText } from '@/lib/http/api-error-text';

export function ProgressOverride({
  enrollmentId,
  assignmentId,
  title,
}: {
  enrollmentId: string;
  assignmentId: string;
  title: string;
}) {
  const t = useTranslations('enrollmentDetail.override');
  const router = useRouter();
  const { announce } = useAnnounce();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) {
    return (
      <Button variant="quiet" onClick={() => setOpen(true)} aria-label={t('openNamed', { title })}>
        {t('open')}
      </Button>
    );
  }

  return (
    <form
      className="space-y-2"
      noValidate
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        try {
          const res = await fetch(
            `/api/cohorts/enrollments/${enrollmentId}/lessons/${assignmentId}/complete`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ reason }),
            }
          );
          const payload = await res.json().catch(() => null);
          if (!res.ok) return setError(apiErrorText(payload, t('error')));
          announce(t('done', { title }));
          setOpen(false);
          router.refresh();
        } catch {
          setError(t('error'));
        } finally {
          setBusy(false);
        }
      }}
    >
      {error && <Alert severity="error">{error}</Alert>}
      <FormField
        label={t('reason')}
        name={`reason-${assignmentId}`}
        required
        hint={t('reasonHint')}
      >
        <FormInput
          name={`reason-${assignmentId}`}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
      </FormField>
      <div className="flex gap-2">
        <Button type="submit" loading={busy} disabled={reason.trim().length < 5}>
          {t('confirm')}
        </Button>
        <Button variant="quiet" onClick={() => setOpen(false)} disabled={busy}>
          {t('cancel')}
        </Button>
      </div>
    </form>
  );
}
