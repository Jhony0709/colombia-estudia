'use client';

/**
 * La entrega de un tema con `requiresSubmission` (plan/08-aprender-y-evaluar.md:42-44).
 *
 * Tres viajes cuando hay archivo, y en este orden: `POST /api/media/upload` pide sitio,
 * `PUT signedUrl` sube directo a Storage sin pasar por nuestro servidor, y
 * `POST /api/media/[id]/confirm` comprueba que el archivo es lo que dijo ser. Solo con el
 * asset `READY` se manda la entrega (`POST …/submission`). Si un paso falla, el estudiante
 * conserva lo escrito: el texto vive en el estado y no se borra hasta que el servidor
 * confirma.
 *
 * Qué muestra según el estado que devuelve el servidor:
 * - sin entrega o `RETURNED`: el formulario (con el comentario del revisor arriba, cuando lo
 *   hay);
 * - `SUBMITTED`: «en revisión» con fecha y un botón para corregirla (23/9): hasta que un
 *   instructor la revise, lo que está en cola es del estudiante y la puede reemplazar;
 * - `APPROVED`: aprobada; el tema ya quedó completado del lado del servidor.
 *
 * Qué pide el formulario lo decide el autor del tema (`accepts`, 23/9): solo texto, solo
 * archivo, o cualquiera de los dos. El servidor vuelve a comprobarlo.
 *
 * Con enunciados (`prompts`, 24/9, pedido de los clientes: «que no tengan que escribir en
 * otro lado y subir un PDF, sino ahí mismo, cuadrito por cuadrito, y al final enviar»): un
 * campo por pregunta en vez del texto único, el borrador guarda las respuestas juntas (JSON
 * en el mismo `useDraft`), y se envían como `answers[]` en el orden de los enunciados.
 */

import { useId, useRef, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations, useFormatter } from 'next-intl';
import { CircleCheck, Clock, FileText, RotateCcw } from 'lucide-react';
import { Button } from '@/components/atoms/button';
import { Alert } from '@/components/atoms/alert';
import { Label } from '@/components/atoms/label';
import { useAnnounce } from '@/lib/a11y/announce';
import { apiErrorText } from '@/lib/http/api-error-text';
import { cn } from '@/lib/utils';
import { useDraft } from '@/lib/net/draft';
import { useSlowRequest } from '@/lib/net/slow-request';
import { RequestStatus } from '@/components/molecules/request-status';

export type ActivityAccepts = 'TEXT' | 'FILE' | 'TEXT_OR_FILE';

export interface SubmissionViewProps {
  id: string;
  status: 'SUBMITTED' | 'RETURNED' | 'APPROVED';
  text: string | null;
  /** Respuestas por enunciado; vacío cuando la actividad era de un solo texto. */
  answers: Array<{ prompt: string; answer: string }>;
  file: { name: string; url: string } | null;
  feedback: string | null;
  submittedAt: string;
  reviewedAt: string | null;
}

/** Espejo de `lib/media/limits.ts` (SUBMISSION). Se comprueba aquí para avisar antes de subir. */
const ACCEPT = 'image/png,image/jpeg,application/pdf';
const ALLOWED = new Set(['image/png', 'image/jpeg', 'application/pdf']);
const MAX_BYTES = 20 * 1024 * 1024;

type Phase = 'idle' | 'uploading' | 'sending';

async function readJson(res: Response): Promise<unknown> {
  return res.json().catch(() => null);
}

/** Las respuestas del borrador: una lista del largo de los enunciados, o nada si no cuadra. */
function parseAnswers(raw: string, count: number): string[] | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      Array.isArray(parsed) &&
      parsed.length === count &&
      parsed.every((a) => typeof a === 'string')
    ) {
      return parsed as string[];
    }
  } catch {
    // No era JSON: era el texto único de antes; se ignora.
  }
  return null;
}

export function SubmissionForm({
  assignmentId,
  submission,
  dateLabel,
  accepts,
  prompts = [],
}: {
  assignmentId: string;
  submission: SubmissionViewProps | null;
  /** Qué entrega el estudiante, según el autor del tema. */
  accepts: ActivityAccepts;
  /** Enunciados (24/9): con uno o más, un campo por pregunta. */
  prompts?: string[];
  /**
   * La fecha de la entrega ya escrita, formateada en el servidor (21/9). Formatearla aquí
   * daba un error de hidratación: el ICU de Node dice «20 de septiembre, 10:59» y el de
   * Chrome «20 de septiembre a las 10:59», y React lo trata como HTML distinto.
   */
  dateLabel: string | null;
}) {
  const t = useTranslations('learn.submission');
  // Solo para el tamaño del archivo elegido, que nace en el cliente y no se hidrata.
  const format = useFormatter();
  const router = useRouter();
  const { announce } = useAnnounce();
  const tn = useTranslations('net');
  const ids = { text: useId(), file: useId(), error: useId() };

  // Lo escrito se conserva para corregirlo, tanto si la devolvieron como si la quiere
  // reemplazar antes de que la revisen. Y se guarda en el aparato mientras se escribe (E1,
  // 23/9): una recarga o una petición que nunca contesta no se lo llevan.
  const hasPrompts = accepts !== 'FILE' && prompts.length > 0;
  const editable = submission?.status === 'RETURNED' || submission?.status === 'SUBMITTED';
  const draft = useDraft(
    `submission.${assignmentId}`,
    hasPrompts
      ? JSON.stringify(
          // Al corregir, cada respuesta vuelve a su pregunta (por texto, y por posición si el
          // autor la reescribió mientras tanto).
          prompts.map((prompt, i) =>
            editable
              ? (submission.answers.find((a) => a.prompt === prompt)?.answer ??
                submission.answers[i]?.answer ??
                '')
              : ''
          )
        )
      : editable
        ? (submission.text ?? '')
        : ''
  );
  const text = draft.text;
  const setText = draft.setText;
  // Con enunciados, el borrador es la lista de respuestas en JSON; se lee y escribe entera.
  const answers = hasPrompts
    ? (parseAnswers(draft.text, prompts.length) ?? prompts.map(() => ''))
    : [];
  const setAnswer = (index: number, value: string) => {
    const next = [...answers];
    next[index] = value;
    setText(JSON.stringify(next));
  };
  // La espera que se ve: «está tardando», «no pudimos», reintentar (E1).
  const wait = useSlowRequest({ screen: 'lesson', action: 'submit', request: 'submission' });
  const [file, setFile] = useState<File | null>(null);
  const [phase, setPhase] = useState<Phase>('idle');
  const [error, setError] = useState<string | null>(null);
  const [replacing, setReplacing] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const date = (_iso: string) => dateLabel ?? '';
  const wantsText = accepts !== 'FILE' && !hasPrompts;
  const wantsFile = accepts !== 'TEXT';

  if (submission?.status === 'SUBMITTED' && !replacing) {
    return (
      <SubmissionPanel icon={Clock} tone="info" title={t('sent.title')}>
        <p className="type-body">{t('sent.body', { date: date(submission.submittedAt) })}</p>
        <Summary submission={submission} />
        {/* Hasta que la revisen, sigue siendo suya: puede cambiarla (23/9). */}
        <div>
          <Button type="button" variant="secondary" onClick={() => setReplacing(true)}>
            {t('sent.replace')}
          </Button>
          <p className="type-caption text-text-muted mt-1">{t('sent.replaceHint')}</p>
        </div>
      </SubmissionPanel>
    );
  }

  if (submission?.status === 'APPROVED') {
    return (
      <SubmissionPanel icon={CircleCheck} tone="success" title={t('approved.title')}>
        <p className="type-body">
          {t('approved.body', { date: date(submission.reviewedAt ?? submission.submittedAt) })}
        </p>
        {submission.feedback && <Quote label={t('feedbackLabel')} text={submission.feedback} />}
        <Summary submission={submission} />
      </SubmissionPanel>
    );
  }

  const onFileChange = (chosen: File | null) => {
    setError(null);
    if (!chosen) return setFile(null);
    if (!ALLOWED.has(chosen.type)) {
      setFile(null);
      if (fileInput.current) fileInput.current.value = '';
      return setError(t('errors.type'));
    }
    if (chosen.size > MAX_BYTES) {
      setFile(null);
      if (fileInput.current) fileInput.current.value = '';
      return setError(t('errors.size'));
    }
    setFile(chosen);
  };

  const onSubmit = async (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
    setError(null);
    wait.reset();
    const trimmed = wantsText ? text.trim() : '';
    const trimmedAnswers = hasPrompts ? answers.map((a) => a.trim()) : [];
    if (accepts === 'FILE' && !file) return setError(t('errors.needFile'));
    if (hasPrompts && trimmedAnswers.some((a) => a === '')) {
      return setError(t('errors.answerAll'));
    }
    if (!hasPrompts && accepts === 'TEXT' && !trimmed) return setError(t('errors.needText'));
    if (!hasPrompts && !trimmed && !file) return setError(t('errors.empty'));

    // Un fallo de servidor (respuesta con error) se dice con su texto; un `fetch` que
    // lanza (sin respuesta) lo recoge `wait` como `failed` con «Reintentar». En los dos
    // casos el texto y el archivo siguen en su sitio.
    const sent = await wait.run(async () => {
      let fileAssetId: string | null = null;

      if (file) {
        setPhase('uploading');
        const ticketRes = await fetch('/api/media/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ kind: 'SUBMISSION', mimeType: file.type, sizeBytes: file.size }),
        });
        const ticket = (await readJson(ticketRes)) as {
          data?: { mediaAssetId: string; signedUrl: string };
        } | null;
        if (!ticketRes.ok || !ticket?.data) {
          setError(apiErrorText(ticket, t('errors.upload')));
          return false;
        }

        const put = await fetch(ticket.data.signedUrl, {
          method: 'PUT',
          headers: { 'Content-Type': file.type, 'x-upsert': 'false' },
          body: file,
        });
        if (!put.ok) {
          setError(t('errors.upload'));
          return false;
        }

        const confirmRes = await fetch(`/api/media/${ticket.data.mediaAssetId}/confirm`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        });
        const confirmed = await readJson(confirmRes);
        if (!confirmRes.ok) {
          setError(apiErrorText(confirmed, t('errors.upload')));
          return false;
        }
        fileAssetId = ticket.data.mediaAssetId;
      }

      setPhase('sending');
      const res = await fetch(`/api/learn/lessons/${assignmentId}/submission`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: trimmed || undefined,
          answers: hasPrompts ? trimmedAnswers : undefined,
          fileAssetId,
        }),
      });
      const payload = await readJson(res);
      if (!res.ok) {
        setError(apiErrorText(payload, t('errors.send')));
        return false;
      }
      return true;
    });
    setPhase('idle');

    if (sent) {
      draft.clear();
      announce(t('sentAnnounce'));
      router.refresh();
    }
  };

  const busy = phase !== 'idle';

  return (
    <section aria-labelledby={`${ids.text}-heading`} className="mt-8 space-y-4">
      <h2 id={`${ids.text}-heading`} className="type-heading">
        {submission?.status === 'RETURNED'
          ? t('returned.title')
          : replacing
            ? t('replacing.title')
            : t('title')}
      </h2>

      {replacing && <Alert severity="info">{t('replacing.body')}</Alert>}
      {draft.restored && <Alert severity="info">{tn('draftRestored')}</Alert>}

      {submission?.status === 'RETURNED' && (
        <Alert severity="warning">
          <p>
            {t('returned.body', { date: date(submission.reviewedAt ?? submission.submittedAt) })}
          </p>
          {submission.feedback && <Quote label={t('feedbackLabel')} text={submission.feedback} />}
        </Alert>
      )}

      <form onSubmit={onSubmit} noValidate className="space-y-4">
        {hasPrompts && (
          <ol className="space-y-4">
            {prompts.map((prompt, index) => (
              <li key={index} className="space-y-1.5">
                <Label htmlFor={`${ids.text}-${index}`}>
                  <span className="text-text-muted mr-1 tabular-nums">{index + 1}.</span>
                  {prompt}
                </Label>
                <textarea
                  id={`${ids.text}-${index}`}
                  name={`answer-${index}`}
                  value={answers[index] ?? ''}
                  onChange={(e) => setAnswer(index, e.target.value)}
                  rows={4}
                  maxLength={5_000}
                  disabled={busy}
                  aria-describedby={error ? ids.error : undefined}
                  className={cn(
                    'rounded-control border-border bg-surface-sunken text-text type-body w-full border px-3 py-2',
                    'focus:border-accent-base duration-fast ease-standard transition-colors',
                    busy && 'text-text-subtle cursor-not-allowed'
                  )}
                />
              </li>
            ))}
            <li className="type-caption text-text-muted list-none">{t('answersHint')}</li>
          </ol>
        )}

        {wantsText && (
          <div className="space-y-1.5">
            <Label htmlFor={ids.text}>{t('textLabel')}</Label>
            <textarea
              id={ids.text}
              name="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={8}
              maxLength={20_000}
              disabled={busy}
              aria-describedby={error ? ids.error : undefined}
              className={cn(
                'rounded-control border-border bg-surface-sunken text-text type-body w-full border px-3 py-2',
                'focus:border-accent-base duration-fast ease-standard transition-colors',
                busy && 'text-text-subtle cursor-not-allowed'
              )}
            />
            <p className="type-caption text-text-muted">
              {t(`textHint.${accepts}` as 'textHint.TEXT')}
            </p>
          </div>
        )}

        {wantsFile && (
          <div className="space-y-1.5">
            <Label htmlFor={ids.file}>{t(`fileLabel.${accepts}` as 'fileLabel.FILE')}</Label>
            <input
              ref={fileInput}
              id={ids.file}
              type="file"
              name="file"
              accept={ACCEPT}
              disabled={busy}
              onChange={(e) => onFileChange(e.target.files?.[0] ?? null)}
              className="type-body text-text block w-full"
            />
            <p className="type-caption text-text-muted">{t('fileHint')}</p>
            {file && (
              <p className="type-caption text-text inline-flex items-center gap-1.5">
                <FileText className="size-4" aria-hidden="true" />
                {file.name} · {format.number(file.size / 1024 / 1024, { maximumFractionDigits: 1 })}{' '}
                MB
              </p>
            )}
          </div>
        )}

        {error && (
          <Alert severity="error" className="mt-2">
            <span id={ids.error}>{error}</span>
          </Alert>
        )}

        <RequestStatus
          phase={wait.phase}
          elapsedSeconds={wait.elapsedSeconds}
          onRetry={() => void onSubmit()}
          kept={wantsText || hasPrompts ? 'text' : 'nothing'}
        />
        {wait.phase === 'failed' && file && (
          <p className="type-caption text-text-muted">{tn('fileKept')}</p>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={busy}>
            {phase === 'uploading'
              ? t('uploading')
              : phase === 'sending'
                ? t('sending')
                : submission?.status === 'RETURNED' || replacing
                  ? t('resend')
                  : t('send')}
          </Button>
          {replacing && (
            <Button
              type="button"
              variant="quiet"
              disabled={busy}
              onClick={() => setReplacing(false)}
            >
              {t('replacing.cancel')}
            </Button>
          )}
          {submission?.status === 'RETURNED' && (
            <span className="type-caption text-text-muted inline-flex items-center gap-1">
              <RotateCcw className="size-3.5" aria-hidden="true" />
              {t('returned.hint')}
            </span>
          )}
        </div>
      </form>
    </section>
  );
}

function SubmissionPanel({
  icon: Icon,
  tone,
  title,
  children,
}: {
  icon: typeof Clock;
  tone: 'info' | 'success';
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section
      aria-label={title}
      className={cn(
        'rounded-card mt-8 border p-4 sm:p-5',
        tone === 'success'
          ? 'border-status-success-base bg-status-success-muted'
          : 'border-status-info-base bg-status-info-muted'
      )}
    >
      <h2 className="type-heading inline-flex items-center gap-2">
        <Icon className="size-5" aria-hidden="true" />
        {title}
      </h2>
      <div className="mt-2 space-y-3">{children}</div>
    </section>
  );
}

function Quote({ label, text }: { label: string; text: string }) {
  return (
    <blockquote className="border-border mt-2 border-l-2 pl-3">
      <p className="type-caption text-text-muted">{label}</p>
      <p className="type-body whitespace-pre-wrap">{text}</p>
    </blockquote>
  );
}

function Summary({ submission }: { submission: SubmissionViewProps }) {
  const t = useTranslations('learn.submission');
  if (!submission.text && !submission.file && submission.answers.length === 0) return null;
  return (
    <details className="type-body">
      <summary className="text-text-link min-h-touch inline-flex cursor-pointer items-center underline">
        {t('viewMine')}
      </summary>
      <div className="mt-2 space-y-2">
        {submission.answers.length > 0 && (
          <ol className="space-y-2">
            {submission.answers.map((a, i) => (
              <li key={i}>
                <p className="type-caption text-text-muted m-0">
                  {i + 1}. {a.prompt}
                </p>
                <p className="m-0 whitespace-pre-wrap">{a.answer}</p>
              </li>
            ))}
          </ol>
        )}
        {submission.text && <p className="whitespace-pre-wrap">{submission.text}</p>}
        {submission.file && (
          <a
            href={submission.file.url}
            className="text-text-link inline-flex items-center gap-1.5 underline"
            download
          >
            <FileText className="size-4" aria-hidden="true" />
            {submission.file.name}
          </a>
        )}
      </div>
    </details>
  );
}
