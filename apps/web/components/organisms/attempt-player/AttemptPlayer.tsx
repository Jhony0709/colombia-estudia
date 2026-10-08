'use client';

/**
 * El intento, en pantalla. SSOT: plan/08-aprender-y-evaluar.md:56-70 (§3 «UI»).
 *
 * Reparto de responsabilidades, que es lo que importa aquí:
 * - **el servidor decide** cuándo vence (`deadlineAt`), cuánto vale y si se puede seguir;
 * - **esto pinta y guarda**: cada respuesta va a `PATCH …/attempts/[id]` con una cola local
 *   —lo que no se pudo mandar se reintenta al volver la red o en el siguiente cambio—, y
 *   el reloj solo muestra: corrige la deriva con `serverNow` y con el `Date` de cada
 *   respuesta del servidor.
 *
 * Accesibilidad que no es opcional (WCAG 2.2 AA es puerta de CI): `fieldset`/`legend` por
 * pregunta con «Pregunta 3 de 10» como `h2` encima, controles nativos, `role="timer"`
 * ocultable con hitos por `useAnnounce`, estado de guardado en `role="status"`, y el diálogo
 * de entrega lista las sin responder antes de cerrar nada.
 *
 * Una pregunta por pantalla en todos los tamaños (27/9; hasta entonces en escritorio iban
 * las diez en columna y «Entregar» quedaba debajo de todas). El índice al lado en escritorio
 * y debajo en móvil; Anterior / Siguiente / Entregar en la barra fija del pie
 * (`StickyActionBar`), siempre a la vista. El cambio de pregunta es un fade de entrada con
 * tokens (`.attempt-question`, `globals.css`); la salida es corte. `prefers-reduced-motion`
 * = corte en ambos sentidos por la regla global.
 */

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations, useFormatter } from 'next-intl';
import { Clock, EyeOff, Eye, CircleCheck, Circle, ArrowRight, RotateCcw } from 'lucide-react';
import { Button } from '@/components/atoms/button';
import { Dialog, DialogClose } from '@/components/organisms/dialog';
import { Alert } from '@/components/atoms/alert';
import { Badge } from '@/components/atoms/badge';
import { CountUp, ResultMoment } from '@/components/atoms/motion';
import { ProgressBar } from '@/components/atoms/progress-bar';
import { StickyActionBar } from '@/components/organisms/sticky-action-bar';
import { useAnnounce } from '@/lib/a11y/announce';
import { trackStudentEvent } from '@/lib/telemetry/student-events';
import { SLOW_AFTER_MS } from '@/lib/net/slow-request';
import { apiErrorText } from '@/lib/http/api-error-text';
import { cn } from '@/lib/utils';

export interface AttemptQuestion {
  code: string;
  type: 'single_choice' | 'multiple_choice' | 'true_false' | 'short_text';
  text: string;
  /** HTML seguro de una frase (`renderInlineHtml`): lo que se pinta. `text` queda para lógica. */
  textHtml: string;
  options: Array<{ code: string; text: string; textHtml: string }>;
  points: number;
  answer: unknown;
  correct: boolean | null;
  pointsAwarded: number | null;
  feedback: string | null;
  feedbackHtml: string | null;
}

export interface AttemptView {
  id: string;
  assignmentId: string;
  number: number;
  status: 'IN_PROGRESS' | 'SUBMITTED' | 'EXPIRED' | 'GRADED';
  title: string;
  language: string;
  instructions: string | null;
  instructionsHtml: string | null;
  /** El cierre del componente (25/9); nulo = el texto general. */
  closingText: string | null;
  /** Solo con límite de tiempo configurado y sin exención: sin eso no hay reloj (27/9). */
  timed: boolean;
  deadlineAt: string | null;
  serverNow: string;
  submittedAt: string | null;
  review: 'NONE' | 'SCORE' | 'FULL';
  score: { value: number; max: number; percent: number; passed: boolean } | null;
  questions: AttemptQuestion[];
  /** Qué sigue (8/10): ver `AttemptForStudent.outcome`. */
  outcome: 'PASSED' | 'PASSED_OTHER' | 'RETRY' | 'DONE' | 'PENDING' | null;
  attemptsLeft: number;
  activeAttemptId: string | null;
  next: { href: string; title: string | null } | null;
}

type Answer = string | string[] | null;
type SaveState = 'idle' | 'saving' | 'saved' | 'offline' | 'error';

const RETRY_MS = 15_000;
const TEXT_DEBOUNCE_MS = 800;
/** Hitos del reloj que se anuncian, en segundos restantes. */
const MILESTONES = [600, 300, 60];

/** Para los textos que no vienen del servidor ya saneados (Verdadero / Falso). */
const escapeHtml = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const isAnswered = (a: Answer) => a !== null && (Array.isArray(a) ? a.length > 0 : a.trim() !== '');

function normalize(raw: unknown): Answer {
  if (typeof raw === 'string') return raw;
  if (Array.isArray(raw)) return raw.filter((x): x is string => typeof x === 'string');
  return null;
}

export function AttemptPlayer({ attempt }: { attempt: AttemptView }) {
  if (attempt.status !== 'IN_PROGRESS') return <AttemptReview attempt={attempt} />;
  return <AttemptInProgress attempt={attempt} />;
}

// ─────────────────────────── en curso ───────────────────────────

function AttemptInProgress({ attempt }: { attempt: AttemptView }) {
  const t = useTranslations('learn.attempt');
  const router = useRouter();
  const { announce } = useAnnounce();
  const headingId = useId();

  const [answers, setAnswers] = useState<Record<string, Answer>>(() =>
    Object.fromEntries(attempt.questions.map((q) => [q.code, normalize(q.answer)]))
  );
  const [current, setCurrent] = useState(0);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // La cola: lo que aún no confirmó el servidor. Un `Map` y no un array: la última
  // respuesta de una pregunta pisa a la anterior, que ya no interesa mandar.
  const pending = useRef(new Map<string, Answer>());
  // El guardado en curso (5/10): quien llama mientras viaja espera ese mismo envío. Antes era
  // un booleano y `flush()` volvía al instante, así que «Entregar» justo después de responder
  // la última pregunta encontraba la respuesta aún en la cola y decía «sin guardar».
  const running = useRef<Promise<boolean> | null>(null);
  // Por qué falló el último guardado: sin red, sesión cerrada u otra respuesta del servidor.
  const failure = useRef<{ kind: 'offline' | 'session' | 'server'; payload?: unknown } | null>(
    null
  );
  const textTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closed = useRef(false);

  // Deriva reloj cliente–servidor: `serverNow` llega con el render y se corrige con cada
  // `Date` que devuelve el autosave.
  const offset = useRef(new Date(attempt.serverNow).getTime() - Date.now());

  const flush = useCallback((): Promise<boolean> => {
    if (running.current) return running.current;
    if (pending.current.size === 0 || closed.current) return Promise.resolve(true);
    const run = send().finally(() => {
      running.current = null;
    });
    running.current = run;
    return run;
    // `send` se define abajo y lee solo refs y valores estables.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt.id]);

  /** Un envío de la cola. `true` si el servidor confirmó. */
  const send = async (): Promise<boolean> => {
    // Sin mirar `navigator.onLine` (20/9): en Chrome puede decir «sin conexión» con la red
    // perfectamente viva (VPN, adaptadores virtuales), y entonces las respuestas no salían
    // nunca. Se intenta siempre; un `fetch` que lanza es la señal real de que no hay red.
    setSaveState('saving');
    const batch = Object.fromEntries(pending.current);
    let sent = false;
    const began = Date.now();
    try {
      const res = await fetch(`/api/learn/attempts/${attempt.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers: batch }),
      });
      const dateHeader = res.headers.get('date');
      if (dateHeader) {
        const serverMs = new Date(dateHeader).getTime();
        if (!Number.isNaN(serverMs)) offset.current = serverMs - Date.now();
      }
      const payload = (await res.json().catch(() => null)) as {
        data?: { savedAt: string };
        error?: { code?: string };
      } | null;
      if (res.status === 410 || payload?.error?.code === 'ATTEMPT_EXPIRED') {
        // El servidor ya lo cerró: lo que hay en pantalla ya no cuenta. Se recarga y se
        // enseña el resultado (o el vencimiento).
        closed.current = true;
        announce(t('expiredAnnounce'), { assertive: true });
        router.refresh();
        return false;
      }
      if (!res.ok || !payload?.data) {
        failure.current = {
          kind:
            res.status === 401 || payload?.error?.code === 'UNAUTHENTICATED' ? 'session' : 'server',
          payload,
        };
        setSaveState('error');
        return false;
      }
      failure.current = null;
      // Solo se descarta de la cola lo que se mandó tal cual; si la respuesta cambió
      // mientras viajaba, la nueva sigue pendiente.
      for (const [code, value] of Object.entries(batch)) {
        if (pending.current.get(code) === value) pending.current.delete(code);
      }
      try {
        if (pending.current.size === 0)
          window.localStorage.removeItem(`ce.attempt.${attempt.id}.pending`);
        else
          window.localStorage.setItem(
            `ce.attempt.${attempt.id}.pending`,
            JSON.stringify([...pending.current])
          );
      } catch {
        // Ídem.
      }
      setSavedAt(new Date(payload.data.savedAt));
      setSaveState(pending.current.size > 0 ? 'saving' : 'saved');
      sent = true;
    } catch {
      // El `fetch` lanzó: no hubo respuesta. Eso es «sin conexión», diga lo que diga el
      // navegador; se reintenta al evento `online` y cada 15 s (efecto de abajo).
      failure.current = { kind: 'offline' };
      setSaveState('offline');
    } finally {
      // E1 (23/9): cuánto tardó cada guardado y si llegó. De aquí saldrán los umbrales.
      const ms = Date.now() - began;
      trackStudentEvent('student.request.finished', {
        screen: 'assessment',
        action: 'attempt_continue',
        request: 'attempt_save',
        outcome: sent ? (ms >= SLOW_AFTER_MS ? 'slow_ok' : 'ok') : 'failed',
        durationMs: ms,
      });
      // Solo tras un envío que llegó se manda enseguida lo que entró mientras viajaba. Tras
      // un fallo no: reintentar cada 250 ms contra una red caída es un bucle, no una cola.
      if (sent && pending.current.size > 0 && !closed.current) {
        setTimeout(() => void flush(), 250);
      }
    }
    return sent;
  };

  // Reintentos: al volver la red y, por si acaso, cada 15 s mientras quede algo.
  useEffect(() => {
    const onOnline = () => void flush();
    window.addEventListener('online', onOnline);
    const interval = setInterval(() => void flush(), RETRY_MS);
    return () => {
      window.removeEventListener('online', onOnline);
      clearInterval(interval);
    };
  }, [flush]);

  // Al ocultarse la pestaña se manda lo pendiente con `keepalive`, que sobrevive al cierre.
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState !== 'hidden' || pending.current.size === 0) return;
      void fetch(`/api/learn/attempts/${attempt.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers: Object.fromEntries(pending.current) }),
        keepalive: true,
      }).catch(() => undefined);
    };
    document.addEventListener('visibilitychange', onHide);
    return () => document.removeEventListener('visibilitychange', onHide);
  }, [attempt.id]);

  // Lo pendiente también en el aparato (E1, 23/9): una recarga o un cierre con la red caída
  // no se lleva respuestas que el servidor aún no confirmó. Al montar se recupera y se
  // manda; al confirmar se borra.
  const pendingKey = `ce.attempt.${attempt.id}.pending`;
  const persistPending = () => {
    try {
      if (pending.current.size === 0) window.localStorage.removeItem(pendingKey);
      else window.localStorage.setItem(pendingKey, JSON.stringify([...pending.current]));
    } catch {
      // Sin almacenamiento: la cola en memoria sigue funcionando.
    }
  };
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(pendingKey);
      if (!raw) return;
      const saved = JSON.parse(raw) as Array<[string, Answer]>;
      if (!Array.isArray(saved) || saved.length === 0) return;
      const known = new Set(attempt.questions.map((q) => q.code));
      for (const [code, value] of saved) {
        if (!known.has(code)) continue;
        pending.current.set(code, value);
        setAnswers((prev) => ({ ...prev, [code]: value }));
      }
      void flush();
    } catch {
      // Un JSON roto no vale nada: se ignora.
    }
    // Solo al montar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingKey]);

  const setAnswer = (code: string, value: Answer, debounce = false) => {
    setAnswers((prev) => ({ ...prev, [code]: value }));
    pending.current.set(code, value);
    persistPending();
    if (textTimer.current) clearTimeout(textTimer.current);
    if (debounce) {
      textTimer.current = setTimeout(() => void flush(), TEXT_DEBOUNCE_MS);
    } else {
      void flush();
    }
  };

  const unanswered = attempt.questions.filter((q) => !isAnswered(answers[q.code] ?? null));

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      if (textTimer.current) clearTimeout(textTimer.current);
      // Lo pendiente sale antes de entregar; si no llega, no se entrega. Se espera el envío
      // que esté en camino y se manda lo que entró mientras tanto.
      for (let round = 0; round < 3 && pending.current.size > 0; round += 1) {
        if (!(await flush())) break;
      }
      if (closed.current) return;
      if (pending.current.size > 0) {
        const why = failure.current;
        setError(
          why?.kind === 'session'
            ? t('submitSessionError')
            : why?.kind === 'server'
              ? apiErrorText(why.payload, t('submitServerError'))
              : t('submitPendingError')
        );
        return;
      }
      const res = await fetch(`/api/learn/attempts/${attempt.id}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok) {
        setError(apiErrorText(payload, t('submitError')));
        return;
      }
      closed.current = true;
      setConfirming(false);
      announce(t('submittedAnnounce'));
      router.refresh();
    } catch {
      setError(t('submitError'));
    } finally {
      setSubmitting(false);
    }
  };

  const onExpired = useCallback(() => {
    if (closed.current) return;
    closed.current = true;
    announce(t('expiredAnnounce'), { assertive: true });
    // Un segundo de margen para que el servidor, con su reloj, también lo dé por vencido.
    setTimeout(() => router.refresh(), 1000);
  }, [announce, router, t]);

  const total = attempt.questions.length;
  const answeredCount = total - unanswered.length;

  const goTo = (index: number) => {
    const next = Math.max(0, Math.min(total - 1, index));
    setCurrent(next);
    // El foco a la leyenda de la pregunta nueva, para lector de pantalla y teclado.
    requestAnimationFrame(() => {
      document
        .getElementById(`pregunta-${next + 1}`)
        ?.querySelector<HTMLElement>('legend')
        ?.focus();
    });
  };
  const isLast = current === total - 1;
  const currentQuestion = attempt.questions[current];
  const samePoints = attempt.questions.every((q) => q.points === attempt.questions[0]?.points);

  return (
    <div className="space-y-6">
      {/* Cabecera de una línea (27/9): cuántas van, guardado y, si aplica, el reloj; debajo
          la barra de avance real. Antes eran ~140 px de tarjeta antes de la primera pregunta. */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
          <p className="type-body-emphasis m-0" role="status">
            {t('progress', { answered: answeredCount, total })}
            <span className="type-caption text-text-muted font-normal"> · </span>
            <span className="type-caption text-text-muted font-normal">
              <SaveStatus state={saveState} savedAt={savedAt} />
            </span>
          </p>
          {/*
            El reloj solo si el examen tiene límite de tiempo configurado (27/9, Jhonny; por
            defecto no lo tiene). `deadlineAt` es el mínimo de límite de tiempo, fecha de entrega
            y fin de acceso (`getAttemptDeadline`): una fecha de entrega cercana no es un reloj,
            es una fecha, y ya está en «Antes de empezar» y en el calendario. El servidor sigue
            cerrando el intento al vencer aunque no haya cuenta atrás en pantalla.
          */}
          {attempt.timed && attempt.deadlineAt && (
            <Timer deadlineAt={attempt.deadlineAt} offset={offset} onExpired={onExpired} />
          )}
        </div>
        <ProgressBar
          percent={total === 0 ? 0 : (answeredCount / total) * 100}
          label={t('progress', { answered: answeredCount, total })}
          className="progress-bar-animated"
        />
      </div>

      {attempt.instructionsHtml && (
        <p
          className="type-body text-text-muted max-w-reading"
          dangerouslySetInnerHTML={{ __html: attempt.instructionsHtml }}
        />
      )}

      <div className="gap-8 lg:grid lg:grid-cols-[minmax(0,1fr)_14rem] lg:items-start">
        {/* Solo la pregunta actual está en el DOM (27/9): diez `fieldset` con sus `input`
            escondidos con `display:none` no aportan nada y duplican nombres. Las respuestas
            viven en `answers`, así que cambiar de pregunta no pierde nada. La clave por
            pregunta hace que la nueva monte y entre con fade. */}
        <section aria-labelledby={headingId} className="min-w-0">
          <h2 id={headingId} className="sr-only">
            {t('questionsHeading')}
          </h2>
          {currentQuestion && (
            <div
              key={currentQuestion.code}
              id={`pregunta-${current + 1}`}
              className="attempt-question"
            >
              <Question
                question={currentQuestion}
                index={current}
                total={total}
                language={attempt.language}
                value={answers[currentQuestion.code] ?? null}
                showPoints={!samePoints}
                onChange={(value, debounce) => setAnswer(currentQuestion.code, value, debounce)}
              />
            </div>
          )}
        </section>

        <aside className="mt-8 lg:mt-0">
          <nav
            aria-label={t('indexLabel')}
            className="bg-surface-base border-border-muted rounded-card border p-4"
          >
            <p className="type-caption text-text-muted mb-3">{t('indexTitle')}</p>
            <ol className="grid grid-cols-6 gap-2 sm:grid-cols-8 lg:grid-cols-4">
              {attempt.questions.map((q, index) => {
                const done = isAnswered(answers[q.code] ?? null);
                const active = index === current;
                return (
                  <li key={q.code}>
                    <button
                      type="button"
                      onClick={() => goTo(index)}
                      aria-current={active ? 'step' : undefined}
                      className={cn(
                        'rounded-control min-h-touch min-w-touch type-label duration-fast ease-standard inline-flex w-full items-center justify-center gap-1 border transition-colors',
                        active
                          ? 'border-accent-base bg-accent-base text-text-on-accent'
                          : done
                            ? 'border-status-success-base bg-status-success-muted text-text'
                            : 'border-border bg-surface-sunken text-text-muted'
                      )}
                    >
                      <span className="sr-only">
                        {done
                          ? t('indexAnswered', { n: index + 1 })
                          : t('indexUnanswered', { n: index + 1 })}
                      </span>
                      <span aria-hidden="true">{index + 1}</span>
                      {done && !active && <CircleCheck aria-hidden className="size-3.5" />}
                    </button>
                  </li>
                );
              })}
            </ol>
            <p className="type-caption text-text-muted mt-3">{t('submitHint')}</p>
          </nav>
        </aside>
      </div>

      {error && <Alert severity="error">{error}</Alert>}

      {/* Anterior / Siguiente / Entregar siempre a la vista (27/9). En la última pregunta la
          acción pasa a ser «Entregar»; antes, seguir. Entregar también está en el índice para
          quien termina antes de la última. */}
      <StickyActionBar
        label={t('navLabel')}
        status={<span className="lg:hidden">{t('position', { n: current + 1, total })}</span>}
        secondary={
          <>
            <Button
              type="button"
              variant="secondary"
              disabled={current === 0}
              onClick={() => goTo(current - 1)}
            >
              {t('previous')}
            </Button>
            {isLast && <span className="sr-only">{t('lastQuestion')}</span>}
          </>
        }
        action={
          isLast ? (
            <Button type="button" onClick={() => setConfirming(true)}>
              {t('submit')}
            </Button>
          ) : (
            <div className="flex items-center gap-3">
              <Button type="button" variant="quiet" onClick={() => setConfirming(true)}>
                {t('submit')}
              </Button>
              <Button type="button" onClick={() => goTo(current + 1)}>
                {t('next')}
              </Button>
            </div>
          )
        }
      />

      <Dialog
        open={confirming}
        onOpenChange={setConfirming}
        locked={submitting}
        size="sm"
        title={t('confirmTitle')}
        description={
          unanswered.length === 0
            ? t('confirmAllAnswered')
            : t('confirmUnanswered', { count: unanswered.length })
        }
        actions={
          <>
            <DialogClose>
              <Button type="button" variant="secondary" disabled={submitting}>
                {t('confirmBack')}
              </Button>
            </DialogClose>
            <Button type="button" disabled={submitting} onClick={() => void submit()}>
              {submitting ? t('submitting') : t('confirmSubmit')}
            </Button>
          </>
        }
      >
        {unanswered.length > 0 && (
          <ul className="type-body max-h-40 list-disc overflow-y-auto pl-5">
            {unanswered.map((q) => {
              const index = attempt.questions.indexOf(q);
              return (
                <li key={q.code}>
                  <button
                    type="button"
                    className="text-text-link underline"
                    onClick={() => {
                      setConfirming(false);
                      setCurrent(index);
                    }}
                  >
                    {t('questionN', { n: index + 1 })}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        <p className="type-caption text-text-muted">{t('confirmFinal')}</p>
      </Dialog>
    </div>
  );
}

function SaveStatus({ state, savedAt }: { state: SaveState; savedAt: Date | null }) {
  const t = useTranslations('learn.attempt.save');
  const format = useFormatter();
  switch (state) {
    case 'saving':
      return <span>{t('saving')}</span>;
    case 'offline':
      return <span className="text-status-warning-base">{t('offline')}</span>;
    case 'error':
      return <span className="text-status-error-base">{t('error')}</span>;
    case 'saved':
      return (
        <span>
          {t('saved', {
            time: savedAt ? format.dateTime(savedAt, { hour: 'numeric', minute: '2-digit' }) : '',
          })}
        </span>
      );
    default:
      return <span>{t('idle')}</span>;
  }
}

/**
 * Cuenta atrás con `deadlineAt` del servidor. El cliente no decide el vencimiento: cuando
 * llega a cero avisa y recarga, y es el servidor quien cierra el intento.
 */
/** Un plazo dentro de las próximas 24 h se enseña como reloj; más lejos, no. */

function Timer({
  deadlineAt,
  offset,
  onExpired,
}: {
  deadlineAt: string;
  offset: React.MutableRefObject<number>;
  onExpired: () => void;
}) {
  const t = useTranslations('learn.attempt.timer');
  const { announce } = useAnnounce();
  const [hidden, setHidden] = useState(false);
  const deadline = useMemo(() => new Date(deadlineAt).getTime(), [deadlineAt]);
  const remaining = () =>
    Math.max(0, Math.floor((deadline - (Date.now() + offset.current)) / 1000));
  const [left, setLeft] = useState(remaining);
  const announced = useRef(new Set<number>());
  const fired = useRef(false);

  useEffect(() => {
    const id = setInterval(() => {
      const next = remaining();
      setLeft(next);
      for (const m of MILESTONES) {
        if (next <= m && !announced.current.has(m)) {
          announced.current.add(m);
          announce(t('milestone', { minutes: Math.round(m / 60) }), { assertive: m === 60 });
        }
      }
      if (next === 0 && !fired.current) {
        fired.current = true;
        onExpired();
      }
    }, 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deadline]);

  const hh = Math.floor(left / 3600);
  const mm = Math.floor((left % 3600) / 60);
  const ss = left % 60;
  const label =
    hh > 0
      ? `${hh}:${mm.toString().padStart(2, '0')}:${ss.toString().padStart(2, '0')}`
      : `${mm}:${ss.toString().padStart(2, '0')}`;

  return (
    <div className="flex items-center gap-2">
      <span
        role="timer"
        aria-live="off"
        aria-label={t('label', { minutes: hh * 60 + mm, seconds: ss })}
        className={cn(
          'type-label inline-flex items-center gap-1.5 tabular-nums',
          left <= 60
            ? 'text-status-error-base'
            : left <= 300
              ? 'text-status-warning-base'
              : 'text-text'
        )}
      >
        <Clock className="size-4" aria-hidden="true" />
        {hidden ? t('hidden') : label}
      </span>
      <button
        type="button"
        onClick={() => setHidden((h) => !h)}
        aria-pressed={hidden}
        className="text-text-muted hover:bg-surface-sunken rounded-control min-h-touch min-w-touch inline-flex items-center justify-center"
      >
        {hidden ? (
          <Eye className="size-4" aria-hidden="true" />
        ) : (
          <EyeOff className="size-4" aria-hidden="true" />
        )}
        <span className="sr-only">{hidden ? t('show') : t('hide')}</span>
      </button>
    </div>
  );
}

// ─────────────────────────── una pregunta ───────────────────────────

const CONTROL =
  'border-border text-accent-base size-5 shrink-0 cursor-pointer accent-[var(--accent-base)]';

function Question({
  question: q,
  index,
  total,
  language,
  value,
  onChange,
  review,
  showPoints = true,
}: {
  question: AttemptQuestion;
  index: number;
  total: number;
  language: string;
  value: Answer;
  onChange?: (value: Answer, debounce?: boolean) => void;
  review?: boolean;
  /** Falso cuando todas valen lo mismo: repetir «1 punto» diez veces no dice nada (27/9). */
  showPoints?: boolean;
}) {
  const t = useTranslations('learn.attempt');
  const id = useId();
  const readOnly = !onChange;

  const options =
    q.type === 'true_false' && q.options.length === 0
      ? [
          { code: 'true', text: t('true'), textHtml: escapeHtml(t('true')) },
          { code: 'false', text: t('false'), textHtml: escapeHtml(t('false')) },
        ]
      : q.options;

  return (
    <fieldset
      className={cn(
        // En curso, sin tarjeta (27/9): una pregunta por vista no necesita caja dentro de
        // caja; las opciones ya tienen su borde. En revisión, la tarjeta con el color del
        // resultado sí dice algo.
        review ? 'bg-surface-base border-border-muted rounded-card border p-5' : 'min-w-0 py-2',
        review && q.correct === true && 'border-status-success-base',
        review && q.correct === false && 'border-status-error-base'
      )}
      lang={language}
      disabled={readOnly}
    >
      <legend tabIndex={-1} className="type-caption text-text-muted">
        {t('questionOf', { n: index + 1, total })}
        {showPoints && <> · {t('points', { count: q.points })}</>}
        {review && q.pointsAwarded !== null && (
          <>
            {' · '}
            <span className={q.correct ? 'text-status-success-base' : 'text-status-error-base'}>
              {t('awarded', { points: q.pointsAwarded })}
            </span>
          </>
        )}
      </legend>
      {/* HTML saneado en el servidor (`renderInlineHtml`): negrita, fórmula, código; sin bloques. */}
      <p
        className="type-body-emphasis mt-1 text-[1.125rem] leading-relaxed"
        dangerouslySetInnerHTML={{ __html: q.textHtml }}
      />

      {q.type === 'short_text' ? (
        <div className="mt-3">
          <label htmlFor={`${id}-text`} className="sr-only">
            {t('yourAnswer')}
          </label>
          <input
            id={`${id}-text`}
            type="text"
            value={typeof value === 'string' ? value : ''}
            readOnly={readOnly}
            onChange={(e) => onChange?.(e.target.value, true)}
            autoComplete="off"
            className="rounded-control border-border bg-surface-sunken text-text type-body min-h-touch focus:border-accent-base w-full border px-3 py-2"
          />
        </div>
      ) : (
        <ul className="mt-3 space-y-2">
          {options.map((opt) => {
            const optionId = `${id}-${opt.code}`;
            const checked =
              q.type === 'multiple_choice'
                ? Array.isArray(value) && value.includes(opt.code)
                : value === opt.code;
            return (
              <li key={opt.code}>
                {/* El texto de la etiqueta es HTML ya saneado (`textHtml`, 27/9) dentro del
                    `<span>`; el linter no ve texto y avisa, pero el `<label>` sí lo tiene. */}
                {/* eslint-disable-next-line jsx-a11y/label-has-associated-control */}
                <label
                  htmlFor={optionId}
                  className={cn(
                    'rounded-control min-h-touch duration-fast ease-standard flex cursor-pointer items-center gap-3 border px-3 py-2 transition-colors',
                    checked
                      ? 'border-accent-base bg-surface-sunken'
                      : 'border-border-muted hover:border-border hover:bg-surface-sunken'
                  )}
                >
                  <input
                    id={optionId}
                    type={q.type === 'multiple_choice' ? 'checkbox' : 'radio'}
                    name={`${id}-${q.code}`}
                    value={opt.code}
                    checked={checked}
                    readOnly={readOnly}
                    onChange={() => {
                      if (!onChange) return;
                      if (q.type === 'multiple_choice') {
                        const set = new Set(Array.isArray(value) ? value : []);
                        if (set.has(opt.code)) set.delete(opt.code);
                        else set.add(opt.code);
                        onChange([...set]);
                      } else {
                        onChange(opt.code);
                      }
                    }}
                    className={CONTROL}
                  />
                  <span className="type-body" dangerouslySetInnerHTML={{ __html: opt.textHtml }} />
                </label>
              </li>
            );
          })}
        </ul>
      )}

      {review && q.feedbackHtml && (
        <p
          className="type-body text-text-muted border-border mt-3 border-l-2 pl-3"
          dangerouslySetInnerHTML={{ __html: q.feedbackHtml }}
        />
      )}
    </fieldset>
  );
}

// ─────────────────────────── revisión ───────────────────────────

function AttemptReview({ attempt }: { attempt: AttemptView }) {
  const t = useTranslations('learn.attempt');
  const format = useFormatter();
  const { outcome } = attempt;
  const passed = outcome === 'PASSED';
  // Aprobado: amanecer; no aprobado (con o sin intentos): respiración, sin rojo (8/10).
  const moment = passed
    ? 'success'
    : outcome === 'RETRY' || outcome === 'DONE' || outcome === 'PASSED_OTHER'
      ? 'breath'
      : null;
  const title =
    outcome === 'PASSED'
      ? t('result.passedTitle')
      : outcome === 'RETRY'
        ? attempt.status === 'EXPIRED'
          ? t('result.expired')
          : t('result.retryTitle')
        : outcome === 'PASSED_OTHER'
          ? t('result.passedOtherTitle')
          : outcome === 'DONE'
            ? t('result.doneTitle')
            : attempt.status === 'EXPIRED'
              ? t('result.expired')
              : t('result.submitted');

  return (
    <div className="space-y-6">
      <section
        aria-label={t('resultLabel')}
        className={cn(
          // Resultado (experiencia-colombia-estudia §6): el momento, la nota y luego el cierre.
          'rounded-card motion-enter-md flex flex-col items-start gap-5 border p-6 sm:flex-row sm:items-center sm:p-8',
          passed
            ? 'border-status-success-base bg-status-success-muted'
            : 'border-border-muted bg-surface-base'
        )}
      >
        {moment && <ResultMoment kind={moment} />}
        <div className="min-w-0 space-y-2">
          {attempt.submittedAt && (
            // El ICU del servidor y el del navegador escriben la fecha distinto («a las» / «,»).
            <p className="type-caption text-text-muted m-0" suppressHydrationWarning>
              {t('result.submittedOn', {
                date: format.dateTime(new Date(attempt.submittedAt), {
                  day: 'numeric',
                  month: 'long',
                  hour: 'numeric',
                  minute: '2-digit',
                  timeZone: 'America/Bogota',
                }),
              })}
            </p>
          )}
          <h2 className="type-heading text-text m-0 inline-flex items-center gap-2">
            {!moment &&
              (attempt.score?.passed ? (
                <CircleCheck className="size-5" aria-hidden="true" />
              ) : (
                <Circle className="size-5" aria-hidden="true" />
              ))}
            {title}
          </h2>
          {attempt.score ? (
            <p className="type-display text-text m-0" role="status">
              <CountUp
                value={attempt.score.value}
                decimals={Number.isInteger(attempt.score.value) ? 0 : 1}
              />
              {t('result.scoreRest', { max: attempt.score.max, percent: attempt.score.percent })}
              {passed && (
                <>
                  {' '}
                  <span className="motion-enter motion-order-2 inline-block">
                    <Badge variant="success">{t('result.passed')}</Badge>
                  </span>
                </>
              )}
            </p>
          ) : (
            <p className="type-body text-text-muted m-0" role="status">
              {attempt.status === 'EXPIRED' ? t('result.expiredBody') : t('result.hidden')}
            </p>
          )}
        </div>
      </section>

      {/*
        «Aprender es avanzar» (24/9; 8/10). Aprobado o sin intentos: el cierre del taller y el
        botón al paso que sigue en la ruta. Con intentos: la invitación a reintentar y nada de
        seguir: el cuestionario no cuenta como hecho hasta aprobar o agotar los intentos.
      */}
      {outcome !== null && (
        <section
          aria-labelledby="attempt-closing-title"
          className="border-border-muted bg-surface-base rounded-card motion-enter motion-order-3 space-y-3 border p-5 sm:p-6"
        >
          <h2 id="attempt-closing-title" className="type-subheading text-text m-0">
            {t('closing.title')}
          </h2>
          {outcome === 'RETRY' ? (
            <>
              <p className="type-body text-text-muted max-w-reading m-0">
                {t('closing.retryBody')}
              </p>
              <p className="type-body-emphasis text-text m-0">
                {attempt.activeAttemptId
                  ? t('closing.activeAttempt')
                  : attempt.attemptsLeft === 1
                    ? t('closing.lastAttempt')
                    : t('closing.attemptsLeft', { count: attempt.attemptsLeft })}
              </p>
              <div className="pt-1">
                <Button asChild>
                  <Link
                    href={
                      attempt.activeAttemptId
                        ? `/aprender/examen/${attempt.assignmentId}/intento/${attempt.activeAttemptId}`
                        : `/aprender/examen/${attempt.assignmentId}`
                    }
                  >
                    <RotateCcw aria-hidden className="size-4 shrink-0" />
                    {attempt.activeAttemptId ? t('closing.continueAttempt') : t('closing.retry')}
                  </Link>
                </Button>
              </div>
            </>
          ) : (
            <>
              {/* Del taller cuando el equipo lo escribió (3/10); si no, el general. Los saltos
                  de línea se respetan: es un texto de cierre, no Markdown. */}
              <p className="type-body text-text-muted max-w-reading m-0 whitespace-pre-line">
                {outcome === 'PENDING'
                  ? t('closing.pendingBody')
                  : (attempt.closingText ?? t('closing.body'))}
              </p>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-1">
                <Button asChild>
                  <Link href={attempt.next?.href ?? '/aprender'}>
                    {attempt.next ? t('closing.next') : t('closing.toRoute')}
                    <ArrowRight aria-hidden className="size-4 shrink-0" />
                  </Link>
                </Button>
                {attempt.next?.title && (
                  <span className="type-caption text-text-muted">
                    {t('closing.nextTitle', { title: attempt.next.title })}
                  </span>
                )}
              </div>
            </>
          )}
        </section>
      )}

      {attempt.review === 'FULL' && (
        <ol className="space-y-6">
          {attempt.questions.map((q, index) => (
            <li key={q.code}>
              <Question
                question={q}
                index={index}
                total={attempt.questions.length}
                language={attempt.language}
                value={normalize(q.answer)}
                review
              />
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
