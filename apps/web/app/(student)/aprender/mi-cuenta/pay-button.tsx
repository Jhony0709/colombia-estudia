'use client';

/** «Pagar en línea»: pide el checkout de Wompi y manda allí. La URL la firma el servidor. */

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/atoms/button';
import { Alert } from '@/components/atoms/alert';
import { apiErrorText } from '@/lib/http/api-error-text';

export function PayButton({ installmentId }: { installmentId: string }) {
  const t = useTranslations('learn.account');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pay = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/learn/account/pay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ installmentId }),
      });
      const payload = (await res.json().catch(() => null)) as { data?: { url: string } } | null;
      if (!res.ok || !payload?.data) return setError(apiErrorText(payload, t('payError')));
      window.location.assign(payload.data.url);
    } catch {
      setError(t('payError'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2">
      <Button onClick={() => void pay()} loading={busy}>
        {t('payOnline')}
      </Button>
      {error && <Alert severity="error">{error}</Alert>}
    </div>
  );
}
