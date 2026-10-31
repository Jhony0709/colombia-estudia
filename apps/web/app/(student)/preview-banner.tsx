'use client';

/** La franja de la vista de estudiante (31/10): avisa que es una prueba, reinicia o sale. */

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Eye, RotateCcw } from 'lucide-react';
import { Button } from '@/components/atoms/button';
import { Dialog, DialogClose } from '@/components/organisms/dialog';
import { useToast } from '@/components/organisms/toaster';
import { apiErrorText } from '@/lib/http/api-error-text';

export function PreviewBanner({
  cohortId,
  cohortCode,
  programName,
}: {
  cohortId: string;
  cohortCode: string;
  programName: string;
}) {
  const t = useTranslations('learn.studentPreview');
  const router = useRouter();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const reset = async () => {
    setBusy(true);
    try {
      const res = await fetch(`/api/cohorts/${cohortId}/preview/reset`, { method: 'POST' });
      const payload = (await res.json().catch(() => null)) as {
        data?: { enrollmentId: string };
      } | null;
      if (!res.ok || !payload?.data) {
        toast({ severity: 'error', title: apiErrorText(payload, t('resetError')), key: 'preview' });
        return;
      }
      setConfirming(false);
      toast({ severity: 'success', title: t('resetDone'), key: 'preview' });
      router.push(`/aprender/curso/${payload.data.enrollmentId}`);
      router.refresh();
    } catch {
      toast({ severity: 'error', title: t('resetError'), key: 'preview' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      role="region"
      aria-label={t('label')}
      className="bg-status-info-muted text-text type-caption flex flex-wrap items-center justify-center gap-x-4 gap-y-2 px-4 py-2"
    >
      <span className="inline-flex items-center gap-2">
        <Eye aria-hidden className="size-4 shrink-0" />
        {t('title', { program: programName, cohort: cohortCode })}
      </span>
      <span className="inline-flex items-center gap-2">
        <Button type="button" variant="secondary" onClick={() => setConfirming(true)}>
          <RotateCcw aria-hidden className="size-4 shrink-0" />
          {t('reset')}
        </Button>
        <Button asChild variant="quiet">
          <Link href={`/cohortes/${cohortId}`}>{t('exit')}</Link>
        </Button>
      </span>
      <Dialog
        open={confirming}
        onOpenChange={setConfirming}
        locked={busy}
        size="sm"
        title={t('resetTitle')}
        description={t('resetConfirm')}
        actions={
          <>
            <DialogClose>
              <Button type="button" variant="secondary" disabled={busy}>
                {t('cancel')}
              </Button>
            </DialogClose>
            <Button type="button" loading={busy} onClick={() => void reset()}>
              {t('resetConfirmButton')}
            </Button>
          </>
        }
      />
    </div>
  );
}
