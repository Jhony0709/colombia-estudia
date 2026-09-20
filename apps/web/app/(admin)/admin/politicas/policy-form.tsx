'use client';

import { useId, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/atoms/button';
import { Alert } from '@/components/atoms/alert';
import { Label } from '@/components/atoms/label';
import { useAnnounce } from '@/lib/a11y/announce';
import { apiErrorText } from '@/lib/http/api-error-text';

export function PolicyForm({
  initial,
}: {
  initial: { requireAgreementForNextCohort: boolean; notifyPayerOnOverdue: boolean };
}) {
  const t = useTranslations('policies');
  const router = useRouter();
  const { announce } = useAnnounce();
  const id = useId();
  const [values, setValues] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/policies', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok) return setError(apiErrorText(payload, t('error')));
      announce(t('saved'));
      router.refresh();
    } catch {
      setError(t('error'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      <Flag
        id={`${id}-notify`}
        checked={values.notifyPayerOnOverdue}
        onChange={(v) => setValues({ ...values, notifyPayerOnOverdue: v })}
        label={t('notify')}
        hint={t('notifyHint')}
        warning={t('notifyWarning')}
      />
      <Flag
        id={`${id}-agreement`}
        checked={values.requireAgreementForNextCohort}
        onChange={(v) => setValues({ ...values, requireAgreementForNextCohort: v })}
        label={t('requireAgreement')}
        hint={t('requireAgreementHint')}
        warning={t('requireAgreementWarning')}
      />
      {error && <Alert severity="error">{error}</Alert>}
      <Button type="submit" loading={busy}>
        {t('save')}
      </Button>
    </form>
  );
}

function Flag({
  id,
  checked,
  onChange,
  label,
  hint,
  warning,
}: {
  id: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  hint: string;
  warning: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        aria-describedby={`${id}-hint`}
        className="border-border mt-1 size-5 shrink-0 cursor-pointer rounded-[4px] border accent-[var(--accent-base)]"
      />
      <div>
        <Label htmlFor={id}>{label}</Label>
        <p id={`${id}-hint`} className="type-caption text-text-muted m-0">
          {hint}
        </p>
        {checked && <p className="type-caption text-status-warning-base m-0 mt-1">{warning}</p>}
      </div>
    </div>
  );
}
