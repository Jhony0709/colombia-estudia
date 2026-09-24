'use client';

/**
 * La transcripción sincronizada de cada video del tema (plan/08 §2).
 *
 * El video ya está en el HTML saneado como `<iframe>` de Vimeo; esto lo encuentra por su
 * `src` y habla con él por `postMessage` (sin SDK, como `evidence-recorder.tsx`):
 * - `timeupdate` → se resalta la frase que suena y se desplaza a la vista;
 * - clic en una frase → `setCurrentTime`, el video salta a ese segundo;
 * - «Solo transcripción» oculta el video (`hidden` en la `figure`, que además deja de
 *   descargar el player) y deja el texto como forma principal del tema.
 *
 * Leer la transcripción hasta el final cuenta como evidencia (`lesson-completion.ts`,
 * `transcriptReadToEnd`): el centinela de abajo avisa por un evento del DOM
 * (`ce:transcript-read`) y `evidence-recorder.tsx` lo recoge. Es un evento y no una prop
 * porque los dos componentes se montan sueltos después del artículo y no se conocen.
 */

import { useEffect, useId, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { formatCueTime, type Cue } from '@/lib/media/webvtt';
import { cn } from '@/lib/utils';
import { TRANSCRIPT_PREF_EVENT, transcriptOpenPreference } from './reading-preferences';

export const TRANSCRIPT_READ_EVENT = 'ce:transcript-read';
const VIMEO_ORIGIN = 'https://player.vimeo.com';

export interface TranscriptProps {
  assetId: string;
  vimeoId: string;
  title: string | null;
  cues: Cue[];
}

export function TranscriptPanel({ transcripts }: { transcripts: TranscriptProps[] }) {
  if (transcripts.length === 0) return null;
  return (
    <>
      {transcripts.map((t) => (
        <Transcript key={t.assetId} transcript={t} />
      ))}
    </>
  );
}

function Transcript({ transcript }: { transcript: TranscriptProps }) {
  const t = useTranslations('learn.transcript');
  const id = useId();
  const [current, setCurrent] = useState(-1);
  const [textOnly, setTextOnly] = useState(false);
  // Plegada por defecto (23/9): el vídeo va primero y la transcripción es un apoyo que se
  // pide. Quien la necesita siempre lo deja dicho en «Cómo leer» y aquí se abre sola.
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(transcriptOpenPreference());
    const onPref = (event: Event) => {
      const detail = (event as CustomEvent<{ open: boolean }>).detail;
      if (detail) setOpen(detail.open);
    };
    window.addEventListener(TRANSCRIPT_PREF_EVENT, onPref);
    return () => window.removeEventListener(TRANSCRIPT_PREF_EVENT, onPref);
  }, []);
  const iframe = useRef<HTMLIFrameElement | null>(null);
  const figure = useRef<HTMLElement | null>(null);
  const list = useRef<HTMLOListElement>(null);
  const sentinel = useRef<HTMLDivElement>(null);
  const readSent = useRef(false);

  useEffect(() => {
    const frames = Array.from(
      document.querySelectorAll<HTMLIFrameElement>('article .media-video iframe')
    );
    iframe.current = frames.find((f) => f.src.includes(`/video/${transcript.vimeoId}`)) ?? null;
    figure.current = iframe.current?.closest('figure') ?? null;

    const onMessage = (event: MessageEvent) => {
      if (event.origin !== VIMEO_ORIGIN || event.source !== iframe.current?.contentWindow) return;
      let msg: { event?: string; data?: { seconds?: number } } | null = null;
      try {
        msg = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
      } catch {
        return;
      }
      if (msg?.event === 'ready') {
        iframe.current?.contentWindow?.postMessage(
          JSON.stringify({ method: 'addEventListener', value: 'timeupdate' }),
          VIMEO_ORIGIN
        );
      }
      if (msg?.event === 'timeupdate' && typeof msg.data?.seconds === 'number') {
        const s = msg.data.seconds;
        const index = transcript.cues.findIndex((c) => s >= c.start && s < c.end);
        setCurrent(index);
      }
    };
    window.addEventListener('message', onMessage);
    iframe.current?.contentWindow?.postMessage(
      JSON.stringify({ method: 'addEventListener', value: 'timeupdate' }),
      VIMEO_ORIGIN
    );

    let io: IntersectionObserver | null = null;
    if (sentinel.current && 'IntersectionObserver' in window) {
      io = new IntersectionObserver((entries) => {
        if (entries.some((e) => e.isIntersecting) && !readSent.current) {
          readSent.current = true;
          window.dispatchEvent(new CustomEvent(TRANSCRIPT_READ_EVENT));
        }
      });
      io.observe(sentinel.current);
    }

    return () => {
      window.removeEventListener('message', onMessage);
      io?.disconnect();
    };
  }, [transcript.vimeoId, transcript.cues]);

  // La frase que suena, a la vista, sin robar el foco.
  useEffect(() => {
    if (current < 0 || !list.current) return;
    const el = list.current.children[current] as HTMLElement | undefined;
    el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [current]);

  useEffect(() => {
    figure.current?.classList.toggle('hidden', textOnly);
    figure.current?.setAttribute('aria-hidden', textOnly ? 'true' : 'false');
  }, [textOnly]);

  const seek = (seconds: number) => {
    iframe.current?.contentWindow?.postMessage(
      JSON.stringify({ method: 'setCurrentTime', value: seconds }),
      VIMEO_ORIGIN
    );
    iframe.current?.contentWindow?.postMessage(JSON.stringify({ method: 'play' }), VIMEO_ORIGIN);
  };

  return (
    <details
      open={open}
      onToggle={(event) => setOpen((event.target as HTMLDetailsElement).open)}
      className="border-border-muted rounded-card mt-6 border"
    >
      <summary className="type-body-emphasis min-h-touch flex cursor-pointer items-center justify-between gap-2 px-4 py-2">
        <span id={`${id}-h`}>
          {transcript.title ? t('titleNamed', { title: transcript.title }) : t('title')}
        </span>
        <span className="type-caption text-text-muted">{open ? t('hide') : t('show')}</span>
      </summary>
      <div className="border-border-muted flex flex-wrap items-center justify-end gap-2 border-t px-4 py-2">
        <label className="type-caption min-h-touch inline-flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            checked={textOnly}
            onChange={(e) => setTextOnly(e.target.checked)}
            className="border-border size-5 cursor-pointer rounded-[4px] border accent-[var(--accent-base)]"
          />
          {t('textOnly')}
        </label>
      </div>
      <ol
        ref={list}
        className={cn(
          'type-body m-0 list-none space-y-1 p-3',
          !textOnly && 'max-h-80 overflow-y-auto'
        )}
        aria-label={t('listLabel')}
      >
        {transcript.cues.map((cue, index) => (
          <li key={`${cue.start}-${index}`}>
            <button
              type="button"
              onClick={() => seek(cue.start)}
              aria-current={index === current ? 'true' : undefined}
              className={cn(
                'rounded-control hover:bg-surface-sunken flex w-full gap-3 px-2 py-1.5 text-left',
                index === current && 'bg-surface-sunken text-text'
              )}
            >
              <span className="text-text-muted type-caption w-12 shrink-0 tabular-nums">
                {formatCueTime(cue.start)}
              </span>
              <span>{cue.text}</span>
            </button>
          </li>
        ))}
      </ol>
      <div ref={sentinel} aria-hidden="true" className="h-px" />
    </details>
  );
}
