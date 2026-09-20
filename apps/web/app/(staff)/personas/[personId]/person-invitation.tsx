'use client';

/**
 * La invitación de una persona: en qué estado está, quién la mandó y cuándo, y el enlace.
 * SSOT: plan/03-identidad-y-acceso.md «Invitación», petición del 18/9.
 *
 * Contesta las dos preguntas que operación hace de verdad: **¿ya se le envió?** y **¿me das
 * el enlace?**. Antes la ficha decía «Sin invitación» y nada más; para saber si a alguien se
 * le había mandado algo había que mirar la auditoría, y el enlace no estaba en ninguna parte.
 *
 * Sobre el enlace, que es la decisión que hay detrás de esta pantalla: la plataforma guarda
 * **la huella del token, no el token** (`Invitation.tokenHash`). Así, quien tenga acceso a la
 * base no puede entrar suplantando a nadie con una invitación pendiente. El precio es que el
 * enlace **solo existe en el momento de crearlo**: se enseña una vez, aquí, y no se vuelve a
 * poder recuperar. Perdido, se reenvía —y reenviar invalida el anterior—.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations, useFormatter } from 'next-intl';
import { Button } from '@/components/atoms/button';
import { Alert } from '@/components/atoms/alert';
import { PageSection } from '@/components/templates/page';
import { apiErrorText } from '@/lib/http/api-error-text';

/**
 * Las fechas llegan **ya formateadas desde el servidor**, y no como ISO para formatear aquí.
 *
 * `Intl` no da el mismo texto en Node y en el navegador: entre «5:49» y «a. m.» uno pone un
 * espacio fino inseparable y el otro no, según la versión de ICU de cada uno. React lo ve
 * como texto distinto y tira el árbol entero para volver a pintarlo en el cliente —un error
 * de hidratación por una fecha—. Se vio en la consola, con las dos cadenas idénticas a la
 * vista y distintas byte a byte.
 *
 * Formatear en el servidor lo quita de raíz: el cliente pinta la cadena que recibió.
 */
export interface InvitationView {
  state: 'account' | 'accepted' | 'pending' | 'expired' | 'none';
  hasEmail: boolean;
  expiresAtLabel: string | null;
  acceptedAtLabel: string | null;
  history: Array<{
    id: string;
    sentAtLabel: string;
    expiresAtLabel: string;
    acceptedAtLabel: string | null;
    sentBy: string;
    dead: boolean;
  }>;
  mailConfigured: boolean;
}

interface FreshLink {
  inviteUrl: string;
  expiresAt: string;
  emailDelivered: boolean;
}

export function PersonInvitation({
  personId,
  invitation,
}: {
  personId: string;
  invitation: InvitationView;
}) {
  const t = useTranslations('personInvitation');
  const format = useFormatter();
  const router = useRouter();

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fresh, setFresh] = useState<FreshLink | null>(null);
  const [copied, setCopied] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const isResend = invitation.state === 'pending' || invitation.state === 'expired';

  /**
   * Solo para el enlace recién creado: ese bloque aparece **después** de una interacción, así
   * que nunca se renderiza en el servidor y no hay nada con lo que desencajar.
   */
  const day = (iso: string) =>
    format.dateTime(new Date(iso), { dateStyle: 'medium', timeStyle: 'short' });

  const send = async () => {
    setBusy(true);
    setError(null);
    setCopied(false);
    try {
      // Dos rutas para la misma operación, a propósito: la auditoría distingue un primer
      // envío de un reenvío, y esa diferencia importa al reconstruir qué pasó con alguien.
      const res = isResend
        ? await fetch(`/api/people/${personId}/reinvite`, { method: 'POST' })
        : await fetch('/api/people/invitations', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ personId }),
          });

      const payload = await res.json().catch(() => null);

      if (!res.ok) {
        setError(apiErrorText(payload, t('sendError')));
        return;
      }

      const data = (payload?.data ?? payload) as FreshLink;
      setFresh(data);
      setConfirming(false);
      router.refresh();
    } catch {
      setError(t('sendError'));
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    if (!fresh) return;
    try {
      await navigator.clipboard.writeText(fresh.inviteUrl);
      setCopied(true);
    } catch {
      // Sin permiso de portapapeles el enlace sigue en pantalla y se puede seleccionar a
      // mano: no hace falta decir nada, y un error aquí asustaría sin motivo.
      setCopied(false);
    }
  };

  return (
    <PageSection id="invitacion" title={t('title')} card>
      {error !== null && <Alert severity="error">{error}</Alert>}

      <p className="type-body text-text max-w-reading">
        {t(`state.${invitation.state}`)}
        {invitation.state === 'pending' && invitation.expiresAtLabel !== null && (
          <span className="text-text-muted">
            {' · '}
            {t('expiresOn', { date: invitation.expiresAtLabel })}
          </span>
        )}
        {invitation.state === 'accepted' && invitation.acceptedAtLabel !== null && (
          <span className="text-text-muted">
            {' · '}
            {t('acceptedOn', { date: invitation.acceptedAtLabel })}
          </span>
        )}
      </p>

      {/* Sin correo no hay invitación que enviar, y se dice antes de que alguien lo intente. */}
      {!invitation.hasEmail && invitation.state === 'none' && (
        <Alert severity="warning">{t('noEmail')}</Alert>
      )}

      {/* La verdad sobre el correo. «Invitación enviada» cuando no salió nada es lo que hace
          que alguien espere tres días a que un estudiante entre. */}
      {!invitation.mailConfigured && <Alert severity="warning">{t('mailNotConfigured')}</Alert>}

      {fresh !== null && (
        <div className="bg-surface-sunken rounded-control space-y-3 p-4">
          <p className="type-body-emphasis text-text">
            {fresh.emailDelivered ? t('sentByEmail') : t('sentNoEmail')}
          </p>
          <p className="type-caption text-text-muted max-w-reading">{t('linkOnlyOnce')}</p>

          {/* Un `input` de solo lectura y no un `<p>`: se selecciona entero con un clic, se
              copia con el teclado y un lector de pantalla lo lee como un valor, no como
              prosa. */}
          <input
            readOnly
            value={fresh.inviteUrl}
            aria-label={t('linkLabel')}
            onFocus={(event) => event.target.select()}
            className="border-border bg-surface-base text-text type-caption rounded-control w-full border p-2 font-mono"
          />

          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" variant="secondary" onClick={() => void copy()}>
              {t('copy')}
            </Button>
            <span role="status" className="type-caption text-text-muted">
              {copied ? t('copied') : ''}
            </span>
          </div>

          <p className="type-caption text-text-muted">
            {t('expiresOn', { date: day(fresh.expiresAt) })}
          </p>
        </div>
      )}

      {invitation.state !== 'account' && invitation.state !== 'accepted' && (
        <div className="flex flex-wrap items-center gap-3">
          {/* Reenviar invalida el enlace anterior: eso se confirma, no se hace de un clic.
              Un primer envío no rompe nada, así que va directo. */}
          {isResend && !confirming ? (
            <Button type="button" variant="secondary" onClick={() => setConfirming(true)}>
              {t('resend')}
            </Button>
          ) : isResend ? (
            <>
              <span className="type-body text-text max-w-reading">{t('resendConfirm')}</span>
              <Button type="button" loading={busy} onClick={() => void send()}>
                {t('resendYes')}
              </Button>
              <Button type="button" variant="quiet" onClick={() => setConfirming(false)}>
                {t('resendNo')}
              </Button>
            </>
          ) : (
            <Button
              type="button"
              loading={busy}
              disabled={!invitation.hasEmail}
              onClick={() => void send()}
            >
              {t('send')}
            </Button>
          )}
        </div>
      )}

      {invitation.history.length > 0 && (
        <details className="bg-surface-sunken rounded-control p-3">
          <summary className="type-label text-text min-h-touch flex cursor-pointer items-center">
            {t('historyTitle', { count: invitation.history.length })}
          </summary>
          <ul className="mt-2 space-y-2">
            {invitation.history.map((entry) => (
              <li key={entry.id} className="type-caption text-text max-w-reading">
                {t('historyLine', { date: entry.sentAtLabel, who: entry.sentBy })}
                <span className="text-text-muted">
                  {' · '}
                  {entry.acceptedAtLabel !== null
                    ? t('historyAccepted', { date: entry.acceptedAtLabel })
                    : entry.dead
                      ? t('historyDead')
                      : t('historyLive', { date: entry.expiresAtLabel })}
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </PageSection>
  );
}
