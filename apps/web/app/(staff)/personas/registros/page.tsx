/**
 * Registros (1/11): el embudo del registro público y la lista de quién se registró en el
 * periodo, con su avance en la Introducción. Mismo permiso que `/personas`.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { getFormatter, getTranslations } from 'next-intl/server';
import { getRequestContext } from '@/lib/authz/request-context';
import { requireCapability } from '@/lib/authz/with-capability';
import {
  getRegistrationFunnel,
  parseRegistrationPeriod,
  REGISTRATION_PERIODS,
  type RegistrationRow,
} from '@/features/people/server/registrations.service';
import { Badge } from '@/components/atoms/badge';
import { ProgressBar } from '@/components/atoms/progress-bar';
import { Breadcrumb } from '@/components/molecules/breadcrumb';
import { DataTable } from '@/components/molecules/data-table';
import { EmptyState } from '@/components/molecules/empty-state';
import { Page, PageHeader, PageSection } from '@/components/templates/page';
import { ProgressSummary } from '../progress-summary';

export const metadata: Metadata = { title: 'Registros' };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function RegistrationsPage({ searchParams }: { searchParams: SearchParams }) {
  await requireCapability('people.manage');
  const ctx = await getRequestContext();
  const period = parseRegistrationPeriod((await searchParams).dias);

  const [funnel, t, tc, format] = await Promise.all([
    getRegistrationFunnel({ institutionId: ctx.institution.id, period }),
    getTranslations('registrations'),
    getTranslations('crumbs'),
    getFormatter(),
  ]);
  const base = funnel.steps[0]?.people ?? 0;

  return (
    <Page wide>
      <PageHeader
        back={
          <Breadcrumb
            items={[
              { label: tc('home'), href: '/ingresar' },
              { label: tc('people'), href: '/personas' },
              { label: tc('registrations') },
            ]}
          />
        }
        overline={t('overline')}
        title={t('title')}
        description={t('description')}
      />

      <nav aria-label={t('period')} className="type-caption flex flex-wrap items-center gap-1">
        <span className="text-text-muted">{t('period')}:</span>
        {REGISTRATION_PERIODS.map((p) => (
          <Link
            key={p}
            href={p === 30 ? '/personas/registros' : `/personas/registros?dias=${p}`}
            aria-current={period === p ? 'true' : undefined}
            className={`rounded-control min-h-touch inline-flex items-center px-2 ${
              period === p
                ? 'bg-surface-sunken text-text font-semibold'
                : 'text-text-link underline underline-offset-4'
            }`}
          >
            {t(`periods.${p}`)}
          </Link>
        ))}
      </nav>

      <PageSection title={t('stepsLabel')} id="embudo" card>
        <ol className="m-0 list-none space-y-4 p-0">
          {funnel.steps.map(({ step, people }) => {
            const percent = base === 0 ? 0 : Math.round((people / base) * 100);
            return (
              <li key={step} className="space-y-1">
                <p className="type-body text-text m-0 flex flex-wrap items-baseline justify-between gap-2">
                  <span>{t(`steps.${step}`)}</span>
                  <span className="type-data">
                    {people}
                    {step !== 'registered' && (
                      <span className="type-caption text-text-muted">
                        {' '}
                        · {t('share', { percent })}
                      </span>
                    )}
                  </span>
                </p>
                <ProgressBar percent={percent} label={t(`steps.${step}`)} />
              </li>
            );
          })}
        </ol>
      </PageSection>

      {funnel.truncated && (
        <p className="type-caption text-text-muted m-0">
          {t('truncated', { count: funnel.rows.length })}
        </p>
      )}

      <DataTable<RegistrationRow>
        caption={t('tableCaption')}
        compactRows
        rows={funnel.rows}
        rowKey={(row) => row.personId}
        empty={
          <EmptyState
            title={t('empty')}
            description={t('emptyHint')}
            supportEmail={ctx.institution.supportEmail}
          />
        }
        columns={[
          {
            key: 'name',
            header: t('name'),
            cell: (row) => (
              <Link
                href={`/personas/${row.code}`}
                className="text-text-link underline underline-offset-4"
              >
                {row.name}
              </Link>
            ),
          },
          {
            key: 'registeredAt',
            hideBelow: 'md',
            header: t('registeredAt'),
            cell: (row) => (
              <time dateTime={row.registeredAt} className="type-data text-text-muted">
                {format.dateTime(new Date(row.registeredAt), { dateStyle: 'medium' })}
              </time>
            ),
          },
          {
            key: 'step',
            header: t('step'),
            cell: (row) => (
              <Badge
                variant={
                  row.step === 'enrolled'
                    ? 'success'
                    : row.step === 'registered'
                      ? 'neutral'
                      : 'info'
                }
              >
                {t(`rowStep.${row.step}`)}
              </Badge>
            ),
          },
          {
            key: 'intro',
            hideBelow: 'md',
            header: t('intro'),
            cell: (row) =>
              row.intro ? (
                <ProgressSummary progress={row.intro} />
              ) : (
                <span className="type-caption text-text-muted">{t('noIntro')}</span>
              ),
          },
          {
            key: 'paid',
            hideBelow: 'lg',
            header: t('paid'),
            cell: (row) =>
              row.paid ? (
                <span className="type-caption text-text">
                  {row.paid.programName} · {row.paid.cohortCode}
                </span>
              ) : (
                '—'
              ),
          },
        ]}
      />
    </Page>
  );
}
