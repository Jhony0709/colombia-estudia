'use client';

/**
 * «Pagar en línea»: pide el link de pago de Bold y manda allí, o lo pide por correo (19/11).
 * Vivía en `app/(student)/aprender/mi-cuenta`; desde la Fase C (23/9) también paga el
 * acudiente desde `/familia`, así que es del feature y no de un área.
 */

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/atoms/button';
import { Alert } from '@/components/atoms/alert';
import { apiErrorText } from '@/lib/http/api-error-text';

export function PayButton({
  installmentId,
  returnPath,
}: {
  installmentId: string;
  /** Adónde vuelve el checkout. Por defecto, «Mi cuenta» del estudiante. */
  returnPath?: string;
}) {
  const t = useTranslations('learn.account');
  const [busy, setBusy] = useState<'redirect' | 'email' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [emailed, setEmailed] = useState(false);

  const pay = async (delivery: 'redirect' | 'email') => {
    setBusy(delivery);
    setError(null);
    setEmailed(false);
    try {
      const res = await fetch('/api/learn/account/pay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ installmentId, delivery, ...(returnPath ? { returnPath } : {}) }),
      });
      const payload = (await res.json().catch(() => null)) as { data?: { url: string } } | null;
      if (!res.ok || !payload?.data) return setError(apiErrorText(payload, t('payError')));
      if (delivery === 'email') return setEmailed(true);
      window.location.assign(payload.data.url);
    } catch {
      setError(t('payError'));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-3">
        <Button
          onClick={() => void pay('redirect')}
          loading={busy === 'redirect'}
          disabled={busy !== null}
        >
          {t('payOnline')}
        </Button>
        <Button
          variant="quiet"
          onClick={() => void pay('email')}
          loading={busy === 'email'}
          disabled={busy !== null}
        >
          {t('payByEmail')}
        </Button>
      </div>
      {emailed && <Alert severity="success">{t('payEmailSent')}</Alert>}
      {error && <Alert severity="error">{error}</Alert>}
    </div>
  );
}
