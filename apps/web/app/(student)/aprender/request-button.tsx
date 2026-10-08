'use client';

/**
 * «Quiero inscribirme» en un curso de pago (6/10). No matricula: avisa al equipo
 * (`POST …/request`), que arma el plan de pagos y, si es menor, el acudiente. Después se dice
 * qué pasará y, si la institución tiene WhatsApp, se ofrece escribir ya.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { CircleCheck, MessageCircle } from 'lucide-react';
import { Button } from '@/components/atoms/button';
import { useAnnounce } from '@/lib/a11y/announce';
import { apiErrorText } from '@/lib/http/api-error-text';

export function RequestButton({
  cohortId,
  moduleId,
  courseName,
  whatsappHref,
  requestedAt = null,
}: {
  cohortId: string;
  moduleId: string;
  courseName: string;
  /** `wa.me` con el mensaje ya escrito; nulo si la institución no tiene teléfono. */
  whatsappHref: string | null;
  /** ISO: ya lo había pedido y sigue sin resolver; se dice cuándo en vez del botón. */
  requestedAt?: string | null;
}) {
  const t = useTranslations('learn.catalog');
  const { announce } = useAnnounce();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  // `fresh`: lo acaba de pedir en esta visita; si no, lo pidió antes y se dice cuándo.
  const [done, setDone] = useState<{ at: string; fresh: boolean } | null>(
    requestedAt ? { at: requestedAt, fresh: false } : null
  );
  const [error, setError] = useState<string | null>(null);

  const request = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/learn/catalog/${cohortId}/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ moduleId }),
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok) {
        setError(apiErrorText(payload, t('requestError')));
        return;
      }
      const at = (payload?.data as { requestedAt?: string } | undefined)?.requestedAt;
      setDone({ at: at ?? new Date().toISOString(), fresh: true });
      announce(t('requested'));
      // Las otras tarjetas del mismo programa también tienen que saberlo.
      router.refresh();
    } catch {
      setError(t('requestError'));
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <div className="motion-enter space-y-3">
        <p className="type-caption text-text m-0 flex gap-2">
          <CircleCheck aria-hidden className="text-status-success-base size-4 shrink-0" />
          {done.fresh
            ? t('requested')
            : t('requestedOn', {
                date: new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'long' }).format(
                  new Date(done.at)
                ),
              })}
        </p>
        {whatsappHref && (
          <Button asChild variant="secondary">
            <a href={whatsappHref} target="_blank" rel="noopener noreferrer">
              <MessageCircle aria-hidden className="size-4" />
              {t('writeUs')}
              <span className="sr-only"> {t('newTab')}</span>
            </a>
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Button type="button" variant="secondary" loading={busy} onClick={() => void request()}>
        {t('request')}
        <span className="sr-only"> {courseName}</span>
      </Button>
      {error && (
        <p role="alert" className="type-caption text-status-error-base m-0">
          {error}
        </p>
      )}
    </div>
  );
}
