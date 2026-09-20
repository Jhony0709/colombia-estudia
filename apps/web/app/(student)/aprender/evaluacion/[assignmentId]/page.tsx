/**
 * Pantalla previa de una evaluación.
 * SSOT: reference/01-routing/routes.md:33, plan/08-aprender-y-evaluar.md:56-59.
 *
 * Lo que hay que saber **antes** de empezar: cuántos intentos quedan, cuánto tiempo (ya con
 * el ajuste aplicado), que no se puede pausar, y qué se verá al terminar. Y los intentos
 * anteriores con lo que la política deja ver de cada uno.
 */

import { cache } from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTranslations, getFormatter } from 'next-intl/server';
import { getRequestContext } from '@/lib/authz/request-context';
import { getAssessmentForStudent } from '@/features/learn/server/attempt.service';
import { Page, PageHeader, PageSection } from '@/components/templates/page';
import { EmptyState } from '@/components/molecules/empty-state';
import { Alert } from '@/components/atoms/alert';
import { Badge } from '@/components/atoms/badge';
import { StartAttempt } from './start-attempt';

const load = cache(async (institutionId: string, personId: string, assignmentId: string) =>
  getAssessmentForStudent({ institutionId, personId, assignmentId })
);

export async function generateMetadata({
  params,
}: {
  params: Promise<{ assignmentId: string }>;
}): Promise<Metadata> {
  const { assignmentId } = await params;
  const ctx = await getRequestContext();
  if (!ctx.person) return { title: 'Evaluación' };
  const view = await load(ctx.institution.id, ctx.person.id, assignmentId);
  return { title: view.assessment ? view.assessment.title : 'Evaluación' };
}

export default async function AssessmentPage({
  params,
}: {
  params: Promise<{ assignmentId: string }>;
}) {
  const { assignmentId } = await params;
  const ctx = await getRequestContext();
  const t = await getTranslations('learn');
  const ta = await getTranslations('learn.assessment');
  const format = await getFormatter();

  if (!ctx.person) {
    return (
      <Page>
        <PageHeader title={t('title')} />
        <EmptyState title={t('noSession')} description={t('noSessionHint')} />
      </Page>
    );
  }

  const view = await load(ctx.institution.id, ctx.person.id, assignmentId);

  if (view.gate) {
    if (view.gate.kind === 'NOT_ASSIGNED') notFound();
    return (
      <Page>
        <PageHeader title={t('title')} />
        <EmptyState
          title={
            view.gate.kind === 'COHORT'
              ? t(`gate.${view.gate.cohort.kind}.title`)
              : t(`lesson.gate.${view.gate.kind}.title`)
          }
          description={
            view.gate.kind === 'COHORT'
              ? t(`gate.${view.gate.cohort.kind}.body`, {
                  date:
                    'startsOn' in view.gate.cohort
                      ? view.gate.cohort.startsOn
                      : 'accessUntil' in view.gate.cohort
                        ? view.gate.cohort.accessUntil
                        : '',
                })
              : view.gate.kind === 'BLOCKED'
                ? t('blockedBy', { title: view.gate.blockedBy })
                : t(`lesson.gate.${view.gate.kind}.body`)
          }
          supportEmail={ctx.institution.supportEmail}
        />
        <BackLink label={t('lesson.backToOutline')} />
      </Page>
    );
  }

  const a = view.assessment;
  if (!a) notFound();

  const when = (iso: string) =>
    format.dateTime(new Date(iso), {
      day: 'numeric',
      month: 'long',
      hour: 'numeric',
      minute: '2-digit',
    });
  const attemptsLeft = Math.max(0, a.attemptsAllowed - a.attemptsUsed);

  return (
    <Page>
      <PageHeader
        overline={a.moduleName}
        title={a.title}
        description={a.instructions ?? undefined}
      />

      <PageSection title={ta('beforeTitle')} card>
        <dl className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
          <Fact
            label={ta('questions')}
            value={ta('questionsValue', { count: a.questionCount, points: a.totalPoints })}
          />
          <Fact
            label={ta('time')}
            value={
              a.timeLimitMinutes === null
                ? a.timerExempt
                  ? ta('timeExempt')
                  : ta('timeUnlimited')
                : ta('timeValue', { minutes: a.timeLimitMinutes })
            }
          />
          <Fact
            label={ta('attempts')}
            value={ta('attemptsValue', { left: attemptsLeft, allowed: a.attemptsAllowed })}
          />
          {a.dueAt && <Fact label={ta('dueAt')} value={when(a.dueAt)} />}
          {a.passPercent !== null && (
            <Fact label={ta('pass')} value={ta('passValue', { percent: a.passPercent })} />
          )}
          <Fact label={ta('review')} value={ta(`reviewPolicy.${a.reviewPolicy}`)} />
        </dl>

        <ul className="type-body mt-4 list-disc space-y-1 pl-5">
          {a.timeLimitMinutes !== null && <li>{ta('noPause')}</li>}
          <li>{ta('autosave')}</li>
          <li>{ta('oneOpen')}</li>
        </ul>

        <div className="mt-6">
          {view.cannotStart === null || view.cannotStart === 'IN_PROGRESS' ? (
            <StartAttempt assignmentId={a.assignmentId} continuing={view.active !== null} />
          ) : (
            <Alert severity="warning">{ta(`cannotStart.${view.cannotStart}`)}</Alert>
          )}
        </div>
      </PageSection>

      {view.attempts.length > 0 && (
        <PageSection title={ta('historyTitle')}>
          <ol className="divide-border-muted divide-y">
            {view.attempts.map((attempt) => (
              <li
                key={attempt.id}
                className="flex flex-wrap items-center justify-between gap-3 py-3"
              >
                <div>
                  <p className="type-body-emphasis m-0">
                    {ta('attemptNumber', { number: attempt.number })}
                  </p>
                  <p className="type-caption text-text-muted m-0">
                    {attempt.submittedAt
                      ? ta('submittedOn', { date: when(attempt.submittedAt) })
                      : ta('startedOn', { date: when(attempt.startedAt) })}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {attempt.score ? (
                    <Badge variant={attempt.score.passed ? 'success' : 'warning'}>
                      {ta('scoreValue', {
                        value: attempt.score.value,
                        max: attempt.score.max,
                        percent: attempt.score.percent,
                      })}
                    </Badge>
                  ) : (
                    <Badge variant={attempt.status === 'IN_PROGRESS' ? 'info' : 'neutral'}>
                      {ta(`status.${attempt.status}`)}
                    </Badge>
                  )}
                  <Link
                    href={`/aprender/evaluacion/${a.assignmentId}/intento/${attempt.id}`}
                    className="text-text-link min-h-touch inline-flex items-center underline"
                  >
                    {attempt.status === 'IN_PROGRESS' ? ta('continue') : ta('view')}
                  </Link>
                </div>
              </li>
            ))}
          </ol>
        </PageSection>
      )}

      <BackLink label={t('lesson.backToOutline')} />
    </Page>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="type-caption text-text-muted">{label}</dt>
      <dd className="type-body m-0">{value}</dd>
    </div>
  );
}

function BackLink({ label }: { label: string }) {
  return (
    <p className="type-body">
      <Link
        href="/aprender"
        className="text-text-link min-h-touch inline-flex items-center underline"
      >
        {label}
      </Link>
    </p>
  );
}
