/**
 * Mis resultados: notas por asignatura e intentos, según lo que cada política deja ver.
 * SSOT: reference/01-routing/routes.md:34, reference/02-api/endpoints.md:45.
 *
 * Funciona con el acceso vencido: no pasa por la secuencia de la cohorte. `score.read.own`
 * sobrevive a `accessUntil` (capabilities.ts §8) y esta página solo necesita eso.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { getTranslations, getFormatter } from 'next-intl/server';
import { getRequestContext } from '@/lib/authz/request-context';
import { getResultsForStudent } from '@/features/learn/server/attempt.service';
import { Page, PageHeader, PageSection } from '@/components/templates/page';
import { EmptyState } from '@/components/molecules/empty-state';
import { DataTable } from '@/components/molecules/data-table';
import { Badge } from '@/components/atoms/badge';

export const metadata: Metadata = { title: 'Resultados' };

export default async function ResultsPage() {
  const ctx = await getRequestContext();
  const t = await getTranslations('learn');
  const tr = await getTranslations('learn.results');
  const format = await getFormatter();

  if (!ctx.person) {
    return (
      <Page>
        <PageHeader title={tr('title')} />
        <EmptyState title={t('noSession')} description={t('noSessionHint')} />
      </Page>
    );
  }

  const results = await getResultsForStudent({
    institutionId: ctx.institution.id,
    personId: ctx.person.id,
  });

  const when = (iso: string) =>
    format.dateTime(new Date(iso), {
      day: 'numeric',
      month: 'short',
      hour: 'numeric',
      minute: '2-digit',
    });

  type Attempt = (typeof results.attempts)[number];
  type Score = (typeof results.scores)[number];

  return (
    <Page>
      <PageHeader title={tr('title')} description={tr('description')} />

      <PageSection title={tr('scoresTitle')} description={tr('scoresHint')}>
        <DataTable<Score>
          caption={tr('scoresCaption')}
          rows={results.scores}
          rowKey={(s) => `${s.cohortCode}:${s.subjectName}`}
          empty={<EmptyState title={tr('noScores')} description={tr('noScoresHint')} />}
          columns={[
            { key: 'subject', header: tr('subject'), cell: (s) => s.subjectName },
            { key: 'cohort', header: tr('cohort'), cell: (s) => s.cohortCode, narrow: true },
            {
              key: 'value',
              header: tr('score'),
              numeric: true,
              cell: (s) => format.number(s.value, { maximumFractionDigits: 2 }),
            },
            { key: 'updated', header: tr('updatedAt'), cell: (s) => when(s.updatedAt) },
          ]}
        />
      </PageSection>

      <PageSection title={tr('attemptsTitle')}>
        <DataTable<Attempt>
          caption={tr('attemptsCaption')}
          rows={results.attempts}
          rowKey={(a) => a.id}
          empty={<EmptyState title={tr('noAttempts')} description={tr('noAttemptsHint')} />}
          columns={[
            {
              key: 'title',
              header: tr('assessment'),
              cell: (a) => (
                <>
                  <Link
                    href={`/aprender/evaluacion/${a.assignmentId}/intento/${a.id}`}
                    className="text-text-link underline underline-offset-4"
                  >
                    {a.title}
                  </Link>
                  <span className="type-caption text-text-muted block">
                    {a.moduleName ? `${a.moduleName} · ` : ''}
                    {a.cohortCode} · {t('assessment.attemptNumber', { number: a.number })}
                  </span>
                </>
              ),
            },
            {
              key: 'status',
              header: tr('status'),
              narrow: true,
              cell: (a) => (
                <Badge
                  variant={
                    a.status === 'GRADED'
                      ? a.score?.passed
                        ? 'success'
                        : 'neutral'
                      : a.status === 'IN_PROGRESS'
                        ? 'info'
                        : 'warning'
                  }
                >
                  {t(`assessment.status.${a.status}`)}
                </Badge>
              ),
            },
            {
              key: 'score',
              header: tr('score'),
              numeric: true,
              cell: (a) =>
                a.score
                  ? t('assessment.scoreValue', {
                      value: a.score.value,
                      max: a.score.max,
                      percent: a.score.percent,
                    })
                  : a.status === 'GRADED'
                    ? tr('scoreHidden')
                    : '—',
            },
            {
              key: 'date',
              header: tr('submittedAt'),
              cell: (a) => (a.submittedAt ? when(a.submittedAt) : '—'),
            },
          ]}
        />
      </PageSection>
    </Page>
  );
}
