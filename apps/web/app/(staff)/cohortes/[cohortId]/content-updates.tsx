'use client';

/**
 * Actualizaciones del programa (23/9): lo publicado que la cohorte abierta no tiene, con
 * su botón para añadirlo. Uno a uno o todo. Al añadir, la ruta del estudiante lo enseña en
 * su sitio (mismo `sortItems`) desde ese momento.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { BookOpen, ClipboardCheck } from 'lucide-react';
import type { PendingContentUpdate } from '@/features/cohorts/server/cohorts.service';
import { Alert } from '@/components/atoms/alert';
import { Badge } from '@/components/atoms/badge';
import { Button } from '@/components/atoms/button';

export function ContentUpdates({
  cohortId,
  updates,
}: {
  cohortId: string;
  updates: PendingContentUpdate[];
}) {
  const t = useTranslations('cohorts.updates');
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const add = async (items: Array<{ kind: 'lesson' | 'assessment'; id: string }>, key: string) => {
    setBusy(key);
    setError(null);
    setDone(null);
    try {
      const res = await fetch(`/api/cohorts/${cohortId}/content`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      });
      const payload = await res.json();
      if (!res.ok) {
        setError(payload?.error?.message ?? 'No se pudo añadir.');
        return;
      }
      const result = (payload.data ?? payload) as { assigned: number };
      setDone(t('added', { count: result.assigned }));
      router.refresh();
    } catch {
      setError('No se pudo añadir.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Badge variant="info">{t('count', { count: updates.length })}</Badge>
        <Button
          variant="secondary"
          loading={busy === 'all'}
          disabled={busy !== null}
          onClick={() => add([], 'all')}
        >
          {t('addAll')}
        </Button>
      </div>

      <ul className="divide-border-muted divide-y">
        {updates.map((u) => {
          const Icon = u.kind === 'lesson' ? BookOpen : ClipboardCheck;
          const key = `${u.kind}:${u.id}`;
          return (
            <li key={key} className="flex flex-wrap items-center gap-3 py-3">
              <Icon aria-hidden className="text-text-muted size-5 shrink-0" />
              <span className="min-w-0 flex-1">
                <span className="type-body-emphasis text-text block">{u.title}</span>
                <span className="type-caption text-text-muted block">
                  {t(`kind.${u.kind}`)}
                  {u.moduleName ? ` · ${u.moduleName}` : ''} ·{' '}
                  {t('version', { number: u.versionNumber })}
                </span>
              </span>
              <Button
                variant="quiet"
                loading={busy === key}
                disabled={busy !== null}
                onClick={() => add([{ kind: u.kind, id: u.id }], key)}
              >
                {t('add')}
              </Button>
            </li>
          );
        })}
      </ul>

      <div role="status" aria-live="polite">
        {error && <Alert severity="error">{error}</Alert>}
        {done && <Alert severity="success">{done}</Alert>}
      </div>
    </div>
  );
}
