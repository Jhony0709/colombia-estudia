'use client';

/**
 * «Reportar un problema»: un motivo de la lista y un texto opcional → `POST …/report`.
 * Desde el 23/9 es una hoja que abre el menú del tema (`lesson-tools.tsx`): una salida de
 * emergencia no ocupa sitio al pie de cada tema.
 */

import { useId, useState, type FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/atoms/button';
import { Alert } from '@/components/atoms/alert';
import { Label } from '@/components/atoms/label';
import { FormField, FormSelect } from '@/components/atoms/form-field';
import { Sheet } from '@/components/organisms/sheet';
import { useAnnounce } from '@/lib/a11y/announce';
import { apiErrorText } from '@/lib/http/api-error-text';

const REASONS = [
  'CONTENT_ERROR',
  'MEDIA_BROKEN',
  'ACCESSIBILITY',
  'CANNOT_COMPLETE',
  'OTHER',
] as const;

export function ReportProblem({
  assignmentId,
  open,
  onOpenChange,
}: {
  assignmentId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations('learn.report');
  const { announce } = useAnnounce();
  const id = useId();
  const [reason, setReason] = useState<(typeof REASONS)[number]>('CONTENT_ERROR');
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/learn/lessons/${assignmentId}/report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason, details: details.trim() || undefined }),
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok) return setError(apiErrorText(payload, t('error')));
      setSent(true);
      announce(t('sent'));
    } catch {
      setError(t('error'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={t('title')}>
      {sent ? (
        <p role="status" className="type-body text-text">
          {t('sent')}
        </p>
      ) : (
        <form onSubmit={onSubmit} noValidate className="space-y-4">
          <FormField label={t('reason')} name="reason">
            <FormSelect
              name="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value as (typeof REASONS)[number])}
            >
              {REASONS.map((r) => (
                <option key={r} value={r}>
                  {t(`reasons.${r}`)}
                </option>
              ))}
            </FormSelect>
          </FormField>
          <div className="space-y-1.5">
            <Label htmlFor={`${id}-details`}>{t('details')}</Label>
            <textarea
              id={`${id}-details`}
              rows={3}
              maxLength={1_000}
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              className="rounded-control border-border bg-surface-sunken text-text type-body focus:border-accent-base w-full border px-3 py-2"
            />
          </div>
          {error && <Alert severity="error">{error}</Alert>}
          <div className="flex gap-2">
            <Button type="submit" loading={busy}>
              {t('send')}
            </Button>
            <Button variant="quiet" onClick={() => onOpenChange(false)} disabled={busy}>
              {t('cancel')}
            </Button>
          </div>
        </form>
      )}
    </Sheet>
  );
}
