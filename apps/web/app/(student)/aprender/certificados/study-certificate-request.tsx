'use client';

/**
 * «Pedir certificado de estudios» (23/11): lugar de expedición y motivo → aviso a operación.
 * El nombre y el documento ya están en la ficha; aquí no se piden.
 */

import { useId, useState, type FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/atoms/button';
import { Alert } from '@/components/atoms/alert';
import { Label } from '@/components/atoms/label';
import { FormField, FormInput } from '@/components/atoms/form-field';
import { Sheet } from '@/components/organisms/sheet';
import { useAnnounce } from '@/lib/a11y/announce';
import { apiErrorText } from '@/lib/http/api-error-text';

export function StudyCertificateRequest() {
  const t = useTranslations('learn.certificates.study');
  const { announce } = useAnnounce();
  const id = useId();
  const [open, setOpen] = useState(false);
  const [documentPlace, setDocumentPlace] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const ready = documentPlace.trim().length >= 2 && reason.trim().length >= 3;

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!ready) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/learn/certificates/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentPlace: documentPlace.trim(), reason: reason.trim() }),
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
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        {t('cta')}
      </Button>
      <Sheet open={open} onOpenChange={setOpen} title={t('title')}>
        {sent ? (
          <p role="status" className="type-body text-text">
            {t('sent')}
          </p>
        ) : (
          <form onSubmit={onSubmit} noValidate className="space-y-4">
            <FormField label={t('documentPlace')} name="documentPlace" required>
              <FormInput
                name="documentPlace"
                value={documentPlace}
                maxLength={120}
                onChange={(e) => setDocumentPlace(e.target.value)}
                required
              />
            </FormField>
            <div className="space-y-1.5">
              <Label htmlFor={`${id}-reason`}>{t('reason')}</Label>
              <textarea
                id={`${id}-reason`}
                rows={3}
                maxLength={500}
                required
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="rounded-control border-border bg-surface-sunken text-text type-body focus:border-accent-base w-full border px-3 py-2"
              />
            </div>
            {error && <Alert severity="error">{error}</Alert>}
            <div className="flex gap-2">
              <Button type="submit" loading={busy} disabled={!ready}>
                {t('send')}
              </Button>
              <Button variant="quiet" onClick={() => setOpen(false)} disabled={busy}>
                {t('cancel')}
              </Button>
            </div>
          </form>
        )}
      </Sheet>
    </>
  );
}
