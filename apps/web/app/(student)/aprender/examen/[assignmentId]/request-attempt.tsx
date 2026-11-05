'use client';

/**
 * Otra oportunidad (5/11, Kris): perdió el examen con todos los intentos y la ruta se detuvo.
 * Pedirla deja la solicitud para operación (`POST …/request`) y abre WhatsApp con el código ya
 * escrito: así el asesor la encuentra y el aviso de que se concedió llega a ese chat.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { CircleCheck, MessageCircle } from 'lucide-react';
import { Button } from '@/components/atoms/button';
import { Alert } from '@/components/atoms/alert';
import { useAnnounce } from '@/lib/a11y/announce';
import { apiErrorText } from '@/lib/http/api-error-text';
import { whatsappUrl } from '@/features/marketing/contact-links';

export function RequestAttempt({
  assignmentId,
  title,
  name,
  phone,
  request,
}: {
  assignmentId: string;
  title: string;
  name: string;
  /** El WhatsApp del negocio; nulo sin teléfono: solo queda la solicitud en la plataforma. */
  phone: string | null;
  /** La que ya pidió y sigue abierta. */
  request: { id: string; at: string } | null;
}) {
  const t = useTranslations('learn.assessment.anotherChance');
  const { announce } = useAnnounce();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ id: string; at: string; fresh: boolean } | null>(
    request ? { ...request, fresh: false } : null
  );

  const ask = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/learn/assessments/${assignmentId}/request`, { method: 'POST' });
      const payload = await res.json().catch(() => null);
      if (!res.ok) {
        setError(apiErrorText(payload, t('error')));
        return;
      }
      const data = payload?.data as { requestId?: string; requestedAt?: string } | undefined;
      if (!data?.requestId) {
        setError(t('error'));
        return;
      }
      setDone({
        id: data.requestId,
        at: data.requestedAt ?? new Date().toISOString(),
        fresh: true,
      });
      announce(t('requested'));
      router.refresh();
    } catch {
      setError(t('error'));
    } finally {
      setBusy(false);
    }
  };

  const wa = done ? whatsappUrl(phone, t('message', { name, title, code: done.id })) : null;

  return (
    <div className="space-y-3">
      <Alert severity="warning">{t('body')}</Alert>
      {done ? (
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
          {wa && (
            <Button asChild>
              <a href={wa} target="_blank" rel="noopener noreferrer">
                <MessageCircle aria-hidden className="size-4" />
                {t('whatsapp')}
                <span className="sr-only"> {t('newTab')}</span>
              </a>
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          <Button type="button" loading={busy} onClick={() => void ask()}>
            {t('ask')}
          </Button>
          {error && (
            <p role="alert" className="type-caption text-status-error-base m-0">
              {error}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
