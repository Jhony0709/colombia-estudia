/**
 * Las evaluaciones del programa.
 * SSOT: reference/01-routing/routes.md:41, plan/07-contenido-y-migracion.md.
 *
 * Separada de los temas el 18/9: ver la cabecera de `../temas/page.tsx`.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { getRequestContext } from '@/lib/authz/request-context';
import { requireCapability } from '@/lib/authz/with-capability';
import {
  listAssessments,
  type AssessmentListItem,
} from '@/features/content/server/assessments.service';
import { DataTable } from '@/components/molecules/data-table';
import { EmptyState } from '@/components/molecules/empty-state';
import { Badge } from '@/components/atoms/badge';
import { Button } from '@/components/atoms/button';
import { Page, PageHeader, PageSection } from '@/components/templates/page';
import { PageHelp } from '@/components/organisms/page-help';
import { listCurriculum } from '@/features/admin/server/curriculum.service';
import { Breadcrumb } from '@/components/molecules/breadcrumb';
import { StatCard, StatGrid } from '@/components/molecules/stat-card';
import { CircleCheck, ClipboardList, FileQuestionMark, ListChecks } from 'lucide-react';

export const metadata: Metadata = { title: 'Exámenes' };

export default async function AssessmentsPage() {
  await requireCapability('lesson.author');
  const ctx = await getRequestContext();

  const [assessments, curriculum, t] = await Promise.all([
    listAssessments({ institutionId: ctx.institution.id }),
    listCurriculum(ctx.institution.id),
    getTranslations('content'),
  ]);
  const th = await getTranslations('help');

  const tc = await getTranslations('crumbs');

  return (
    <Page>
      <PageHeader
        back={
          <Breadcrumb
            label={tc('label')}
            items={[{ label: tc('home'), href: '/ingresar' }, { label: tc('assessments') }]}
          />
        }
        overline={curriculum.programs.length === 1 ? curriculum.programs[0]!.name : t('overline')}
        title={t('assessmentsPageTitle')}
        description={t('assessmentsSummary', { total: assessments.length })}
        action={
          <Button asChild variant="secondary">
            <Link href="/contenido/examenes/nuevo">{t('newAssessment')}</Link>
          </Button>
        }
      />

      <section aria-label={t('stats.label')}>
        <StatGrid>
          <StatCard
            label={t('stats.assessments')}
            value={assessments.length}
            icon={ClipboardList}
          />
          <StatCard
            label={t('stats.assessmentsPublished')}
            value={assessments.filter((a) => a.hasPublished).length}
            icon={CircleCheck}
            tone="success"
          />
          <StatCard
            label={t('stats.noVersion')}
            value={assessments.filter((a) => a.latestStatus === null).length}
            icon={FileQuestionMark}
            tone="warning"
          />
          <StatCard
            label={t('stats.questions')}
            value={assessments.reduce((n, a) => n + a.questionCount, 0)}
            icon={ListChecks}
          />
        </StatGrid>
      </section>

      <PageSection title={t('assessmentsTitle', { count: assessments.length })} id="examenes">
        <DataTable<AssessmentListItem>
          align="middle"
          compactRows
          caption={t('assessmentsCaption')}
          rowKey={(assessment) => assessment.id}
          rows={assessments}
          empty={
            <EmptyState
              title={t('emptyAssessmentsTitle')}
              description={t('emptyAssessmentsHint')}
            />
          }
          columns={[
            {
              key: 'title',
              header: t('colAssessmentTitle'),
              cell: (assessment) => (
                <Link
                  href={`/contenido/examenes/${assessment.id}`}
                  className="text-text-link underline underline-offset-4"
                >
                  {assessment.title}
                </Link>
              ),
            },
            { key: 'kind', header: t('colKind'), cell: (a) => t(`kind.${a.kind}`) },
            { key: 'module', header: t('colModule'), cell: (a) => a.moduleName ?? '—' },
            { key: 'lesson', header: t('colLesson'), cell: (a) => a.lessonTitle ?? '—' },
            {
              key: 'questions',
              header: t('colQuestions'),
              numeric: true,
              cell: (a) => a.questionCount,
            },
            {
              key: 'status',
              header: t('colStatus'),
              // Misma píldora que en Temas, y por la misma razón: la palabra dice el estado,
              // el color solo lo hace visible de lejos.
              cell: (a) =>
                a.latestStatus === null ? (
                  <Badge variant="neutral">{t('statusNone')}</Badge>
                ) : (
                  <Badge variant={a.hasPublished ? 'success' : 'neutral'}>
                    {t(
                      `status.${a.hasPublished && a.latestStatus === 'DRAFT' ? 'DRAFT_OVER_PUBLISHED' : a.latestStatus}`,
                      { number: a.latestNumber ?? 0 }
                    )}
                  </Badge>
                ),
            },
          ]}
        />
      </PageSection>

      <PageHelp
        screen={t('assessmentsPageTitle')}
        topics={[
          { title: th('assessments.whatTitle'), body: <p>{th('assessments.whatBody')}</p> },
          { title: th('assessments.publishTitle'), body: <p>{th('assessments.publishBody')}</p> },
        ]}
      />
    </Page>
  );
}
