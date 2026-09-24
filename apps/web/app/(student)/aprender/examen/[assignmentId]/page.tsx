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
import { RouteRail, WithRouteRail } from '../../route-rail';
import {
  CalendarClock,
  CircleCheck,
  Clock,
  Eye,
  ListChecks,
  Target,
  type LucideIcon,
} from 'lucide-react';

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
  if (!ctx.person) return { title: 'Examen' };
  const view = await load(ctx.institution.id, ctx.person.id, assignmentId);
  return { title: view.assessment ? view.assessment.title : 'Examen' };
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

  const kindLabel = ta(`kind.${a.kind}`);
  const overline =
    a.kind === 'SUBJECT' && a.subjectName
      ? `${a.moduleName} · ${ta('countsFor', { subject: a.subjectName })}`
      : `${a.moduleName} · ${kindLabel}`;

  return (
    <Page wide>
      <PageHeader overline={overline} title={a.title} description={a.instructions ?? undefined} />

      <WithRouteRail
        rail={
          <RouteRail
            modules={view.route}
            currentId={a.assignmentId}
            enrollmentId={a.enrollmentId}
          />
        }
      >
        {/*
        La pantalla previa como la de Coursera (21/9): la acción arriba y, al lado, «Qué
        esperar» con los datos que deciden si empiezo ahora o después. Las reglas del intento
        van debajo, en texto: son lo que se lee una vez.
      */}
        <PageSection title={ta('beforeTitle')} card>
          <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_18rem]">
            <div className="space-y-4">
              <p className="type-body">
                {view.active
                  ? ta('inProgressBody')
                  : a.passPercent !== null
                    ? ta('mustPass', { percent: a.passPercent })
                    : ta('mustTake')}
              </p>
              {view.cannotStart === null || view.cannotStart === 'IN_PROGRESS' ? (
                <StartAttempt assignmentId={a.assignmentId} continuing={view.active !== null} />
              ) : (
                <Alert severity="warning">{ta(`cannotStart.${view.cannotStart}`)}</Alert>
              )}
              <ul className="type-body text-text-muted list-disc space-y-1 pl-5">
                {a.timeLimitMinutes !== null && <li>{ta('noPause')}</li>}
                <li>{ta('autosave')}</li>
                <li>{ta('oneOpen')}</li>
              </ul>
            </div>

            <div className="border-border rounded-control border p-4">
              <p className="type-body-emphasis m-0 mb-3">{ta('whatToExpect')}</p>
              <dl className="space-y-3">
                {a.dueAt && <Fact icon={CalendarClock} label={ta('dueAt')} value={when(a.dueAt)} />}
                {/*
                  E3 (23/9): con un intento abierto, «te quedan 0 de 1» era verdad contable y
                  mentira humana —todavía tiene su oportunidad—. Se dice que hay uno en curso
                  y qué pasa al entregarlo; sin intento abierto, lo de siempre.
                */}
                <Fact
                  icon={Target}
                  label={ta('attempts')}
                  value={
                    view.active
                      ? ta('attemptsInProgress', { left: attemptsLeft, allowed: a.attemptsAllowed })
                      : ta('attemptsValue', { left: attemptsLeft, allowed: a.attemptsAllowed })
                  }
                />
                <Fact
                  icon={Clock}
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
                  icon={ListChecks}
                  label={ta('questions')}
                  value={ta('questionsValue', { count: a.questionCount, points: a.totalPoints })}
                />
                {a.passPercent !== null && (
                  <Fact
                    icon={CircleCheck}
                    label={ta('pass')}
                    value={ta('passValue', { percent: a.passPercent })}
                  />
                )}
                <Fact
                  icon={Eye}
                  label={ta('review')}
                  value={ta(`reviewPolicy.${a.reviewPolicy}`)}
                />
              </dl>
            </div>
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
                      href={`/aprender/examen/${a.assignmentId}/intento/${attempt.id}`}
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

        <BackLink label={t('lesson.backToOutline')} enrollmentId={a.enrollmentId} />
      </WithRouteRail>
    </Page>
  );
}

function Fact({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2">
      <Icon aria-hidden className="text-text-muted mt-0.5 size-4 shrink-0" />
      <div>
        <dt className="type-caption text-text-muted">{label}</dt>
        <dd className="type-body m-0">{value}</dd>
      </div>
    </div>
  );
}

/** Con matrícula, a la ruta de ESE programa (21/9); sin ella (bloqueado), al panel. */
function BackLink({ label, enrollmentId }: { label: string; enrollmentId?: string }) {
  return (
    <p className="type-body">
      <Link
        href={enrollmentId ? `/aprender?matricula=${enrollmentId}#ruta` : '/aprender'}
        className="text-text-link min-h-touch inline-flex items-center underline"
      >
        {label}
      </Link>
    </p>
  );
}
