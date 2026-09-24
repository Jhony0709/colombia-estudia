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

  const dueDay = (iso: string) =>
    format.dateTime(new Date(iso), {
      day: 'numeric',
      month: 'short',
      hour: 'numeric',
      minute: '2-digit',
    });

  return (
    <Page>
      <PageHeader title={tr('title')} description={tr('description')} />

      {/*
        Mis exámenes (E3, 23/9): una tarjeta por examen que dice, en una frase, qué pasa con
        él —bloqueado y por qué, pendiente y hasta cuándo, en curso, entregado y qué nota se
        conserva—. Antes era una tabla de cuatro columnas con «Bloqueado» sin motivo y «—»
        en casi todas las celdas para quien empieza.
      */}
      <PageSection title={tr('examsTitle')} description={tr('examsHint')}>
        {results.assessments.length === 0 ? (
          <EmptyState title={tr('noExams')} description={tr('noExamsHint')} />
        ) : (
          <ul className="grid gap-3 md:grid-cols-2">
            {results.assessments.map((e) => (
              <li key={e.assignmentId}>
                <ExamCard exam={e} when={dueDay} />
              </li>
            ))}
          </ul>
        )}
      </PageSection>

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
                    href={`/aprender/examen/${a.assignmentId}/intento/${a.id}`}
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

/**
 * Un examen en una tarjeta: título, dónde, y **una frase** con su situación y el porqué. La
 * composición de la nota se dice tal cual («se conserva tu mejor intento»), sin texto
 * pedagógico inventado. La acción, si la hay, es una: ver el examen o seguir el intento.
 */
async function ExamCard({
  exam,
  when,
}: {
  exam: Awaited<ReturnType<typeof getResultsForStudent>>['assessments'][number];
  when: (iso: string) => string;
}) {
  const tr = await getTranslations('learn.results');

  let tone: 'neutral' | 'info' | 'success' | 'warning' = 'neutral';
  let line: string;
  let action: { href: string; label: string } | null = null;

  if (!exam.enabled) {
    line = exam.blockedBy
      ? tr('card.blockedBy', { title: exam.blockedBy })
      : exam.unavailableReason === 'CLOSED'
        ? tr('card.closed')
        : tr('card.notYet');
  } else if (exam.status === 'IN_PROGRESS') {
    tone = 'info';
    line = tr('card.inProgress');
    action = { href: `/aprender/examen/${exam.assignmentId}`, label: tr('card.continue') };
  } else if (exam.status === 'COMPLETED') {
    if (exam.best) {
      tone = exam.best.passed ? 'success' : 'warning';
      line = tr('card.best', {
        percent: exam.best.percent,
        passed: exam.best.passed ? 'yes' : 'no',
        count: exam.visibleAttempts,
      });
    } else {
      line = tr('card.hidden');
    }
    action = { href: `/aprender/examen/${exam.assignmentId}`, label: tr('card.view') };
  } else {
    line = exam.dueAt ? tr('card.pendingDue', { date: when(exam.dueAt) }) : tr('card.pending');
    action = { href: `/aprender/examen/${exam.assignmentId}`, label: tr('card.view') };
  }

  const TONE = {
    neutral: 'border-border-muted',
    info: 'border-status-info-base',
    success: 'border-status-success-base',
    warning: 'border-status-warning-base',
  } as const;

  return (
    <article
      className={`bg-surface-base rounded-card elevation-resting flex h-full flex-col gap-2 border border-l-4 p-4 ${TONE[tone]}`}
    >
      <h3 className={`type-body-emphasis m-0 ${exam.enabled ? 'text-text' : 'text-text-muted'}`}>
        {exam.title}
      </h3>
      <p className="type-caption text-text-muted m-0">
        {exam.programName} · {exam.moduleName}
      </p>
      <p className="type-body text-text m-0">{line}</p>
      {action && (
        <Link
          href={action.href}
          className="text-text-link type-body min-h-touch mt-auto inline-flex items-center underline underline-offset-4"
        >
          {action.label}
        </Link>
      )}
    </article>
  );
}
