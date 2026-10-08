'use client';

/**
 * «Pedir que lo habiliten» (6/10): el siguiente componente de la ruta espera a operación; el
 * estudiante lo pide desde aquí en vez de escribir por fuera. Deja una solicitud en
 * `/solicitudes` y se cierra sola cuando lo habilitan (el aviso `module_unlocked` ya existe).
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { CircleCheck, LockOpen } from 'lucide-react';
import { Button } from '@/components/atoms/button';
import { useAnnounce } from '@/lib/a11y/announce';
import { apiErrorText } from '@/lib/http/api-error-text';
import { cn } from '@/lib/utils';

export function UnlockRequestButton({
  enrollmentId,
  moduleId,
  moduleName,
  requestedAt,
  tone = 'default',
}: {
  enrollmentId: string;
  moduleId: string;
  moduleName: string;
  /** ISO: ya lo pidió y sigue sin resolver. */
  requestedAt: string | null;
  /** Sobre el azul del héroe. */
  tone?: 'default' | 'on-accent';
}) {
  const t = useTranslations('learn.unlockRequest');
  const { announce } = useAnnounce();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [at, setAt] = useState<string | null>(requestedAt);
  const [error, setError] = useState<string | null>(null);

  const request = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/learn/enrollments/${enrollmentId}/modules/${moduleId}/request`,
        { method: 'POST' }
      );
      const payload = await res.json().catch(() => null);
      if (!res.ok) {
        setError(apiErrorText(payload, t('error')));
        return;
      }
      setAt(
        (payload?.data as { requestedAt?: string } | undefined)?.requestedAt ??
          new Date().toISOString()
      );
      announce(t('done', { module: moduleName }));
      // El héroe y la ruta pueden mostrar el mismo componente: que los dos digan «Lo pediste».
      router.refresh();
    } catch {
      setError(t('error'));
    } finally {
      setBusy(false);
    }
  };

  const muted = tone === 'on-accent' ? 'opacity-90' : 'text-text-muted';

  if (at) {
    return (
      <p className={cn('type-caption motion-enter m-0 flex items-start gap-2', muted)}>
        <CircleCheck
          aria-hidden
          className={cn('size-4 shrink-0', tone === 'default' && 'text-status-success-base')}
        />
        {t('requestedOn', {
          date: new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'long' }).format(
            new Date(at)
          ),
        })}
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <Button type="button" variant="secondary" loading={busy} onClick={() => void request()}>
        <LockOpen aria-hidden className="size-4 shrink-0" />
        {t('cta')}
        <span className="sr-only"> {moduleName}</span>
      </Button>
      {error && (
        <p
          role="alert"
          className={cn('type-caption m-0', tone === 'default' && 'text-status-error-base')}
        >
          {error}
        </p>
      )}
    </div>
  );
}
