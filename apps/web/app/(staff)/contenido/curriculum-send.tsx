'use client';

/**
 * El envío compartido de las pantallas del currículo.
 * SSOT: plan/06-cohortes-y-personas.md:19-22 (§2).
 *
 * Programas y asignaturas escriben contra `/api/admin/*` con la misma forma —POST o PATCH,
 * un mensaje de éxito, `router.refresh()`— y anuncian el resultado en la misma región viva.
 * Estaba una vez cuando las dos vivían en la misma pantalla; al separarlas, o se duplicaba
 * o salía aquí.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { apiErrorText } from '@/lib/http/api-error-text';
import { Alert } from '@/components/atoms/alert';

export type Send = (
  url: string,
  method: 'POST' | 'PATCH',
  body: unknown,
  okMessage: string
) => Promise<boolean>;

export type Feedback = { kind: 'ok' | 'error'; message: string } | null;

export function useCurriculumSend(): { busy: boolean; feedback: Feedback; send: Send } {
  const t = useTranslations('admin.curriculum');
  const router = useRouter();
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [busy, setBusy] = useState(false);

  const send: Send = async (url, method, body, okMessage) => {
    setBusy(true);
    setFeedback(null);
    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const payload = await res.json();
      if (!res.ok) {
        setFeedback({ kind: 'error', message: apiErrorText(payload, t('genericError')) });
        return false;
      }
      setFeedback({ kind: 'ok', message: okMessage });
      router.refresh();
      return true;
    } catch {
      setFeedback({ kind: 'error', message: t('genericError') });
      return false;
    } finally {
      setBusy(false);
    }
  };

  return { busy, feedback, send };
}

/** La región viva. Existe siempre, vacía o no: si nace con el mensaje, no se anuncia. */
export function CurriculumFeedback({ feedback }: { feedback: Feedback }) {
  return (
    <div role="status" aria-live="polite">
      {feedback && (
        <Alert severity={feedback.kind === 'ok' ? 'success' : 'error'}>{feedback.message}</Alert>
      )}
    </div>
  );
}
