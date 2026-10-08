'use client';

/**
 * Los componentes de la ruta y su habilitación para esta matrícula (3/10, cliente): el primero
 * abierto; los demás, «Habilitar» de un clic, con fechas opcionales, y «Bloquear» para deshacer.
 * `cohort.manage`. SSOT: endpoints.md (PUT …/modules/[moduleId]).
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Lock, LockOpen } from 'lucide-react';
import { FormField, FormInput } from '@/components/atoms/form-field';
import { Button } from '@/components/atoms/button';
import { Badge } from '@/components/atoms/badge';
import { Alert } from '@/components/atoms/alert';
import { useAnnounce } from '@/lib/a11y/announce';
import { apiErrorText } from '@/lib/http/api-error-text';
import type { ModuleAccessRow } from '@/features/cohorts/server/module-access.service';

const TONE: Record<ModuleAccessRow['state'], 'success' | 'neutral' | 'info' | 'warning'> = {
  OPEN: 'success',
  LOCKED: 'neutral',
  NOT_YET: 'info',
  CLOSED: 'warning',
};

export function ModuleAccess({
  enrollmentId,
  modules,
  canManage,
}: {
  enrollmentId: string;
  modules: ModuleAccessRow[];
  canManage: boolean;
}) {
  return (
    <ul className="divide-border-muted m-0 list-none divide-y p-0">
      {modules.map((row) => (
        <ModuleRow key={row.moduleId} enrollmentId={enrollmentId} row={row} canManage={canManage} />
      ))}
    </ul>
  );
}

function ModuleRow({
  enrollmentId,
  row,
  canManage,
}: {
  enrollmentId: string;
  row: ModuleAccessRow;
  canManage: boolean;
}) {
  const t = useTranslations('enrollmentDetail.modules');
  const router = useRouter();
  const { announce } = useAnnounce();
  const [editing, setEditing] = useState(false);
  const [from, setFrom] = useState(row.availableFrom ?? '');
  const [until, setUntil] = useState(row.availableUntil ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const unlocked = row.state !== 'LOCKED';
  const ids = { from: `from-${row.moduleId}`, until: `until-${row.moduleId}` };

  async function save(input: {
    unlocked: boolean;
    availableFrom?: string;
    availableUntil?: string;
  }) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/cohorts/enrollments/${enrollmentId}/modules/${row.moduleId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          unlocked: input.unlocked,
          availableFrom: input.availableFrom || null,
          availableUntil: input.availableUntil || null,
        }),
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok) return setError(apiErrorText(payload, t('error')));
      announce(
        input.unlocked ? t('unlocked', { name: row.name }) : t('locked', { name: row.name })
      );
      setEditing(false);
      router.refresh();
    } catch {
      setError(t('error'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="space-y-3 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          {unlocked ? (
            <LockOpen aria-hidden className="text-status-success-base size-4 shrink-0" />
          ) : (
            <Lock aria-hidden className="text-text-muted size-4 shrink-0" />
          )}
          <div className="min-w-0">
            <p className="type-body-emphasis m-0">
              {t('position', { position: row.position })} · {row.name}
            </p>
            <p className="type-caption text-text-muted m-0">
              {row.first
                ? t('first')
                : row.unlockedAt
                  ? t('unlockedBy', {
                      name: row.unlockedByName ?? t('someone'),
                      date: new Intl.DateTimeFormat('es-CO', {
                        day: 'numeric',
                        month: 'short',
                      }).format(new Date(row.unlockedAt)),
                    })
                  : t('waiting')}
              {row.availableFrom || row.availableUntil
                ? ` · ${t('window', { from: row.availableFrom ?? '—', until: row.availableUntil ?? '—' })}`
                : ''}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* 6/10: el estudiante lo pidió desde su ruta; habilitar cierra la solicitud. */}
          {row.requestedAt && row.state === 'LOCKED' && (
            <Badge variant="info">
              {t('requested', {
                date: new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short' }).format(
                  new Date(row.requestedAt)
                ),
              })}
            </Badge>
          )}
          <Badge variant={TONE[row.state]}>{t(`state.${row.state}`)}</Badge>
          {canManage && !row.first && !editing && (
            <>
              {!unlocked && (
                <Button
                  variant="secondary"
                  loading={busy}
                  onClick={() => save({ unlocked: true })}
                  aria-label={t('unlockNamed', { name: row.name })}
                >
                  {t('unlock')}
                </Button>
              )}
              <Button variant="quiet" onClick={() => setEditing(true)} disabled={busy}>
                {unlocked ? t('dates') : t('unlockWithDates')}
              </Button>
              {unlocked && (
                <Button
                  variant="quiet"
                  loading={busy}
                  onClick={() => save({ unlocked: false })}
                  aria-label={t('lockNamed', { name: row.name })}
                >
                  {t('lock')}
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      {error && <Alert severity="error">{error}</Alert>}

      {editing && (
        <form
          className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            void save({ unlocked: true, availableFrom: from, availableUntil: until });
          }}
        >
          <FormField label={t('from')} name={ids.from} hint={t('fromHint')}>
            <FormInput
              name={ids.from}
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </FormField>
          <FormField label={t('until')} name={ids.until} hint={t('untilHint')}>
            <FormInput
              name={ids.until}
              type="date"
              value={until}
              onChange={(e) => setUntil(e.target.value)}
            />
          </FormField>
          <div className="flex gap-2">
            <Button type="submit" loading={busy}>
              {unlocked ? t('saveDates') : t('unlock')}
            </Button>
            <Button variant="quiet" onClick={() => setEditing(false)} disabled={busy}>
              {t('cancel')}
            </Button>
          </div>
        </form>
      )}
    </li>
  );
}
