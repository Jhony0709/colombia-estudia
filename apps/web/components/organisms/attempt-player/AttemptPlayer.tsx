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
 * En móvil una pregunta por pantalla; en escritorio todas en una columna con el índice al
 * lado. Es la misma lista con distinto CSS: no hay dos árboles.
 */

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations, useFormatter } from 'next-intl';
import * as Dialog from '@radix-ui/react-dialog';
import { Clock, EyeOff, Eye, CircleCheck, Circle, CircleX } from 'lucide-react';
import { Button } from '@/components/atoms/button';
import { Alert } from '@/components/atoms/alert';
import { Badge } from '@/components/atoms/badge';
import { useAnnounce } from '@/lib/a11y/announce';
import { apiErrorText } from '@/lib/http/api-error-text';
import { cn } from '@/lib/utils';

export interface AttemptQuestion {
  code: string;
  type: 'single_choice' | 'multiple_choice' | 'true_false' | 'short_text';
  text: string;
  options: Array<{ code: string; text: string }>;
  points: number;
  answer: unknown;
  correct: boolean | null;
  pointsAwarded: number | null;
  feedback: string | null;
}

export interface AttemptView {
  id: string;
  assignmentId: string;
  number: number;
  status: 'IN_PROGRESS' | 'SUBMITTED' | 'EXPIRED' | 'GRADED';
  title: string;
  language: string;
  instructions: string | null;
  deadlineAt: string | null;
  serverNow: string;
  submittedAt: string | null;
  review: 'NONE' | 'SCORE' | 'FULL';
  score: { value: number; max: number; percent: number; passed: boolean } | null;
  questions: AttemptQuestion[];
}

type Answer = string | string[] | null;
type SaveState = 'idle' | 'saving' | 'saved' | 'offline' | 'error';

const RETRY_MS = 15_000;
const TEXT_DEBOUNCE_MS = 800;
/** Hitos del reloj que se anuncian, en segundos restantes. */
const MILESTONES = [600, 300, 60];

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
  const inFlight = useRef(false);
  const textTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closed = useRef(false);

  // Deriva reloj cliente–servidor: `serverNow` llega con el render y se corrige con cada
  // `Date` que devuelve el autosave.
  const offset = useRef(new Date(attempt.serverNow).getTime() - Date.now());

  const flush = useCallback(async () => {
    if (inFlight.current || pending.current.size === 0 || closed.current) return;
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setSaveState('offline');
      return;
    }
    inFlight.current = true;
    setSaveState('saving');
    const batch = Object.fromEntries(pending.current);
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
        return;
      }
      if (!res.ok || !payload?.data) {
        setSaveState('error');
        return;
      }
      // Solo se descarta de la cola lo que se mandó tal cual; si la respuesta cambió
      // mientras viajaba, la nueva sigue pendiente.
      for (const [code, value] of Object.entries(batch)) {
        if (pending.current.get(code) === value) pending.current.delete(code);
      }
      setSavedAt(new Date(payload.data.savedAt));
      setSaveState(pending.current.size > 0 ? 'saving' : 'saved');
    } catch {
      setSaveState(typeof navigator !== 'undefined' && !navigator.onLine ? 'offline' : 'error');
    } finally {
      inFlight.current = false;
      if (pending.current.size > 0 && !closed.current) setTimeout(() => void flush(), 250);
    }
  }, [attempt.id, announce, router, t]);

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

  const setAnswer = (code: string, value: Answer, debounce = false) => {
    setAnswers((prev) => ({ ...prev, [code]: value }));
    pending.current.set(code, value);
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
      // Lo pendiente sale antes de entregar; si no llega, no se entrega.
      await flush();
      if (pending.current.size > 0) {
        setError(t('submitPendingError'));
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

  return (
    <div className="space-y-6">
      <div className="bg-surface-base border-border-muted rounded-card sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 border px-4 py-3">
        <p className="type-body m-0" role="status">
          {t('progress', { answered: answeredCount, total })}
          <span className="text-text-muted"> · </span>
          <SaveStatus state={saveState} savedAt={savedAt} />
        </p>
        {attempt.deadlineAt && (
          <Timer deadlineAt={attempt.deadlineAt} offset={offset} onExpired={onExpired} />
        )}
      </div>

      {attempt.instructions && <p className="type-body max-w-reading">{attempt.instructions}</p>}

      <div className="gap-8 lg:grid lg:grid-cols-[minmax(0,1fr)_16rem] lg:items-start">
        <ol className="space-y-8" aria-labelledby={headingId}>
          <h2 id={headingId} className="sr-only">
            {t('questionsHeading')}
          </h2>
          {attempt.questions.map((q, index) => (
            <li
              key={q.code}
              id={`pregunta-${index + 1}`}
              className={cn(index !== current && 'hidden lg:block')}
            >
              <Question
                question={q}
                index={index}
                total={total}
                language={attempt.language}
                value={answers[q.code] ?? null}
                onChange={(value, debounce) => setAnswer(q.code, value, debounce)}
              />
            </li>
          ))}
        </ol>

        <aside className="mt-8 lg:mt-0">
          <nav
            aria-label={t('indexLabel')}
            className="bg-surface-base border-border-muted rounded-card border p-4"
          >
            <p className="type-caption text-text-muted mb-2">{t('indexTitle')}</p>
            <ol className="grid grid-cols-6 gap-2 sm:grid-cols-8 lg:grid-cols-5">
              {attempt.questions.map((q, index) => {
                const done = isAnswered(answers[q.code] ?? null);
                return (
                  <li key={q.code}>
                    <a
                      href={`#pregunta-${index + 1}`}
                      onClick={(e) => {
                        e.preventDefault();
                        setCurrent(index);
                        document
                          .getElementById(`pregunta-${index + 1}`)
                          ?.querySelector<HTMLElement>('legend')
                          ?.focus();
                      }}
                      aria-current={index === current ? 'true' : undefined}
                      className={cn(
                        'rounded-control min-h-touch min-w-touch type-label inline-flex w-full items-center justify-center gap-1 border',
                        done
                          ? 'border-status-success-base bg-status-success-muted text-text'
                          : 'border-border bg-surface-sunken text-text-muted',
                        index === current && 'ring-focus-ring ring-2 ring-offset-1'
                      )}
                    >
                      <span className="sr-only">
                        {done
                          ? t('indexAnswered', { n: index + 1 })
                          : t('indexUnanswered', { n: index + 1 })}
                      </span>
                      <span aria-hidden="true">{index + 1}</span>
                    </a>
                  </li>
                );
              })}
            </ol>
          </nav>
        </aside>
      </div>

      {/* Anterior / siguiente: solo en móvil, donde se ve una pregunta por pantalla. */}
      <div className="flex items-center justify-between gap-3 lg:hidden">
        <Button
          type="button"
          variant="secondary"
          disabled={current === 0}
          onClick={() => setCurrent((c) => Math.max(0, c - 1))}
        >
          {t('previous')}
        </Button>
        <span className="type-caption text-text-muted">
          {t('position', { n: current + 1, total })}
        </span>
        <Button
          type="button"
          variant="secondary"
          disabled={current === total - 1}
          onClick={() => setCurrent((c) => Math.min(total - 1, c + 1))}
        >
          {t('next')}
        </Button>
      </div>

      {error && <Alert severity="error">{error}</Alert>}

      <div className="border-border flex flex-wrap items-center gap-3 border-t pt-4">
        <Button type="button" size="lg" onClick={() => setConfirming(true)}>
          {t('submit')}
        </Button>
        <span className="type-caption text-text-muted">{t('submitHint')}</span>
      </div>

      <Dialog.Root open={confirming} onOpenChange={(open) => !submitting && setConfirming(open)}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-40 bg-black/40" />
          <Dialog.Content className="bg-surface-base elevation-modal rounded-card fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-[28rem] -translate-x-1/2 -translate-y-1/2 p-6">
            <Dialog.Title className="type-subheading text-text">{t('confirmTitle')}</Dialog.Title>
            <Dialog.Description className="type-body text-text-muted mt-2">
              {unanswered.length === 0
                ? t('confirmAllAnswered')
                : t('confirmUnanswered', { count: unanswered.length })}
            </Dialog.Description>
            {unanswered.length > 0 && (
              <ul className="type-body mt-3 max-h-40 list-disc overflow-y-auto pl-5">
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
            <p className="type-caption text-text-muted mt-3">{t('confirmFinal')}</p>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <Dialog.Close asChild>
                <Button type="button" variant="secondary" disabled={submitting}>
                  {t('confirmBack')}
                </Button>
              </Dialog.Close>
              <Button type="button" disabled={submitting} onClick={() => void submit()}>
                {submitting ? t('submitting') : t('confirmSubmit')}
              </Button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
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

  const mm = Math.floor(left / 60);
  const ss = left % 60;
  const label = `${mm}:${ss.toString().padStart(2, '0')}`;

  return (
    <div className="flex items-center gap-2">
      <span
        role="timer"
        aria-live="off"
        aria-label={t('label', { minutes: mm, seconds: ss })}
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
}: {
  question: AttemptQuestion;
  index: number;
  total: number;
  language: string;
  value: Answer;
  onChange?: (value: Answer, debounce?: boolean) => void;
  review?: boolean;
}) {
  const t = useTranslations('learn.attempt');
  const id = useId();
  const readOnly = !onChange;

  const options =
    q.type === 'true_false' && q.options.length === 0
      ? [
          { code: 'true', text: t('true') },
          { code: 'false', text: t('false') },
        ]
      : q.options;

  return (
    <fieldset
      className={cn(
        'bg-surface-base border-border-muted rounded-card border p-5',
        review && q.correct === true && 'border-status-success-base',
        review && q.correct === false && 'border-status-error-base'
      )}
      lang={language}
      disabled={readOnly}
    >
      <legend tabIndex={-1} className="type-caption text-text-muted">
        {t('questionOf', { n: index + 1, total })} · {t('points', { count: q.points })}
        {review && q.pointsAwarded !== null && (
          <>
            {' · '}
            <span className={q.correct ? 'text-status-success-base' : 'text-status-error-base'}>
              {t('awarded', { points: q.pointsAwarded })}
            </span>
          </>
        )}
      </legend>
      <p className="type-body-emphasis mt-1 whitespace-pre-wrap">{q.text}</p>

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
                <label
                  htmlFor={optionId}
                  className={cn(
                    'rounded-control min-h-touch flex cursor-pointer items-center gap-3 border px-3 py-2',
                    checked ? 'border-accent-base bg-surface-sunken' : 'border-border-muted'
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
                  <span className="type-body">{opt.text}</span>
                </label>
              </li>
            );
          })}
        </ul>
      )}

      {review && q.feedback && (
        <p className="type-body text-text-muted border-border mt-3 border-l-2 pl-3">{q.feedback}</p>
      )}
    </fieldset>
  );
}

// ─────────────────────────── revisión ───────────────────────────

function AttemptReview({ attempt }: { attempt: AttemptView }) {
  const t = useTranslations('learn.attempt');
  const format = useFormatter();

  return (
    <div className="space-y-6">
      <section
        aria-label={t('resultLabel')}
        className={cn(
          'rounded-card border p-5',
          attempt.score?.passed
            ? 'border-status-success-base bg-status-success-muted'
            : attempt.score
              ? 'border-status-warning-base bg-status-warning-muted'
              : 'border-border-muted bg-surface-base'
        )}
      >
        <h2 className="type-heading inline-flex items-center gap-2">
          {attempt.status === 'EXPIRED' ? (
            <CircleX className="size-5" aria-hidden="true" />
          ) : attempt.score?.passed ? (
            <CircleCheck className="size-5" aria-hidden="true" />
          ) : (
            <Circle className="size-5" aria-hidden="true" />
          )}
          {attempt.status === 'EXPIRED' ? t('result.expired') : t('result.submitted')}
        </h2>
        {attempt.submittedAt && (
          <p className="type-caption text-text-muted mt-1">
            {t('result.submittedOn', {
              date: format.dateTime(new Date(attempt.submittedAt), {
                day: 'numeric',
                month: 'long',
                hour: 'numeric',
                minute: '2-digit',
              }),
            })}
          </p>
        )}
        {attempt.score ? (
          <p className="type-display mt-3" role="status">
            {t('result.score', {
              value: attempt.score.value,
              max: attempt.score.max,
              percent: attempt.score.percent,
            })}{' '}
            <Badge variant={attempt.score.passed ? 'success' : 'warning'}>
              {attempt.score.passed ? t('result.passed') : t('result.notPassed')}
            </Badge>
          </p>
        ) : (
          <p className="type-body mt-3" role="status">
            {attempt.status === 'EXPIRED' ? t('result.expiredBody') : t('result.hidden')}
          </p>
        )}
      </section>

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
