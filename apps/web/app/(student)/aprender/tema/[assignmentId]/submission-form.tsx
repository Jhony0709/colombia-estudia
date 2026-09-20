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
 * - `SUBMITTED`: «en revisión» con fecha, sin formulario —reenviar sin devolución sería
 *   pisar lo que el instructor está leyendo—;
 * - `APPROVED`: aprobada; el tema ya quedó completado del lado del servidor.
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

export interface SubmissionViewProps {
  id: string;
  status: 'SUBMITTED' | 'RETURNED' | 'APPROVED';
  text: string | null;
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

export function SubmissionForm({
  assignmentId,
  submission,
}: {
  assignmentId: string;
  submission: SubmissionViewProps | null;
}) {
  const t = useTranslations('learn.submission');
  const format = useFormatter();
  const router = useRouter();
  const { announce } = useAnnounce();
  const ids = { text: useId(), file: useId(), error: useId() };

  const [text, setText] = useState(
    submission?.status === 'RETURNED' ? (submission.text ?? '') : ''
  );
  const [file, setFile] = useState<File | null>(null);
  const [phase, setPhase] = useState<Phase>('idle');
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const date = (iso: string) =>
    format.dateTime(new Date(iso), {
      day: 'numeric',
      month: 'long',
      hour: 'numeric',
      minute: '2-digit',
    });

  if (submission?.status === 'SUBMITTED') {
    return (
      <SubmissionPanel icon={Clock} tone="info" title={t('sent.title')}>
        <p className="type-body">{t('sent.body', { date: date(submission.submittedAt) })}</p>
        <Summary submission={submission} />
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

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    const trimmed = text.trim();
    if (!trimmed && !file) return setError(t('errors.empty'));

    try {
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
          return setError(apiErrorText(ticket, t('errors.upload')));
        }

        const put = await fetch(ticket.data.signedUrl, {
          method: 'PUT',
          headers: { 'Content-Type': file.type, 'x-upsert': 'false' },
          body: file,
        });
        if (!put.ok) return setError(t('errors.upload'));

        const confirmRes = await fetch(`/api/media/${ticket.data.mediaAssetId}/confirm`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        });
        const confirmed = await readJson(confirmRes);
        if (!confirmRes.ok) return setError(apiErrorText(confirmed, t('errors.upload')));
        fileAssetId = ticket.data.mediaAssetId;
      }

      setPhase('sending');
      const res = await fetch(`/api/learn/lessons/${assignmentId}/submission`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: trimmed || undefined, fileAssetId }),
      });
      const payload = await readJson(res);
      if (!res.ok) return setError(apiErrorText(payload, t('errors.send')));

      announce(t('sentAnnounce'));
      router.refresh();
    } catch {
      setError(t('errors.send'));
    } finally {
      setPhase('idle');
    }
  };

  const busy = phase !== 'idle';

  return (
    <section aria-labelledby={`${ids.text}-heading`} className="mt-8 space-y-4">
      <h2 id={`${ids.text}-heading`} className="type-heading">
        {submission?.status === 'RETURNED' ? t('returned.title') : t('title')}
      </h2>

      {submission?.status === 'RETURNED' && (
        <Alert severity="warning">
          <p>
            {t('returned.body', { date: date(submission.reviewedAt ?? submission.submittedAt) })}
          </p>
          {submission.feedback && <Quote label={t('feedbackLabel')} text={submission.feedback} />}
        </Alert>
      )}

      <form onSubmit={onSubmit} noValidate className="space-y-4">
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
          <p className="type-caption text-text-muted">{t('textHint')}</p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor={ids.file}>{t('fileLabel')}</Label>
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

        {error && (
          <Alert severity="error" className="mt-2">
            <span id={ids.error}>{error}</span>
          </Alert>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={busy}>
            {phase === 'uploading'
              ? t('uploading')
              : phase === 'sending'
                ? t('sending')
                : submission?.status === 'RETURNED'
                  ? t('resend')
                  : t('send')}
          </Button>
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
  if (!submission.text && !submission.file) return null;
  return (
    <details className="type-body">
      <summary className="text-text-link min-h-touch inline-flex cursor-pointer items-center underline">
        {t('viewMine')}
      </summary>
      <div className="mt-2 space-y-2">
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
