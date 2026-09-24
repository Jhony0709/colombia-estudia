/**
 * Cohorts for operations.
 * SSOT: plan/06-cohortes-y-personas.md:23-30, routes.md (/cohortes).
 *
 * The status filter is a plain GET form, same as /personas: the filter lives in the URL.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { getRequestContext } from '@/lib/authz/request-context';
import { requireCapability } from '@/lib/authz/with-capability';
import { CalendarClock, CalendarDays, DoorOpen, Users } from 'lucide-react';
import {
  getCohortStats,
  listCohorts,
  listCohortFormOptions,
  listRecentCohortActivity,
  listUpcomingCohorts,
  COHORT_STATUSES,
  type CohortStatus,
  type CohortRow,
} from '@/features/cohorts/server/cohorts.service';
import { FormField, FormInput, FormSelect } from '@/components/atoms/form-field';
import { StatusBadge } from '@/components/molecules/status-badge/StatusBadge';
import { Button } from '@/components/atoms/button';
import { Breadcrumb } from '@/components/molecules/breadcrumb';
import { DataTable } from '@/components/molecules/data-table';
import { EmptyState } from '@/components/molecules/empty-state';
import { FilterChips, type FilterChip } from '@/components/molecules/filter-chips';
import { WithRail } from '@/components/molecules/rail';
import { StatCard, StatGrid } from '@/components/molecules/stat-card';
import { Page, PageHeader } from '@/components/templates/page';
import { CohortStatusAction, NewCohortForm } from './cohort-actions';
import { CohortsRail } from './cohorts-rail';

export const metadata: Metadata = { title: 'Cohortes' };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

interface Filters {
  status: CohortStatus | null;
  programId: string | null;
  q: string;
}

function parseFilters(params: Record<string, string | string[] | undefined>): Filters {
  const one = (key: string) => {
    const raw = params[key];
    return (Array.isArray(raw) ? raw[0] : raw)?.trim() ?? '';
  };
  const status = one('estado').toUpperCase();
  return {
    status: (COHORT_STATUSES as readonly string[]).includes(status)
      ? (status as CohortStatus)
      : null,
    programId: one('programa') || null,
    q: one('q').slice(0, 80),
  };
}

function hrefFor(f: Partial<Filters>): string {
  const search = new URLSearchParams();
  if (f.q) search.set('q', f.q);
  if (f.status) search.set('estado', f.status);
  if (f.programId) search.set('programa', f.programId);
  const query = search.toString();
  return `/cohortes${query ? `?${query}` : ''}`;
}

export default async function CohortsPage({ searchParams }: { searchParams: SearchParams }) {
  await requireCapability('cohort.manage');
  const ctx = await getRequestContext();

  const filters = parseFilters(await searchParams);
  const institutionId = ctx.institution.id;
  const now = new Date();
  const status = filters.status;
  const [cohorts, options, stats, upcoming, activity, t] = await Promise.all([
    listCohorts({ institutionId, status, programId: filters.programId, q: filters.q }),
    listCohortFormOptions(institutionId),
    getCohortStats({ institutionId, now }),
    listUpcomingCohorts({ institutionId, now }),
    listRecentCohortActivity({ institutionId }),
    getTranslations('cohorts'),
  ]);
  const filtered = Boolean(status || filters.programId || filters.q);
  const programName = (id: string) => options.programs.find((p) => p.id === id)?.code ?? id;
  const chips: FilterChip[] = [];
  if (filters.q)
    chips.push({
      key: 'q',
      label: t('chipSearch', { q: filters.q }),
      removeHref: hrefFor({ ...filters, q: '' }),
    });
  if (status)
    chips.push({
      key: 'estado',
      label: t(`statuses.${status}`),
      removeHref: hrefFor({ ...filters, status: null }),
    });
  if (filters.programId)
    chips.push({
      key: 'programa',
      label: programName(filters.programId),
      removeHref: hrefFor({ ...filters, programId: null }),
    });

  return (
    <Page wide>
      <PageHeader
        back={
          <Breadcrumb items={[{ label: t('home'), href: '/ingresar' }, { label: t('title') }]} />
        }
        overline={t('overline')}
        title={t('title')}
        description={t('description')}
        action={<NewCohortForm options={options} />}
      />

      <section aria-label={t('stats.label')}>
        <StatGrid>
          <StatCard
            label={t('stats.open')}
            value={stats.open}
            icon={DoorOpen}
            tone="success"
            href={hrefFor({ status: 'OPEN' })}
          />
          <StatCard
            label={t('stats.planned')}
            value={stats.planned}
            icon={CalendarDays}
            href={hrefFor({ status: 'PLANNED' })}
          />
          <StatCard label={t('stats.active')} value={stats.activeEnrollments} icon={Users} />
          <StatCard
            label={t('stats.endingSoon')}
            value={stats.endingSoon}
            icon={CalendarClock}
            tone={stats.endingSoon > 0 ? 'warning' : 'info'}
          />
        </StatGrid>
      </section>

      <WithRail
        railLabel={t('rail.label')}
        rail={<CohortsRail upcoming={upcoming} activity={activity} />}
      >
        {/* Los filtros en su tarjeta: son el mando de la lista, no la lista. */}
        <form
          method="get"
          role="search"
          className="bg-surface-base border-border-muted rounded-card elevation-resting space-y-4 border p-5"
        >
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-56 flex-1">
              <FormField label={t('search')} name="q" hint={t('searchHint')} hintPlacement="icon">
                <FormInput name="q" type="search" defaultValue={filters.q} />
              </FormField>
            </div>
            <div className="w-48">
              <FormField label={t('status')} name="estado">
                <FormSelect name="estado" defaultValue={status ?? ''}>
                  <option value="">{t('anyStatus')}</option>
                  {COHORT_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {t(`statuses.${s}`)}
                    </option>
                  ))}
                </FormSelect>
              </FormField>
            </div>
            <div className="w-56">
              <FormField label={t('programFilter')} name="programa">
                <FormSelect name="programa" defaultValue={filters.programId ?? ''}>
                  <option value="">{t('anyProgram')}</option>
                  {options.programs.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.code} · {p.name}
                    </option>
                  ))}
                </FormSelect>
              </FormField>
            </div>
            <Button type="submit" variant="secondary">
              {t('filter')}
            </Button>
          </div>
          <FilterChips
            chips={chips}
            clearHref="/cohortes"
            clearLabel={t('clearFilters')}
            removeLabel={(label) => t('removeFilter', { label })}
          />
        </form>

        <p className="type-caption text-text-muted m-0" role="status">
          {t('resultCount', { count: cohorts.length })}
        </p>

        <DataTable<CohortRow>
          caption={t('tableCaption')}
          compactRows
          rows={cohorts}
          rowKey={(cohort) => cohort.id}
          empty={
            <EmptyState
              title={filtered ? t('emptyFiltered') : t('empty')}
              description={filtered ? t('emptyFilteredHint') : t('emptyHint')}
              supportEmail={ctx.institution.supportEmail}
            />
          }
          columns={[
            {
              key: 'code',
              header: t('code'),
              cell: (cohort) => (
                <>
                  <Link
                    href={`/cohortes/${cohort.id}`}
                    className="text-text-link underline underline-offset-4"
                  >
                    {cohort.code}
                  </Link>
                  <span className="type-caption text-text-muted block">{cohort.name}</span>
                </>
              ),
            },
            {
              key: 'program',
              header: t('program'),
              cell: (cohort) => (
                <>
                  {cohort.programCode}
                  {cohort.partnerName && (
                    <span className="type-caption text-text-muted block">{cohort.partnerName}</span>
                  )}
                </>
              ),
            },
            {
              key: 'dates',
              header: t('dates'),
              numeric: true,
              cell: (cohort) => `${cohort.startsOn} → ${cohort.endsOn}`,
            },
            {
              key: 'enrollments',
              header: t('enrollments'),
              numeric: true,
              cell: (cohort) => cohort.enrollmentCount,
            },
            {
              key: 'status',
              header: t('status'),
              cell: (cohort) => <StatusBadge domain="cohort" status={cohort.status} />,
            },
            {
              key: 'actions',
              header: t('actions'),
              narrow: true,
              cell: (cohort) => (
                <CohortStatusAction
                  cohortId={cohort.id}
                  status={cohort.status}
                  code={cohort.code}
                />
              ),
            },
          ]}
        />
      </WithRail>
    </Page>
  );
}
