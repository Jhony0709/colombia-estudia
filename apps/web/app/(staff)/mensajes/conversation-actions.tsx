'use client';

/**
 * Las acciones de un chat (5/11): tomarlo, responder y cerrarlo. Después de cada una se
 * refresca la página: el hilo lo pinta el servidor.
 */

import { useRef, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  Bold,
  Code,
  Italic,
  List,
  MousePointerClick,
  Quote,
  Send,
  Strikethrough,
  X,
} from 'lucide-react';
import { Button } from '@/components/atoms/button';
import { Input } from '@/components/atoms/input';
import { Label } from '@/components/atoms/label';
import { useAnnounce } from '@/lib/a11y/announce';
import { apiErrorText } from '@/lib/http/api-error-text';
import { cn } from '@/lib/utils';
import type { ChannelFeatures } from '@/features/messaging/channels';
import { MessageText } from './message-text';
import { useReplyTarget } from './reply-target';

function usePost(conversationId: string) {
  const t = useTranslations('messaging.actions');
  const router = useRouter();
  const { announce } = useAnnounce();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const post = async (
    action: 'take' | 'messages' | 'close' | 'person' | 'payment-link' | 'follow-up',
    ok: string,
    body?: unknown
  ): Promise<unknown> => {
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
      return payload?.data ?? true;
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

/** Marcas de formato de WhatsApp: envuelven la selección o, en líneas, la prefijan. */
const MARKS = [
  { key: 'bold', icon: Bold, wrap: '*' },
  { key: 'italic', icon: Italic, wrap: '_' },
  { key: 'strike', icon: Strikethrough, wrap: '~' },
  { key: 'mono', icon: Code, wrap: '```' },
  { key: 'list', icon: List, prefix: '- ' },
  { key: 'quote', icon: Quote, prefix: '> ' },
] as const;

export function ReplyForm({
  conversationId,
  features,
}: {
  conversationId: string;
  features: ChannelFeatures;
}) {
  const t = useTranslations('messaging.actions');
  const { busy, error, post } = usePost(conversationId);
  const { target, setTarget } = useReplyTarget();
  const area = useRef<HTMLTextAreaElement>(null);
  const [text, setText] = useState('');
  const [buttons, setButtons] = useState<string[] | null>(null);

  const mark = (m: (typeof MARKS)[number]) => {
    const el = area.current;
    if (!el) return;
    const { selectionStart: a, selectionEnd: b } = el;
    let next: string;
    let cursor: [number, number];
    if ('wrap' in m) {
      next = text.slice(0, a) + m.wrap + text.slice(a, b) + m.wrap + text.slice(b);
      cursor = [a + m.wrap.length, b + m.wrap.length];
    } else {
      // Prefija cada línea tocada por la selección.
      const start = text.lastIndexOf('\n', a - 1) + 1;
      const block = text
        .slice(start, b)
        .split('\n')
        .map((line) => m.prefix + line)
        .join('\n');
      next = text.slice(0, start) + block + text.slice(b);
      cursor = [start + block.length, start + block.length];
    }
    setText(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(...cursor);
    });
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!text.trim()) return;
    const titles = (buttons ?? []).map((b) => b.trim()).filter(Boolean);
    const sent = await post('messages', t('sent'), {
      body: text,
      replyToId: target?.id ?? null,
      ...(titles.length ? { buttons: titles } : {}),
    });
    if (sent) {
      setText('');
      setTarget(null);
      setButtons(null);
    }
  };

  const limits = features.buttons;

  return (
    <form onSubmit={(e) => void onSubmit(e)} className="space-y-2">
      <Label htmlFor="chat-reply">{t('replyLabel')}</Label>
      {target && (
        <div className="border-accent-base bg-surface-sunken rounded-control flex items-start gap-2 border-l-4 px-3 py-2">
          <div className="min-w-0 flex-1">
            <p className="type-caption text-text-muted m-0">
              {t('replyingTo', { name: target.author })}
            </p>
            <p className="type-caption text-text m-0 truncate">{target.body}</p>
          </div>
          <button
            type="button"
            onClick={() => setTarget(null)}
            aria-label={t('cancelQuote')}
            className="text-text-muted hover:text-text shrink-0"
          >
            <X aria-hidden className="size-4" />
          </button>
        </div>
      )}
      {features.format === 'whatsapp' && (
        <div role="toolbar" aria-label={t('formatLabel')} className="flex flex-wrap gap-1">
          {MARKS.map((m) => (
            <button
              key={m.key}
              type="button"
              onClick={() => mark(m)}
              disabled={busy}
              aria-label={t(`format.${m.key}`)}
              title={t(`format.${m.key}`)}
              className="rounded-control text-text-muted hover:bg-surface-sunken hover:text-text inline-flex size-8 items-center justify-center"
            >
              <m.icon aria-hidden className="size-4" />
            </button>
          ))}
        </div>
      )}
      <textarea
        ref={area}
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
        {t(features.format === 'whatsapp' ? 'replyHintFormat' : 'replyHint')}
      </p>
      {features.format === 'whatsapp' && /[*_~`>]|^- /m.test(text) && (
        <div className="rounded-card border-border-muted space-y-1 border px-4 py-2">
          <p className="type-caption text-text-muted m-0">{t('preview')}</p>
          <MessageText text={text} format={features.format} />
        </div>
      )}
      {limits &&
        (buttons === null ? (
          <Button type="button" variant="quiet" onClick={() => setButtons([''])} disabled={busy}>
            <MousePointerClick aria-hidden className="size-4 shrink-0" />
            {t('addButtons')}
          </Button>
        ) : (
          <fieldset className="space-y-2">
            <legend className="type-caption text-text-muted">
              {t('buttonsLegend', { max: limits.max, chars: limits.titleMax })}
            </legend>
            {buttons.map((value, i) => (
              <div key={i} className="flex items-center gap-2">
                <Input
                  value={value}
                  maxLength={limits.titleMax}
                  aria-label={t('buttonLabel', { n: i + 1 })}
                  onChange={(e) =>
                    setButtons(buttons.map((b, j) => (j === i ? e.target.value : b)))
                  }
                />
                <button
                  type="button"
                  onClick={() => {
                    const next = buttons.filter((_, j) => j !== i);
                    setButtons(next.length ? next : null);
                  }}
                  aria-label={t('removeButton', { n: i + 1 })}
                  className="text-text-muted hover:text-text shrink-0"
                >
                  <X aria-hidden className="size-4" />
                </button>
              </div>
            ))}
            {buttons.length < limits.max && (
              <Button type="button" variant="quiet" onClick={() => setButtons([...buttons, ''])}>
                {t('anotherButton')}
              </Button>
            )}
          </fieldset>
        ))}
      <Button type="submit" loading={busy} disabled={!text.trim()}>
        <Send aria-hidden className="size-4 shrink-0" />
        {t('send')}
      </Button>
      <ErrorText error={error} />
    </form>
  );
}

/** Fuera de las 24 h (22/11): la plantilla aprobada para que vuelva a escribir. */
export function FollowUpAction({ conversationId }: { conversationId: string }) {
  const t = useTranslations('messaging.actions');
  const { busy, error, post } = usePost(conversationId);
  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant="secondary"
        loading={busy}
        onClick={() => void post('follow-up', t('followUpSent'))}
      >
        {t('followUp')}
      </Button>
      <p className="type-caption text-text-muted m-0">{t('followUpHint')}</p>
      <ErrorText error={error} />
    </div>
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

/** «Crear persona» con los datos de inscripción del chat: lleva a su ficha para invitarla. */
export function CreatePersonAction({ conversationId }: { conversationId: string }) {
  const t = useTranslations('messaging.actions');
  const router = useRouter();
  const { busy, error, post } = usePost(conversationId);
  const onClick = async () => {
    const result = await post('person', t('personCreated'));
    const code = typeof result === 'object' ? (result as { personCode?: string }).personCode : null;
    if (code) router.push(`/personas/${code}`);
  };
  return (
    <div className="space-y-2">
      <Button type="button" variant="secondary" loading={busy} onClick={() => void onClick()}>
        {t('createPerson')}
      </Button>
      <ErrorText error={error} />
    </div>
  );
}

/** «Link de pago» de la próxima cuota: Bold lo envía al correo o queda en el chat (19/11). */
export function PaymentLinkAction({
  conversationId,
  hasEmail,
  canChat,
}: {
  conversationId: string;
  hasEmail: boolean;
  /** Dentro de las 24 h de WhatsApp. */
  canChat: boolean;
}) {
  const t = useTranslations('messaging.actions');
  const { busy, error, post } = usePost(conversationId);
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="secondary"
          disabled={busy || !canChat}
          onClick={() => void post('payment-link', t('linkInChat'), { delivery: 'chat' })}
        >
          {t('linkToChat')}
        </Button>
        <Button
          type="button"
          variant="secondary"
          disabled={busy || !hasEmail}
          onClick={() => void post('payment-link', t('linkEmailed'), { delivery: 'email' })}
        >
          {t('linkByEmail')}
        </Button>
      </div>
      {!canChat && <p className="type-caption text-text-muted m-0">{t('linkNoWindow')}</p>}
      {!hasEmail && <p className="type-caption text-text-muted m-0">{t('linkNoEmail')}</p>}
      <ErrorText error={error} />
    </div>
  );
}
