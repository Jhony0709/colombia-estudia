'use client';

/**
 * Aprobar o devolver una entrega (plan/08-aprender-y-evaluar.md:72-76).
 *
 * Devolver exige un comentario: una entrega devuelta sin decir qué falta es una entrega
 * devuelta dos veces. Aprobar admite uno opcional. La decisión es del servidor
 * (`PATCH /api/cohorts/[cohortId]/submissions/[id]`); aquí solo se recoge y se refresca.
 */

import { useId, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/atoms/button';
import { Alert } from '@/components/atoms/alert';
import { Label } from '@/components/atoms/label';
import { useAnnounce } from '@/lib/a11y/announce';
import { apiErrorText } from '@/lib/http/api-error-text';
import { cn } from '@/lib/utils';

export function ReviewActions({
  cohortId,
  submissionId,
  status,
  studentName,
}: {
  cohortId: string;
  submissionId: string;
  status: 'SUBMITTED' | 'RETURNED' | 'APPROVED';
  studentName: string;
}) {
  const t = useTranslations('submissions.review');
  const router = useRouter();
  const { announce } = useAnnounce();
  const id = useId();
  const [feedback, setFeedback] = useState('');
  const [busy, setBusy] = useState<'APPROVED' | 'RETURNED' | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Solo lo que está en revisión se decide. Lo ya decidido se lee, no se vuelve a tocar:
  // el estudiante reenvía tras una devolución y eso crea una nueva revisión.
  if (status !== 'SUBMITTED') {
    return <p className="type-caption text-text-muted">{t(`closed.${status}`)}</p>;
  }

  const decide = async (decision: 'APPROVED' | 'RETURNED') => {
    setError(null);
    const trimmed = feedback.trim();
    if (decision === 'RETURNED' && !trimmed) return setError(t('feedbackRequired'));
    setBusy(decision);
    try {
      const res = await fetch(`/api/cohorts/${cohortId}/submissions/${submissionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision, feedback: trimmed || undefined }),
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok) return setError(apiErrorText(payload, t('error')));
      announce(
        t(decision === 'APPROVED' ? 'approvedAnnounce' : 'returnedAnnounce', { name: studentName })
      );
      router.replace(`/cohortes/${cohortId}/entregas?estado=SUBMITTED`);
      router.refresh();
    } catch {
      setError(t('error'));
    } finally {
      setBusy(null);
    }
  };

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void decide('APPROVED');
  };

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor={id}>{t('feedbackLabel')}</Label>
        <textarea
          id={id}
          name="feedback"
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          rows={4}
          maxLength={4_000}
          disabled={busy !== null}
          aria-describedby={`${id}-hint`}
          className={cn(
            'rounded-control border-border bg-surface-sunken text-text type-body w-full border px-3 py-2',
            'focus:border-accent-base duration-fast ease-standard transition-colors',
            busy !== null && 'text-text-subtle cursor-not-allowed'
          )}
        />
        <p id={`${id}-hint`} className="type-caption text-text-muted">
          {t('feedbackHint')}
        </p>
      </div>

      {error && <Alert severity="error">{error}</Alert>}

      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={busy !== null}>
          {busy === 'APPROVED' ? t('approving') : t('approve')}
        </Button>
        <Button
          type="button"
          variant="secondary"
          disabled={busy !== null}
          onClick={() => void decide('RETURNED')}
        >
          {busy === 'RETURNED' ? t('returning') : t('return')}
        </Button>
      </div>
    </form>
  );
}
