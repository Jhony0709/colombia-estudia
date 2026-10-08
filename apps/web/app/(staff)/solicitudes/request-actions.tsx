'use client';

/**
 * Las acciones de una fila de `/solicitudes` (6/10). Hacer lo pedido usa los mismos caminos que
 * la ficha —la hoja de matrícula, el PUT de habilitación— y la solicitud se cierra sola; aquí
 * solo se descarta a mano.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { LockOpen } from 'lucide-react';
import { Button } from '@/components/atoms/button';
import { useAnnounce } from '@/lib/a11y/announce';
import { apiErrorText } from '@/lib/http/api-error-text';

function useSend() {
  const router = useRouter();
  const { announce } = useAnnounce();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = async (url: string, method: 'PUT' | 'PATCH', body: unknown, ok: string) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok) {
        setError(apiErrorText(payload, 'No se pudo completar la acción.'));
        return false;
      }
      announce(ok);
      router.refresh();
      return true;
    } catch {
      setError('No se pudo completar la acción.');
      return false;
    } finally {
      setBusy(false);
    }
  };
  return { busy, error, send };
}

/** Habilitar en un clic, sin fechas; con fechas, desde la ficha de la matrícula. */
export function UnlockAction({
  enrollmentId,
  moduleId,
  moduleName,
}: {
  enrollmentId: string;
  moduleId: string;
  moduleName: string;
}) {
  const t = useTranslations('requests.actions');
  const { busy, error, send } = useSend();
  return (
    <span className="inline-flex flex-col items-start gap-1">
      <Button
        type="button"
        loading={busy}
        onClick={() =>
          void send(
            `/api/cohorts/enrollments/${enrollmentId}/modules/${moduleId}`,
            'PUT',
            { unlocked: true },
            t('unlocked', { module: moduleName })
          )
        }
      >
        <LockOpen aria-hidden className="size-4 shrink-0" />
        {t('unlock')}
        <span className="sr-only"> {moduleName}</span>
      </Button>
      {error && (
        <span role="alert" className="type-caption text-status-error-base">
          {error}
        </span>
      )}
    </span>
  );
}

/** Descartar pide confirmación en línea, como archivar en Programas: un segundo botón. */
export function DismissAction({ requestId, label }: { requestId: string; label: string }) {
  const t = useTranslations('requests.actions');
  const { busy, error, send } = useSend();
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <Button type="button" variant="quiet" onClick={() => setConfirming(true)}>
        {t('dismiss')}
        <span className="sr-only"> {label}</span>
      </Button>
    );
  }
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <Button
        type="button"
        variant="secondary"
        loading={busy}
        onClick={() =>
          void send(
            `/api/access-requests/${requestId}`,
            'PATCH',
            { action: 'dismiss' },
            t('dismissed')
          )
        }
      >
        {t('confirmDismiss')}
      </Button>
      <Button type="button" variant="quiet" onClick={() => setConfirming(false)}>
        {t('cancel')}
      </Button>
      {error && (
        <span role="alert" className="type-caption text-status-error-base">
          {error}
        </span>
      )}
    </span>
  );
}
