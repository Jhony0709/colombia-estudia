/**
 * `/cartera`: quién está al día, sin abrir Excel.
 * SSOT: routes.md (§Operaciones), plan/09 §6, acceso-y-cartera.md §4.
 *
 * El estado de cada fila es el derivado (`deriveAccountStatus` con `now`): esta pantalla no
 * guarda nada. Filtros en la URL (cohorte, aliado, estado, búsqueda) para que un enlace
 * «los vencidos de COC-2026-2» se pueda mandar por WhatsApp.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { getTranslations, getFormatter } from 'next-intl/server';
import { Wallet, TriangleAlert, Handshake, FileX } from 'lucide-react';
import { getRequestContext } from '@/lib/authz/request-context';
import { requireCapability } from '@/lib/authz/with-capability';
import {
  listBilling,
  ACCOUNT_STATUSES,
  type BillingRow,
} from '@/features/billing/server/billing.service';
import { parseBillingFilters } from '@/features/billing/server/filters';
import { listCohortFormOptions, listCohorts } from '@/features/cohorts/server/cohorts.service';
import { Page, PageHeader } from '@/components/templates/page';
import { Breadcrumb } from '@/components/molecules/breadcrumb';
import { DataTable } from '@/components/molecules/data-table';
import { EmptyState } from '@/components/molecules/empty-state';
import { FilterChips, type FilterChip } from '@/components/molecules/filter-chips';
import { StatCard, StatGrid } from '@/components/molecules/stat-card';
import { FormField, FormInput, FormSelect } from '@/components/atoms/form-field';
import { Button } from '@/components/atoms/button';
import { Badge, type BadgeVariant } from '@/components/atoms/badge';

export const metadata: Metadata = { title: 'Cartera' };

const STATUS_BADGE: Record<string, BadgeVariant> = {
  CURRENT: 'success',
  OVERDUE: 'error',
  IN_AGREEMENT: 'warning',
  PARTNER_PAID: 'info',
};

function hrefFor(f: {
  cohortId?: string | null;
  partnerId?: string | null;
  status?: string | null;
  q?: string;
}): string {
  const s = new URLSearchParams();
  if (f.q) s.set('q', f.q);
  if (f.cohortId) s.set('cohorte', f.cohortId);
  if (f.partnerId) s.set('aliado', f.partnerId);
  if (f.status) s.set('estado', f.status);
  const qs = s.toString();
  return `/cartera${qs ? `?${qs}` : ''}`;
}

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireCapability('billing.manage');
  const ctx = await getRequestContext();
  const sp = await searchParams;
  const flat = Object.fromEntries(
    Object.entries(sp).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v])
  );
  const filters = parseBillingFilters(flat);
  const institutionId = ctx.institution.id;

  const [rows, all, options, cohorts, t, tb, format] = await Promise.all([
    listBilling({ institutionId, filters }),
    listBilling({
      institutionId,
      filters: { cohortId: null, partnerId: null, status: null, q: '' },
    }),
    listCohortFormOptions(institutionId),
    listCohorts({ institutionId, status: null, programId: null, q: '' }),
    getTranslations('billing'),
    getTranslations('crumbs'),
    getFormatter(),
  ]);

  const cop = (v: number) =>
    format.number(v, { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });
  const count = (s: string) => all.filter((r) => r.status === s).length;
  const noPlan = all.filter((r) => r.status === null).length;
  const overdueTotal = all.reduce((s, r) => s + r.overdue, 0);

  const chips: FilterChip[] = [];
  if (filters.q)
    chips.push({
      key: 'q',
      label: t('chipSearch', { q: filters.q }),
      removeHref: hrefFor({ ...filters, q: '' }),
    });
  if (filters.cohortId)
    chips.push({
      key: 'cohorte',
      label: cohorts.find((c) => c.id === filters.cohortId)?.code ?? filters.cohortId,
      removeHref: hrefFor({ ...filters, cohortId: null }),
    });
  if (filters.partnerId)
    chips.push({
      key: 'aliado',
      label: options.partners.find((p) => p.id === filters.partnerId)?.name ?? filters.partnerId,
      removeHref: hrefFor({ ...filters, partnerId: null }),
    });
  if (filters.status)
    chips.push({
      key: 'estado',
      label: t(`statuses.${filters.status}`),
      removeHref: hrefFor({ ...filters, status: null }),
    });

  const exportHref = `/api/billing/export${hrefFor(filters).replace('/cartera', '')}`;

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
        action={
          <a
            href={exportHref}
            className="text-text-link min-h-touch inline-flex items-center underline underline-offset-4"
            download
          >
            {t('exportCsv')}
          </a>
        }
      />

      <section aria-label={t('statsLabel')}>
        <StatGrid>
          <StatCard
            label={t('statuses.CURRENT')}
            value={count('CURRENT')}
            icon={Wallet}
            tone="success"
            href={hrefFor({ status: 'CURRENT' })}
          />
          <StatCard
            label={t('statuses.OVERDUE')}
            value={count('OVERDUE')}
            icon={TriangleAlert}
            tone={count('OVERDUE') > 0 ? 'warning' : 'info'}
            href={hrefFor({ status: 'OVERDUE' })}
          />
          <StatCard
            label={t('statuses.IN_AGREEMENT')}
            value={count('IN_AGREEMENT')}
            icon={Handshake}
            href={hrefFor({ status: 'IN_AGREEMENT' })}
          />
          <StatCard
            label={t('statuses.NO_PLAN')}
            value={noPlan}
            icon={FileX}
            tone={noPlan > 0 ? 'warning' : 'info'}
            href={hrefFor({ status: 'NO_PLAN' })}
          />
        </StatGrid>
        <p className="type-caption text-text-muted mt-3">
          {t('overdueTotal', { amount: cop(overdueTotal) })}
        </p>
      </section>

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
            <FormField label={t('cohort')} name="cohorte">
              <FormSelect name="cohorte" defaultValue={filters.cohortId ?? ''}>
                <option value="">{t('anyCohort')}</option>
                {cohorts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.code}
                  </option>
                ))}
              </FormSelect>
            </FormField>
          </div>
          <div className="w-48">
            <FormField label={t('partner')} name="aliado">
              <FormSelect name="aliado" defaultValue={filters.partnerId ?? ''}>
                <option value="">{t('anyPartner')}</option>
                {options.partners.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </FormSelect>
            </FormField>
          </div>
          <div className="w-44">
            <FormField label={t('status')} name="estado">
              <FormSelect name="estado" defaultValue={filters.status ?? ''}>
                <option value="">{t('anyStatus')}</option>
                {ACCOUNT_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {t(`statuses.${s}`)}
                  </option>
                ))}
                <option value="NO_PLAN">{t('statuses.NO_PLAN')}</option>
              </FormSelect>
            </FormField>
          </div>
          <Button type="submit" variant="secondary">
            {t('filter')}
          </Button>
        </div>
        <FilterChips
          chips={chips}
          clearHref="/cartera"
          clearLabel={t('clearFilters')}
          removeLabel={(label) => t('removeFilter', { label })}
        />
      </form>

      <p className="type-caption text-text-muted m-0" role="status">
        {t('resultCount', { count: rows.length })}
      </p>

      <DataTable<BillingRow>
        caption={t('tableCaption')}
        rows={rows}
        rowKey={(r) => r.enrollmentId}
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
            header: t('student'),
            cell: (r) => (
              <>
                <Link
                  href={`/cartera/${r.enrollmentId}`}
                  className="text-text-link underline underline-offset-4"
                >
                  {r.name}
                </Link>
                <span className="type-caption text-text-muted block">
                  {r.cohortCode}
                  {r.partnerName ? ` · ${r.partnerName}` : ''}
                </span>
              </>
            ),
          },
          {
            key: 'status',
            header: t('status'),
            narrow: true,
            cell: (r) => (
              <Badge variant={r.status ? STATUS_BADGE[r.status] : 'neutral'}>
                {t(`statuses.${r.status ?? 'NO_PLAN'}`)}
              </Badge>
            ),
          },
          {
            key: 'paid',
            header: t('paidOfTotal'),
            numeric: true,
            cell: (r) => (r.status ? `${cop(r.paid)} / ${cop(r.total)}` : '—'),
          },
          {
            key: 'overdue',
            header: t('overdue'),
            numeric: true,
            cell: (r) =>
              r.overdue > 0 ? (
                <span className="text-status-error-base">{cop(r.overdue)}</span>
              ) : (
                '—'
              ),
          },
          {
            key: 'next',
            header: t('next'),
            cell: (r) =>
              r.nextDueOn
                ? t('nextValue', { date: r.nextDueOn, amount: cop(r.nextAmount ?? 0) })
                : '—',
          },
        ]}
      />
    </Page>
  );
}
