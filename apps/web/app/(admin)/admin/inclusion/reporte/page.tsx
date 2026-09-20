/**
 * `/admin/inclusion/reporte`: la tabla del Decreto 1421, por cohorte.
 * SSOT: routes.md:73, plan/08 §8, reportes.md:18.
 *
 * Solo conteos. Quién tiene ajustes se ve en cada matrícula, con `accommodation.manage`; el
 * reporte cuenta, no señala.
 */

import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { getRequestContext } from '@/lib/authz/request-context';
import { requireCapability } from '@/lib/authz/with-capability';
import { getInclusionReport } from '@/features/inclusion/server/accommodations.service';
import { Page, PageHeader, PageSection } from '@/components/templates/page';
import { Breadcrumb } from '@/components/molecules/breadcrumb';
import { DataTable } from '@/components/molecules/data-table';
import { EmptyState } from '@/components/molecules/empty-state';
import { FormField, FormInput } from '@/components/atoms/form-field';
import { Button } from '@/components/atoms/button';

export const metadata: Metadata = { title: 'Reporte de inclusión' };

const isDay = (s: string | undefined) => (s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null);

export default async function InclusionReportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireCapability('accommodation.manage');
  const ctx = await getRequestContext();
  const sp = await searchParams;
  const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const hasta = isDay(first(sp.hasta));
  const desde = isDay(first(sp.desde));
  const to = hasta ? new Date(`${hasta}T23:59:59.999Z`) : new Date();
  const from = desde
    ? new Date(`${desde}T00:00:00.000Z`)
    : new Date(to.getTime() - 90 * 24 * 3600 * 1000);

  const [report, t, tb] = await Promise.all([
    getInclusionReport({ institutionId: ctx.institution.id, from, to }),
    getTranslations('inclusionReport'),
    getTranslations('crumbs'),
  ]);
  type Row = (typeof report.rows)[number];

  return (
    <Page wide>
      <PageHeader
        overline={t('overline')}
        title={t('title')}
        description={t('description')}
        back={
          <Breadcrumb
            label={tb('label')}
            items={[{ label: tb('home'), href: '/ingresar' }, { label: t('crumb') }]}
          />
        }
      />

      <form
        method="get"
        className="bg-surface-base border-border-muted rounded-card elevation-resting border p-5"
      >
        <div className="flex flex-wrap items-end gap-3">
          <FormField label={t('from')} name="desde">
            <FormInput name="desde" type="date" defaultValue={report.period.from} />
          </FormField>
          <FormField label={t('to')} name="hasta">
            <FormInput name="hasta" type="date" defaultValue={report.period.to} />
          </FormField>
          <Button type="submit" variant="secondary">
            {t('apply')}
          </Button>
        </div>
      </form>

      <p className="type-body">
        {t('summary', {
          total: report.totals.withAccommodation,
          changes: report.totals.changesInPeriod,
          from: report.period.from,
          to: report.period.to,
        })}
      </p>

      <PageSection title={t('byCohort')}>
        <DataTable<Row>
          caption={t('tableCaption')}
          rows={report.rows}
          rowKey={(r) => r.cohortId}
          empty={<EmptyState title={t('empty')} description={t('emptyHint')} />}
          columns={[
            {
              key: 'cohort',
              header: t('cohort'),
              cell: (r) => (
                <>
                  {r.cohortCode}
                  <span className="type-caption text-text-muted block">{r.cohortName}</span>
                </>
              ),
            },
            { key: 'active', header: t('active'), numeric: true, cell: (r) => r.activeEnrollments },
            { key: 'with', header: t('with'), numeric: true, cell: (r) => r.withAccommodation },
            { key: 'time', header: t('extraTime'), numeric: true, cell: (r) => r.extraTime },
            { key: 'exempt', header: t('exempt'), numeric: true, cell: (r) => r.exemptFromTimer },
            { key: 'attempts', header: t('attempts'), numeric: true, cell: (r) => r.extraAttempts },
            {
              key: 'captions',
              header: t('captions'),
              numeric: true,
              cell: (r) => r.requiresCaptions,
            },
            { key: 'changes', header: t('changes'), numeric: true, cell: (r) => r.changesInPeriod },
          ]}
        />
      </PageSection>

      {report.byAuthorizer.length > 0 && (
        <PageSection title={t('byAuthorizer')} description={t('byAuthorizerHint')}>
          <ul className="type-body list-disc pl-5">
            {report.byAuthorizer.map((a) => (
              <li key={a.name}>
                {a.name}: {a.count}
              </li>
            ))}
          </ul>
        </PageSection>
      )}
    </Page>
  );
}
