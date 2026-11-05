'use client';

/**
 * Las acciones de un chat (5/11): tomarlo, responder y cerrarlo. Después de cada una se
 * refresca la página: el hilo lo pinta el servidor.
 */

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Send } from 'lucide-react';
import { Button } from '@/components/atoms/button';
import { Label } from '@/components/atoms/label';
import { useAnnounce } from '@/lib/a11y/announce';
import { apiErrorText } from '@/lib/http/api-error-text';
import { cn } from '@/lib/utils';

function usePost(conversationId: string) {
  const t = useTranslations('messaging.actions');
  const router = useRouter();
  const { announce } = useAnnounce();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const post = async (action: 'take' | 'messages' | 'close', ok: string, body?: unknown) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/conversations/${conversationId}/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body ?? {}),
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok) {
        setError(apiErrorText(payload, t('error')));
        return false;
      }
      announce(ok);
      router.refresh();
      return true;
    } catch {
      setError(t('error'));
      return false;
    } finally {
      setBusy(false);
    }
  };
  return { busy, error, post };
}

function ErrorText({ error }: { error: string | null }) {
  if (!error) return null;
  return (
    <p role="alert" className="type-caption text-status-error-base m-0">
      {error}
    </p>
  );
}

export function TakeAction({ conversationId }: { conversationId: string }) {
  const t = useTranslations('messaging.actions');
  const { busy, error, post } = usePost(conversationId);
  return (
    <div className="space-y-2">
      <Button type="button" loading={busy} onClick={() => void post('take', t('taken'))}>
        {t('take')}
      </Button>
      <ErrorText error={error} />
    </div>
  );
}

export function ReplyForm({ conversationId }: { conversationId: string }) {
  const t = useTranslations('messaging.actions');
  const { busy, error, post } = usePost(conversationId);
  const [text, setText] = useState('');

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!text.trim()) return;
    if (await post('messages', t('sent'), { body: text })) setText('');
  };

  return (
    <form onSubmit={(e) => void onSubmit(e)} className="space-y-2">
      <Label htmlFor="chat-reply">{t('replyLabel')}</Label>
      <textarea
        id="chat-reply"
        name="body"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          // Enter envía; Mayús+Enter es salto de línea, como en WhatsApp Web. En el celular
          // Enter es salto de línea: se envía con el botón.
          if (
            e.key === 'Enter' &&
            !e.shiftKey &&
            !e.nativeEvent.isComposing &&
            !window.matchMedia('(pointer: coarse)').matches
          ) {
            e.preventDefault();
            e.currentTarget.form?.requestSubmit();
          }
        }}
        rows={3}
        maxLength={4_000}
        disabled={busy}
        aria-describedby="chat-reply-hint"
        className={cn(
          'rounded-control border-border bg-surface-sunken text-text type-body w-full border px-3 py-2',
          'focus:border-accent-base duration-fast ease-standard transition-colors'
        )}
      />
      <p id="chat-reply-hint" className="type-caption text-text-muted m-0">
        {t('replyHint')}
      </p>
      <Button type="submit" loading={busy} disabled={!text.trim()}>
        <Send aria-hidden className="size-4 shrink-0" />
        {t('send')}
      </Button>
      <ErrorText error={error} />
    </form>
  );
}

/** Cerrar pide confirmación en línea, como descartar una solicitud. */
export function CloseAction({ conversationId }: { conversationId: string }) {
  const t = useTranslations('messaging.actions');
  const { busy, error, post } = usePost(conversationId);
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <Button type="button" variant="quiet" onClick={() => setConfirming(true)}>
        {t('close')}
      </Button>
    );
  }
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <Button
        type="button"
        variant="secondary"
        loading={busy}
        onClick={() => void post('close', t('closed'))}
      >
        {t('confirmClose')}
      </Button>
      <Button type="button" variant="quiet" onClick={() => setConfirming(false)}>
        {t('cancel')}
      </Button>
      <ErrorText error={error} />
    </span>
  );
}
