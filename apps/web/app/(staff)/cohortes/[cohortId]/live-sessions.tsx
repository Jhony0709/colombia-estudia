'use client';

/**
 * Sesiones en vivo de la cohorte: lista, alta, edición y archivo.
 * SSOT: plan/08 §5, endpoints.md:80.
 *
 * Las fechas se piden con `datetime-local` (hora de quien escribe, que es Bogotá) y se
 * mandan como ISO con zona; el servidor guarda UTC y el calendario del estudiante las
 * vuelve a pintar en su hora.
 */

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations, useFormatter } from 'next-intl';
import { FormField, FormInput } from '@/components/atoms/form-field';
import { Button } from '@/components/atoms/button';
import { Alert } from '@/components/atoms/alert';
import { Badge } from '@/components/atoms/badge';
import { useAnnounce } from '@/lib/a11y/announce';
import { apiErrorText } from '@/lib/http/api-error-text';

export interface LiveSessionItem {
  id: string;
  title: string;
  description: string | null;
  startsAt: string;
  endsAt: string;
  url: string;
  recordingId: string | null;
  archived: boolean;
}

interface Draft {
  title: string;
  description: string;
  startsAt: string;
  endsAt: string;
  url: string;
}

/** ISO → valor de `datetime-local` en la hora local del navegador. */
function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const EMPTY: Draft = { title: '', description: '', startsAt: '', endsAt: '', url: '' };

export function LiveSessions({
  cohortId,
  sessions,
}: {
  cohortId: string;
  sessions: LiveSessionItem[];
}) {
  const t = useTranslations('liveSessions');
  const format = useFormatter();
  const router = useRouter();
  const { announce } = useAnnounce();
  const [editing, setEditing] = useState<'new' | string | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const when = (iso: string) =>
    format.dateTime(new Date(iso), {
      day: 'numeric',
      month: 'short',
      hour: 'numeric',
      minute: '2-digit',
    });

  const open = (target: 'new' | LiveSessionItem) => {
    setError(null);
    if (target === 'new') {
      setDraft(EMPTY);
      setEditing('new');
    } else {
      setDraft({
        title: target.title,
        description: target.description ?? '',
        startsAt: toLocalInput(target.startsAt),
        endsAt: toLocalInput(target.endsAt),
        url: target.url,
      });
      setEditing(target.id);
    }
  };

  const send = async (url: string, method: 'POST' | 'PATCH', body: unknown, done: string) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok) {
        setError(apiErrorText(payload, t('error')));
        return false;
      }
      announce(done);
      router.refresh();
      return true;
    } catch {
      setError(t('error'));
      return false;
    } finally {
      setBusy(false);
    }
  };

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const body = {
      title: draft.title,
      description: draft.description || undefined,
      startsAt: new Date(draft.startsAt).toISOString(),
      endsAt: new Date(draft.endsAt).toISOString(),
      url: draft.url,
    };
    if (!draft.startsAt || !draft.endsAt) return setError(t('datesRequired'));
    const ok =
      editing === 'new'
        ? await send(`/api/cohorts/${cohortId}/live-sessions`, 'POST', body, t('created'))
        : await send(
            `/api/cohorts/${cohortId}/live-sessions/${editing}`,
            'PATCH',
            body,
            t('updated')
          );
    if (ok) setEditing(null);
  };

  const toggleArchive = (s: LiveSessionItem) =>
    send(
      `/api/cohorts/${cohortId}/live-sessions/${s.id}`,
      'PATCH',
      { archived: !s.archived },
      s.archived ? t('restored') : t('archived')
    );

  const visible = sessions.filter((s) => !s.archived);
  const archived = sessions.filter((s) => s.archived);

  return (
    <div className="space-y-4">
      {error && <Alert severity="error">{error}</Alert>}

      {visible.length === 0 && editing !== 'new' && (
        <p className="type-body text-text-muted m-0">{t('empty')}</p>
      )}

      {visible.length > 0 && (
        <ul className="divide-border-muted divide-y">
          {visible.map((s) => (
            <li key={s.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="type-body-emphasis m-0">{s.title}</p>
                <p className="type-caption text-text-muted m-0">
                  {when(s.startsAt)} → {when(s.endsAt)}
                  {s.recordingId ? ` · ${t('hasRecording')}` : ''}
                </p>
                {s.description && <p className="type-caption m-0 mt-1">{s.description}</p>}
                <a
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-text-link type-caption underline underline-offset-4"
                >
                  {t('link')}
                </a>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="quiet"
                  onClick={() => open(s)}
                  disabled={busy}
                  aria-label={t('editNamed', { title: s.title })}
                >
                  {t('edit')}
                </Button>
                <Button
                  variant="quiet"
                  onClick={() => void toggleArchive(s)}
                  disabled={busy}
                  aria-label={t('archiveNamed', { title: s.title })}
                >
                  {t('archive')}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {editing !== null ? (
        <form
          onSubmit={onSubmit}
          noValidate
          className="border-border-muted rounded-card space-y-3 border p-4"
        >
          <h3 className="type-body-emphasis">
            {editing === 'new' ? t('newTitle') : t('editTitle')}
          </h3>
          <FormField label={t('title')} name="title" required>
            <FormInput
              name="title"
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
            />
          </FormField>
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField label={t('startsAt')} name="startsAt" required>
              <FormInput
                name="startsAt"
                type="datetime-local"
                value={draft.startsAt}
                onChange={(e) => setDraft({ ...draft, startsAt: e.target.value })}
              />
            </FormField>
            <FormField label={t('endsAt')} name="endsAt" required>
              <FormInput
                name="endsAt"
                type="datetime-local"
                value={draft.endsAt}
                onChange={(e) => setDraft({ ...draft, endsAt: e.target.value })}
              />
            </FormField>
          </div>
          <FormField label={t('url')} name="url" required hint={t('urlHint')}>
            <FormInput
              name="url"
              type="url"
              value={draft.url}
              onChange={(e) => setDraft({ ...draft, url: e.target.value })}
            />
          </FormField>
          <FormField label={t('description')} name="description">
            <FormInput
              name="description"
              value={draft.description}
              onChange={(e) => setDraft({ ...draft, description: e.target.value })}
            />
          </FormField>
          <div className="flex gap-2">
            <Button
              type="submit"
              loading={busy}
              disabled={!draft.title.trim() || !draft.url.trim()}
            >
              {editing === 'new' ? t('create') : t('save')}
            </Button>
            <Button variant="quiet" onClick={() => setEditing(null)} disabled={busy}>
              {t('cancel')}
            </Button>
          </div>
        </form>
      ) : (
        <Button variant="secondary" onClick={() => open('new')} disabled={busy}>
          {t('new')}
        </Button>
      )}

      {archived.length > 0 && (
        <details className="type-caption">
          <summary className="text-text-muted min-h-touch inline-flex cursor-pointer items-center">
            {t('archivedCount', { count: archived.length })}
          </summary>
          <ul className="mt-2 space-y-2">
            {archived.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-2">
                <span>
                  <Badge variant="neutral">{t('archivedBadge')}</Badge> {s.title} ·{' '}
                  {when(s.startsAt)}
                </span>
                <Button variant="quiet" onClick={() => void toggleArchive(s)} disabled={busy}>
                  {t('restore')}
                </Button>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
