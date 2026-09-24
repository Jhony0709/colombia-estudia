/**
 * `/aliado`: el avance de las cohortes que financia el aliado, con exportación.
 * SSOT: routes.md:45, plan/08 §7, reportes.md («nada individual al aliado que no sea de su
 * cohorte»; cartera solo si `payerType PARTNER`, Fase 5).
 *
 * Con varias cohortes, una a la vez (`?cohorte=`): los números son por cohorte, y un
 * promedio de dos cohortes distintas no significa nada.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { getTranslations, getFormatter } from 'next-intl/server';
import { getRequestContext } from '@/lib/authz/request-context';
import { getCohortProgress, listPartnerCohorts } from '@/features/cohorts/server/progress.service';
import { CohortProgressView } from '@/features/cohorts/components/cohort-progress-view';
import { listOwnAccounts } from '@/features/billing/server/account.service';
import { DataTable } from '@/components/molecules/data-table';
import { StatusBadge } from '@/components/molecules/status-badge/StatusBadge';
import { Page, PageHeader, PageSection } from '@/components/templates/page';
import { EmptyState } from '@/components/molecules/empty-state';
import { cn } from '@/lib/utils';

export const metadata: Metadata = { title: 'Mi cohorte' };

export default async function PartnerPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const ctx = await getRequestContext();
  const t = await getTranslations('partner');
  const partnerIds = (ctx.capabilities.get('progress.read.cohort') ?? [])
    .map((s) => ('partnerId' in s ? s.partnerId : null))
    .filter((x): x is string => x !== null);

  const cohorts = await listPartnerCohorts({ institutionId: ctx.institution.id, partnerIds });

  const wanted = (await searchParams).cohorte;
  const chosen =
    cohorts.find((c) => c.id === (Array.isArray(wanted) ? wanted[0] : wanted)) ??
    cohorts[0] ??
    null;

  const progress = chosen
    ? await getCohortProgress({ institutionId: ctx.institution.id, cohortId: chosen.id })
    : null;

  // La cartera de su cohorte, solo si el aliado paga (`billing.read.own` con `partnerId`).
  const billingScopes = ctx.capabilities.get('billing.read.own') ?? [];
  const accounts = chosen
    ? (await listOwnAccounts({ institutionId: ctx.institution.id, scopes: billingScopes })).filter(
        (a) => a.cohort.id === chosen.id
      )
    : [];
  const format = await getFormatter();
  const cop = (v: number) =>
    format.number(v, { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });
  type Account = (typeof accounts)[number];

  return (
    <Page wide>
      <PageHeader
        overline={progress ? progress.cohort.programName : undefined}
        title={progress ? `${progress.cohort.code} — ${progress.cohort.name}` : t('title')}
        description={t('description')}
      />

      {cohorts.length > 1 && (
        <nav aria-label={t('cohortsLabel')}>
          <ul className="flex flex-wrap gap-2">
            {cohorts.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/aliado?cohorte=${c.id}`}
                  aria-current={chosen?.id === c.id ? 'page' : undefined}
                  className={cn(
                    'rounded-pill min-h-touch type-label inline-flex items-center border px-3',
                    chosen?.id === c.id
                      ? 'border-accent-base bg-surface-sunken text-text'
                      : 'border-border text-text-muted hover:text-text'
                  )}
                >
                  {c.code}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}

      {progress ? (
        <CohortProgressView
          progress={progress}
          personLinks={false}
          exportHref={`/api/cohorts/${progress.cohort.id}/export`}
        />
      ) : (
        <EmptyState
          title={t('empty')}
          description={t('emptyHint')}
          supportEmail={ctx.institution.supportEmail}
        />
      )}

      {/* La cartera de su cohorte, solo si el aliado paga (plan/09 §6). */}
      {accounts.length > 0 && (
        <PageSection title={t('billingTitle')} description={t('billingHint')}>
          <DataTable<Account>
            caption={t('billingCaption')}
            rows={accounts}
            rowKey={(a) => a.enrollmentId}
            empty={<EmptyState title={t('billingEmpty')} description="" />}
            columns={[
              { key: 'name', header: t('student'), cell: (a) => a.student.name },
              {
                key: 'status',
                header: t('status'),
                narrow: true,
                cell: (a) => <StatusBadge domain="account" status={a.status ?? 'CURRENT'} />,
              },
              {
                key: 'paid',
                header: t('paidOfTotal'),
                numeric: true,
                cell: (a) => `${cop(a.summary.paid)} / ${cop(a.plan?.totalAmount ?? 0)}`,
              },
              {
                key: 'overdue',
                header: t('overdue'),
                numeric: true,
                cell: (a) => (a.summary.overdue > 0 ? cop(a.summary.overdue) : '—'),
              },
              {
                key: 'next',
                header: t('next'),
                cell: (a) =>
                  a.summary.next ? `${a.summary.next.dueOn} · ${cop(a.summary.next.amount)}` : '—',
              },
            ]}
          />
        </PageSection>
      )}
    </Page>
  );
}
