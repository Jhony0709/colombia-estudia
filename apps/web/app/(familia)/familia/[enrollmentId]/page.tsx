/**
 * `/familia/[enrollmentId]` — una matrícula de un pupilo: avance por módulo, exámenes con la
 * nota que el estudiante puede ver, notas por asignatura y, si el acudiente es el
 * responsable, las cuotas (Fase C, 23/9).
 * SSOT: docs/plan-redefinicion-2009.md Fase C.2.
 *
 * `?pago=<ref>` es la vuelta del checkout de Wompi (`returnPath` en `startCheckout`).
 */

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, getFormatter } from 'next-intl/server';
import { getRequestContext } from '@/lib/authz/request-context';
import { getWardDetail } from '@/features/family/server/family.service';
import { getPolicy } from '@/features/admin/server/policies.service';
import { AccountSummary } from '@/features/billing/components/account-summary';
import { isWompiConfigured } from '@/lib/billing/wompi';
import { Page, PageHeader, PageSection } from '@/components/templates/page';
import { Breadcrumb } from '@/components/molecules/breadcrumb';
import { DataTable } from '@/components/molecules/data-table';
import { EmptyState } from '@/components/molecules/empty-state';
import { Badge } from '@/components/atoms/badge';
import { Alert } from '@/components/atoms/alert';
import { PayButton } from '@/features/billing/components/pay-button';

export const metadata: Metadata = { title: 'Mi familia' };

type Params = Promise<{ enrollmentId: string }>;

export default async function WardPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const ctx = await getRequestContext();
  const { enrollmentId } = await params;
  const sp = await searchParams;
  const returned = typeof sp.pago === 'string';

  const [detail, policy, t, te, ta, tc, format] = await Promise.all([
    getWardDetail({
      institutionId: ctx.institution.id,
      enrollmentId,
      wardScopes: ctx.capabilities.get('progress.read.ward') ?? [],
      billingScopes: ctx.capabilities.get('billing.read.own') ?? [],
    }),
    getPolicy({ institutionId: ctx.institution.id }),
    getTranslations('family'),
    getTranslations('enrollments'),
    getTranslations('learn.account'),
    getTranslations('crumbs'),
    getFormatter(),
  ]);
  if (!detail) notFound();

  const { enrollment, modules, assessments, scores, account } = detail;
  type Module = (typeof modules)[number];
  type Assessment = (typeof assessments)[number];
  type Score = (typeof scores)[number];
  const online = isWompiConfigured();

  return (
    <Page>
      <PageHeader
        overline={enrollment.cohort.programName}
        title={enrollment.student.name}
        description={`${enrollment.cohort.code} · ${enrollment.cohort.name} · ${te(`statuses.${enrollment.status}`)}`}
        back={
          <Breadcrumb
            label={tc('label')}
            items={[{ label: t('title'), href: '/familia' }, { label: enrollment.student.name }]}
          />
        }
      />

      {returned && <Alert severity="info">{ta('returned')}</Alert>}

      <PageSection
        title={t('progressTitle')}
        description={t('progressHint', {
          completed: enrollment.progress.completed,
          total: enrollment.progress.total,
        })}
        id="avance"
      >
        <DataTable<Module>
          caption={t('progressCaption')}
          rows={modules}
          rowKey={(m) => String(m.position)}
          empty={<EmptyState title={t('noLessons')} description="" />}
          columns={[
            {
              key: 'module',
              header: t('module'),
              cell: (m) => `${m.position}. ${m.name}`,
            },
            {
              key: 'done',
              header: t('lessonsDone'),
              numeric: true,
              cell: (m) => `${m.completed} / ${m.total}`,
            },
          ]}
        />
      </PageSection>

      <PageSection title={t('assessmentsTitle')} description={t('assessmentsHint')} id="examenes">
        <DataTable<Assessment>
          caption={t('assessmentsCaption')}
          rows={assessments}
          rowKey={(a) => `${a.moduleName}-${a.title}`}
          empty={<EmptyState title={t('noAssessments')} description="" />}
          columns={[
            { key: 'title', header: t('assessment'), cell: (a) => a.title },
            { key: 'module', header: t('module'), cell: (a) => a.moduleName },
            {
              key: 'best',
              header: t('best'),
              numeric: true,
              cell: (a) =>
                a.best ? (
                  <Badge variant={a.best.passed ? 'success' : 'warning'}>
                    {t('bestValue', { percent: a.best.percent })}
                  </Badge>
                ) : (
                  <span className="text-text-muted">{t('noScoreYet')}</span>
                ),
            },
          ]}
        />
      </PageSection>

      {scores.length > 0 && (
        <PageSection title={t('scoresTitle')} id="notas">
          <DataTable<Score>
            caption={t('scoresCaption')}
            rows={scores}
            rowKey={(s) => s.subjectName}
            empty={<EmptyState title={t('noScores')} description="" />}
            columns={[
              { key: 'subject', header: t('subject'), cell: (s) => s.subjectName },
              {
                key: 'value',
                header: t('score'),
                numeric: true,
                cell: (s) => format.number(s.value, { maximumFractionDigits: 1 }),
              },
            ]}
          />
        </PageSection>
      )}

      {account && account.plan && (
        <PageSection title={t('accountTitle')} description={t('accountHint')} id="cuenta" card>
          <div className="space-y-3">
            {/* E4 (23/9): la misma frase que ve el estudiante; el pupilo es menor y aquí no hay consecuencia. */}
            <AccountSummary
              account={account}
              requireAgreementForNextCohort={policy.requireAgreementForNextCohort}
            />
            {account.summary.next && (
              <div className="flex flex-wrap items-start gap-4">
                {online ? (
                  <PayButton
                    installmentId={account.summary.next.id}
                    returnPath={`/familia/${enrollmentId}`}
                  />
                ) : null}
                <details className="type-body">
                  <summary className="text-text-link min-h-touch inline-flex cursor-pointer items-center underline">
                    {ta('transferData')}
                  </summary>
                  <p className="type-caption text-text-muted max-w-reading mt-2">
                    {ta('transferHint', { email: ctx.institution.supportEmail ?? '' })}
                  </p>
                </details>
              </div>
            )}
          </div>
        </PageSection>
      )}
    </Page>
  );
}
