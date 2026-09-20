'use client';

/**
 * Anonimizar (Ley 1581): irreversible, con motivo y confirmación escrita. Solo
 * `institution.manage`. Al final de la ficha, lejos de todo lo demás.
 */

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { FormField, FormInput } from '@/components/atoms/form-field';
import { Button } from '@/components/atoms/button';
import { Alert } from '@/components/atoms/alert';
import { useAnnounce } from '@/lib/a11y/announce';
import { apiErrorText } from '@/lib/http/api-error-text';

export function AnonymizePerson({ personId, name }: { personId: string; name: string }) {
  const t = useTranslations('people.anonymize');
  const router = useRouter();
  const { announce } = useAnnounce();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/people/${personId}/anonymize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok) return setError(apiErrorText(payload, t('error')));
      announce(t('done'));
      router.refresh();
    } catch {
      setError(t('error'));
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <Button variant="secondary" onClick={() => setOpen(true)}>
        {t('open')}
      </Button>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-3">
      <Alert severity="warning">{t('warning')}</Alert>
      <FormField label={t('reason')} name="anonymize-reason" required hint={t('reasonHint')}>
        <FormInput
          name="anonymize-reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
      </FormField>
      <FormField label={t('confirmLabel', { name })} name="anonymize-confirm" required>
        <FormInput
          name="anonymize-confirm"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          autoComplete="off"
        />
      </FormField>
      {error && <Alert severity="error">{error}</Alert>}
      <div className="flex gap-2">
        <Button
          type="submit"
          loading={busy}
          disabled={reason.trim().length < 10 || typed.trim() !== name}
        >
          {t('confirm')}
        </Button>
        <Button variant="quiet" onClick={() => setOpen(false)} disabled={busy}>
          {t('cancel')}
        </Button>
      </div>
    </form>
  );
}
