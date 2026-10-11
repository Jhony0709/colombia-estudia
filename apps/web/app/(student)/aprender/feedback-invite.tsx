/** Invitación a la encuesta del último componente terminado (11/10). */

import type { Route } from 'next';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { ArrowRight, MessageSquareText } from 'lucide-react';
import { Button } from '@/components/atoms/button';

export async function FeedbackInvite({
  enrollmentId,
  moduleId,
  moduleName,
}: {
  enrollmentId: string;
  moduleId: string;
  moduleName: string;
}) {
  const t = await getTranslations('moduleFeedback.invite');
  return (
    <section
      aria-labelledby="encuesta-invitacion"
      className="bg-surface-base border-border-muted rounded-card elevation-resting flex flex-col items-start gap-4 border p-5 sm:flex-row sm:items-center"
    >
      <span className="bg-status-info-muted text-status-info-base inline-flex size-11 shrink-0 items-center justify-center rounded-full">
        <MessageSquareText aria-hidden className="size-5" />
      </span>
      <div className="min-w-0 flex-1 space-y-1">
        <h2 id="encuesta-invitacion" className="type-subheading text-text m-0">
          {t('title', { module: moduleName })}
        </h2>
        <p className="type-body text-text-muted m-0">{t('body')}</p>
      </div>
      <Button asChild variant="secondary">
        <Link href={`/aprender/curso/${enrollmentId}/encuesta/${moduleId}` as Route}>
          {t('cta')}
          <ArrowRight aria-hidden className="size-4 shrink-0" />
        </Link>
      </Button>
    </section>
  );
}
