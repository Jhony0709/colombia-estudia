/** La encuesta al terminar un componente (11/10). */

import type { Metadata, Route } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getFormatter, getTranslations } from 'next-intl/server';
import { ArrowRight, CircleCheck } from 'lucide-react';
import { getRequestContext } from '@/lib/authz/request-context';
import { getModuleFeedbackContext } from '@/features/feedback/server/feedback.service';
import { listMyPendingRequests } from '@/features/requests/server/requests.service';
import { Page, PageHeader } from '@/components/templates/page';
import { Breadcrumb } from '@/components/molecules/breadcrumb';
import { Button } from '@/components/atoms/button';
import { ModuleFeedbackFlow } from './module-feedback-flow';

export const metadata: Metadata = { title: 'Cuéntanos cómo te fue' };

export default async function ModuleFeedbackPage({
  params,
}: {
  params: Promise<{ enrollmentId: string; moduleId: string }>;
}) {
  const { enrollmentId, moduleId } = await params;
  const ctx = await getRequestContext();
  if (!ctx.person) notFound();

  const [context, pending, t, tc, format] = await Promise.all([
    getModuleFeedbackContext({
      institutionId: ctx.institution.id,
      personId: ctx.person.id,
      enrollmentId,
      moduleId,
    }),
    listMyPendingRequests({ institutionId: ctx.institution.id, personId: ctx.person.id }),
    getTranslations('moduleFeedback'),
    getTranslations('crumbs'),
    getFormatter(),
  ]);
  if (!context) notFound();

  const backHref = `/aprender/curso/${context.enrollmentId}`;
  // Solo se pregunta por lo terminado; si no, de vuelta a la ruta.
  if (!context.eligible && !context.answeredAt) redirect(backHref as Route);

  const nextLocked = context.nextLocked
    ? {
        ...context.nextLocked,
        requestedAt: pending.unlock[`${context.enrollmentId}:${context.nextLocked.id}`] ?? null,
      }
    : null;

  return (
    <Page enter>
      <PageHeader
        back={
          <Breadcrumb
            label={tc('label')}
            items={[
              { label: tc('home'), href: '/aprender' },
              { label: context.programName, href: backHref },
              { label: t('crumb') },
            ]}
          />
        }
        overline={t('overline')}
        title={t('title', { module: context.module.name })}
        description={context.answeredAt ? undefined : t('description')}
        action={
          context.answeredAt ? undefined : (
            <Button asChild variant="quiet">
              <Link href={backHref as Route}>{t('later')}</Link>
            </Button>
          )
        }
      />
      <div className="bg-surface-base rounded-card elevation-resting max-w-reading p-5 sm:p-8">
        {context.answeredAt ? (
          <section aria-labelledby="encuesta-respondida" className="space-y-4">
            <span className="bg-status-success-muted text-status-success-base inline-flex size-12 items-center justify-center rounded-full">
              <CircleCheck aria-hidden className="size-6" />
            </span>
            <div className="space-y-2">
              <h2 id="encuesta-respondida" className="type-heading text-text m-0">
                {t('answered.title')}
              </h2>
              <p className="type-body text-text-muted m-0">
                {t('answered.body', {
                  date: format.dateTime(new Date(context.answeredAt), { dateStyle: 'long' }),
                })}
              </p>
            </div>
            <Button asChild variant="secondary">
              <Link href={backHref as Route}>
                {t('done.back')}
                <ArrowRight aria-hidden className="size-4 shrink-0" />
              </Link>
            </Button>
          </section>
        ) : (
          <ModuleFeedbackFlow
            enrollmentId={context.enrollmentId}
            moduleId={context.module.id}
            firstName={ctx.person.givenName}
            backHref={backHref}
            nextLocked={nextLocked}
          />
        )}
      </div>
    </Page>
  );
}
