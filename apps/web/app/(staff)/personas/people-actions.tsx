'use client';

/**
 * Acciones de la lista de personas: menú por fila (ver ficha, reinvitar) y barra de acciones
 * en lote sobre la selección (reinvitar N). Reinvitar reutiliza POST /api/people/[id]/reinvite,
 * una llamada por persona: el endpoint audita cada envío y así sigue haciéndolo.
 */

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Send } from 'lucide-react';
import { Button } from '@/components/atoms/button';
import { Alert } from '@/components/atoms/alert';
import { Menu, MenuItem, MenuSeparator } from '@/components/molecules/menu';
import { useRowSelection } from '@/components/molecules/row-selection';
import { useAnnounce } from '@/lib/a11y/announce';
import { apiErrorText } from '@/lib/http/api-error-text';

async function reinvite(personId: string): Promise<string | null> {
  const res = await fetch(`/api/people/${personId}/reinvite`, { method: 'POST' });
  if (res.ok) return null;
  const payload = await res.json().catch(() => null);
  return apiErrorText(payload, 'Error');
}

export function PersonRowActions({
  personId,
  name,
  canReinvite,
}: {
  personId: string;
  name: string;
  canReinvite: boolean;
}) {
  const t = useTranslations('people.actions');
  const router = useRouter();
  const { announce } = useAnnounce();
  const [error, setError] = useState<string | null>(null);

  const onReinvite = async () => {
    setError(null);
    const err = await reinvite(personId);
    if (err) {
      setError(err);
      return;
    }
    announce(t('reinvited', { name }));
    router.refresh();
  };

  return (
    <>
      <Menu label={t('menuFor', { name })}>
        <MenuItem onSelect={() => router.push(`/personas/${personId}`)}>{t('view')}</MenuItem>
        {canReinvite && (
          <>
            <MenuSeparator />
            <MenuItem onSelect={onReinvite}>{t('reinvite')}</MenuItem>
          </>
        )}
      </Menu>
      {error !== null && (
        <span role="alert" className="type-caption text-status-error-base block">
          {error}
        </span>
      )}
    </>
  );
}

/** Barra que aparece con la selección: cuenta, reinvitar en lote, deseleccionar. */
export function BulkActions({ reinvitable }: { reinvitable: string[] }) {
  const t = useTranslations('people.actions');
  const router = useRouter();
  const { announce } = useAnnounce();
  const { selected, clear } = useRowSelection();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (selected.size === 0) return null;
  const targets = reinvitable.filter((id) => selected.has(id));

  const onReinviteAll = async () => {
    setBusy(true);
    setError(null);
    let sent = 0;
    let failed = 0;
    for (const id of targets) {
      const err = await reinvite(id);
      if (err) failed += 1;
      else sent += 1;
    }
    setBusy(false);
    if (failed > 0) setError(t('bulkPartial', { sent, failed }));
    announce(t('bulkDone', { sent }));
    clear();
    router.refresh();
  };

  return (
    <div
      role="region"
      aria-label={t('bulkRegion')}
      className="bg-status-info-muted rounded-card flex flex-wrap items-center gap-3 px-4 py-3"
    >
      <p className="type-body-emphasis text-text m-0">
        {t('selectedCount', { count: selected.size })}
      </p>
      <Button
        variant="primary"
        onClick={onReinviteAll}
        disabled={busy || targets.length === 0}
        loading={busy}
        title={targets.length === 0 ? t('noneReinvitable') : undefined}
      >
        <Send aria-hidden="true" className="size-4" />
        {t('reinviteSelected', { count: targets.length })}
      </Button>
      <Button variant="quiet" onClick={clear} disabled={busy}>
        {t('clearSelection')}
      </Button>
      {error !== null && <Alert severity="warning">{error}</Alert>}
    </div>
  );
}
