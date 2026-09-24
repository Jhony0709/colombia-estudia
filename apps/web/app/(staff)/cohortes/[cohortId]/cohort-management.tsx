'use client';

/**
 * «Gestión» de la cohorte (ola 2 UX, 23/9): lo que se hace pocas veces, detrás de un menú.
 * Cerrar pide confirmación en una hoja y dice lo que significa: nadie pierde el acceso,
 * solo deja de admitir matrículas.
 */

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Download, FileUp, Lock, MoreHorizontal } from 'lucide-react';
import { Button } from '@/components/atoms/button';
import { Alert } from '@/components/atoms/alert';
import { Sheet } from '@/components/organisms/sheet';
import {
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownSeparator,
  DropdownTrigger,
} from '@/components/molecules/dropdown';
import { apiErrorText } from '@/lib/http/api-error-text';

export function CohortManagement({
  cohortId,
  code,
  status,
  canExport,
}: {
  cohortId: string;
  code: string;
  status: string;
  canExport: boolean;
}) {
  const t = useTranslations('cohorts');
  const router = useRouter();
  const [closing, setClosing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openForEnrolment = status === 'PLANNED' || status === 'OPEN';

  const close = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/cohorts/${cohortId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ op: 'close' }),
      });
      if (!res.ok) {
        setError(apiErrorText(await res.json().catch(() => null), t('error')));
        return;
      }
      setClosing(false);
      router.refresh();
    } catch {
      setError(t('error'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Dropdown>
        <DropdownTrigger>
          <Button type="button" variant="secondary" aria-label={t('management.label')}>
            <MoreHorizontal aria-hidden className="size-4" />
            <span className="hidden sm:inline">{t('management.label')}</span>
          </Button>
        </DropdownTrigger>
        <DropdownMenu aria-label={t('management.label')} align="end">
          {openForEnrolment && (
            <DropdownItem
              itemKey="import"
              startContent={<FileUp aria-hidden className="size-4" />}
              onSelect={() => router.push(`/cohortes/${cohortId}/importar`)}
            >
              {t('management.import')}
            </DropdownItem>
          )}
          {canExport && (
            <DropdownItem
              itemKey="export"
              startContent={<Download aria-hidden className="size-4" />}
              onSelect={() => window.location.assign(`/api/cohorts/${cohortId}/export`)}
            >
              {t('management.export')}
            </DropdownItem>
          )}
          {status === 'OPEN' && (
            <>
              <DropdownSeparator />
              <DropdownItem
                itemKey="close"
                color="danger"
                startContent={<Lock aria-hidden className="size-4" />}
                onSelect={() => setClosing(true)}
              >
                {t('management.close')}
              </DropdownItem>
            </>
          )}
        </DropdownMenu>
      </Dropdown>

      <Sheet
        open={closing}
        onOpenChange={setClosing}
        title={t('closeNamed', { code })}
        description={t('management.closeHint')}
      >
        <div className="space-y-4">
          {error && <Alert severity="error">{error}</Alert>}
          <div className="flex flex-wrap gap-3">
            <Button type="button" loading={busy} onClick={() => void close()}>
              {t('management.closeConfirm')}
            </Button>
            <Button type="button" variant="quiet" disabled={busy} onClick={() => setClosing(false)}>
              {t('management.cancel')}
            </Button>
          </div>
          <p className="type-caption text-text-muted">
            <Link href={`/cohortes/${cohortId}?seccion=personas`} className="underline">
              {t('management.seePeople')}
            </Link>
          </p>
        </div>
      </Sheet>
    </>
  );
}
