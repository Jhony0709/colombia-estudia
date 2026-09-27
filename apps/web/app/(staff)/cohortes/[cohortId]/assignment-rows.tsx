'use client';

/**
 * Las asignaciones de la cohorte con su versión (ola 2 UX, 23/9): qué estudia hoy la
 * cohorte y, cuando el autor publicó algo más nuevo, «Actualizar a vN». El botón dice si la
 * versión nueva reabre el tema a quien ya lo completó, porque eso es lo que decide.
 *
 * Desde el 27/9 la asignación sigue sola a la versión publicada; «Fijar en vN» es la
 * excepción para la cohorte que no quiere que le muevan el piso, y «Seguir la última versión»
 * la suelta y la pone al día en el acto. «Actualizar a vN» queda para lo que se quedó atrás.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { BookOpen, ClipboardCheck, Pin, PinOff } from 'lucide-react';
import { Badge } from '@/components/atoms/badge';
import { Button } from '@/components/atoms/button';
import { Alert } from '@/components/atoms/alert';
import { apiErrorText } from '@/lib/http/api-error-text';
import type { CohortAssignmentItem } from '@/features/cohorts/server/assignments.service';

export function AssignmentRows({ items }: { items: CohortAssignmentItem[] }) {
  const t = useTranslations('cohorts.route');
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const update = async (item: CohortAssignmentItem) => {
    setBusy(item.assignmentId);
    setError(null);
    setDone(null);
    try {
      const res = await fetch(`/api/cohorts/assignments/${item.assignmentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: item.kind === 'LESSON' ? 'lesson' : 'assessment' }),
      });
      const payload = (await res.json().catch(() => null)) as {
        data?: { to: number; reopened: number };
      } | null;
      if (!res.ok || !payload?.data) {
        setError(apiErrorText(payload, t('updateError')));
        return;
      }
      setDone(
        t('updated', {
          title: item.title,
          number: payload.data.to,
          reopened: payload.data.reopened,
        })
      );
      router.refresh();
    } catch {
      setError(t('updateError'));
    } finally {
      setBusy(null);
    }
  };

  const setPinned = async (item: CohortAssignmentItem, pinned: boolean) => {
    setBusy(item.assignmentId);
    setError(null);
    setDone(null);
    try {
      const res = await fetch(`/api/cohorts/assignments/${item.assignmentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: item.kind === 'LESSON' ? 'lesson' : 'assessment', pinned }),
      });
      const payload = (await res.json().catch(() => null)) as {
        data?: { pinned: boolean; to: number; reopened: number };
      } | null;
      if (!res.ok || !payload?.data) {
        setError(apiErrorText(payload, t('updateError')));
        return;
      }
      setDone(
        pinned
          ? t('pinnedDone', { title: item.title, number: item.assigned.number })
          : t('unpinnedDone', { title: item.title, to: payload.data.to })
      );
      router.refresh();
    } catch {
      setError(t('updateError'));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-3">
      <div role="status" aria-live="polite">
        {error && <Alert severity="error">{error}</Alert>}
        {done && <Alert severity="success">{done}</Alert>}
      </div>
      <ul className="divide-border-muted divide-y">
        {items.map((item) => {
          const Icon = item.kind === 'LESSON' ? BookOpen : ClipboardCheck;
          const outdated = item.latest !== null && item.latest.number > item.assigned.number;
          return (
            <li
              key={item.assignmentId}
              className={
                item.kind === 'ASSESSMENT' && item.lessonId
                  ? 'border-border-muted ml-6 flex flex-wrap items-center gap-3 border-l py-2 pl-3'
                  : 'flex flex-wrap items-center gap-3 py-2'
              }
            >
              <Icon aria-hidden className="text-text-muted size-4 shrink-0" />
              <span className="type-body text-text min-w-0 flex-1">{item.title}</span>
              <Badge variant={outdated ? 'warning' : 'neutral'}>
                {t('version', { number: item.assigned.number })}
              </Badge>
              {item.pinned && <Badge variant="neutral">{t('pinned')}</Badge>}
              <Button
                type="button"
                variant="quiet"
                loading={busy === item.assignmentId}
                title={item.pinned ? undefined : t('pinHint')}
                onClick={() => void setPinned(item, !item.pinned)}
              >
                {item.pinned ? (
                  <PinOff aria-hidden className="size-4" />
                ) : (
                  <Pin aria-hidden className="size-4" />
                )}
                {item.pinned ? t('unpin') : t('pin', { number: item.assigned.number })}
              </Button>
              {outdated && item.latest && (
                <div className="flex flex-col items-end gap-1">
                  <Button
                    type="button"
                    variant="secondary"
                    loading={busy === item.assignmentId}
                    onClick={() => void update(item)}
                  >
                    {t('updateTo', { number: item.latest.number })}
                  </Button>
                  <span className="type-caption text-text-muted">
                    {item.latest.invalidatesProgress ? t('reopens') : t('keepsProgress')}
                  </span>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
