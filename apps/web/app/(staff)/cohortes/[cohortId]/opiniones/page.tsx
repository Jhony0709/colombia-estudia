/** Las opiniones de los estudiantes de una cohorte, por componente (11/10). */

import type { Metadata, Route } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getFormatter, getTranslations } from 'next-intl/server';
import { getRequestContext } from '@/lib/authz/request-context';
import { HOME_AFTER_LOGIN } from '@/lib/authz/routes';
import {
  FEEDBACK_SCORES,
  LOW_SCORE,
  getCohortFeedback,
  type FeedbackEntry,
  type ModuleFeedbackSummary,
} from '@/features/feedback/server/feedback.service';
import { Page, PageHeader, PageSection } from '@/components/templates/page';
import { Breadcrumb } from '@/components/molecules/breadcrumb';
import { EmptyState } from '@/components/molecules/empty-state';
import { Badge } from '@/components/atoms/badge';
import { cn } from '@/lib/utils';
import { CohortSections } from '../cohort-sections';

export const metadata: Metadata = { title: 'Opiniones' };

export default async function CohortFeedbackPage({
  params,
}: {
  params: Promise<{ cohortId: string }>;
}) {
  const ctx = await getRequestContext();
  if ((ctx.capabilities.get('progress.read.cohort')?.length ?? 0) === 0) redirect(HOME_AFTER_LOGIN);
  const { cohortId } = await params;

  const [feedback, t, tb] = await Promise.all([
    getCohortFeedback({ institutionId: ctx.institution.id, cohortId }),
    getTranslations('feedbackReport'),
    getTranslations('crumbs'),
  ]);
  if (!feedback) notFound();
  const { cohort } = feedback;

  return (
    <Page wide>
      <PageHeader
        overline={`${cohort.code} · ${cohort.programName}`}
        title={t('title')}
        description={t('description')}
        back={
          <Breadcrumb
            label={tb('label')}
            items={[
              { label: tb('home'), href: '/ingresar' },
              { label: tb('cohorts'), href: '/cohortes' },
              { label: cohort.code, href: `/cohortes/${cohort.id}` },
              { label: t('crumb') },
            ]}
          />
        }
      />
      <CohortSections
        institutionId={ctx.institution.id}
        cohortId={cohort.id}
        capabilities={ctx.capabilities}
      />
      {feedback.responses === 0 ? (
        <EmptyState title={t('emptyTitle')} description={t('emptyHint')} />
      ) : (
        feedback.modules.map((module) => (
          <ModuleSection key={module.id} cohortId={cohort.id} module={module} />
        ))
      )}
    </Page>
  );
}

async function ModuleSection({
  cohortId,
  module,
}: {
  cohortId: string;
  module: ModuleFeedbackSummary;
}) {
  const t = await getTranslations('feedbackReport');
  const summary = [
    t('responses', { count: module.responses }),
    module.low > 0 ? t('lowCount', { count: module.low }) : null,
  ]
    .filter(Boolean)
    .join(' · ');
  return (
    <PageSection
      title={`${module.position}. ${module.name}`}
      description={summary}
      id={`componente-${module.position}`}
      card
    >
      {module.responses > 0 && (
        <div className="space-y-6">
          <dl className="m-0 grid grid-cols-2 gap-4 lg:grid-cols-4">
            {FEEDBACK_SCORES.map((key) => (
              <div key={key} className="space-y-1">
                <dt className="type-caption text-text-muted">{t(`scores.${key}`)}</dt>
                <dd className="m-0 space-y-1">
                  <span className="type-heading text-text block tabular-nums">
                    {module.averages[key] === null
                      ? t('noData')
                      : t('average', {
                          value: new Intl.NumberFormat('es-CO').format(module.averages[key]),
                        })}
                  </span>
                  <Meter value={module.averages[key]} />
                </dd>
              </div>
            ))}
          </dl>
          <div className="space-y-3">
            <h3 className="type-subheading text-text m-0">{t('entriesTitle')}</h3>
            {module.entries.length === 0 ? (
              <p className="type-body text-text-muted m-0">{t('noEntries')}</p>
            ) : (
              <ul className="m-0 list-none space-y-3 p-0">
                {module.entries.map((entry) => (
                  <Entry key={entry.id} cohortId={cohortId} entry={entry} />
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </PageSection>
  );
}

/** Cinco tramos llenos hasta el promedio redondeado: el mismo medidor que vio el estudiante. */
function Meter({ value }: { value: number | null }) {
  const filled = value === null ? 0 : Math.round(value);
  return (
    <span aria-hidden="true" className="flex gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <span
          key={n}
          className={cn(
            'rounded-pill h-1.5 flex-1',
            n <= filled
              ? filled <= LOW_SCORE
                ? 'bg-status-warning-base'
                : 'bg-accent-base'
              : 'bg-border-muted'
          )}
        />
      ))}
    </span>
  );
}

async function Entry({ cohortId, entry }: { cohortId: string; entry: FeedbackEntry }) {
  const [t, format] = await Promise.all([getTranslations('feedbackReport'), getFormatter()]);
  return (
    <li className="border-border-muted rounded-control space-y-2 border p-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <Link
          href={`/cohortes/${cohortId}/matriculas/${entry.enrollmentId}` as Route}
          aria-label={t('viewEnrollment', { name: entry.personName })}
          className="type-body-emphasis text-text-link underline-offset-4 hover:underline"
        >
          {entry.personName}
        </Link>
        <span className="type-caption text-text-muted">
          {format.dateTime(new Date(entry.createdAt), { dateStyle: 'medium' })}
        </span>
        {entry.low && <Badge variant="warning">{t('low')}</Badge>}
      </div>
      <p className="type-caption text-text-muted m-0">
        {FEEDBACK_SCORES.map((key) => {
          const value = entry.scores[key];
          return (
            <span key={key} className="mr-3 inline-block">
              {t(`scores.${key}`)}:{' '}
              <span
                className={cn(
                  'tabular-nums',
                  value !== null && value <= LOW_SCORE && 'text-status-warning-base font-semibold'
                )}
              >
                {value === null ? t('notNeeded') : value}
              </span>
            </span>
          );
        })}
      </p>
      <p className={cn('type-body m-0', entry.comment ? 'text-text' : 'text-text-muted')}>
        {entry.comment ?? t('noComment')}
      </p>
    </li>
  );
}
