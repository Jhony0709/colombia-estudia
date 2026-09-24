/**
 * `/aprender/mi-cuenta`: cuotas, pagos, acuerdo vigente; pagar en línea o por transferencia.
 * SSOT: routes.md:35, plan/09 §4 y §6, endpoints.md:50-51.
 *
 * Solo con `billing.read.own`: el estudiante adulto que paga, o el acudiente. Un plan que
 * paga un aliado no llega aquí (decisión 8). Un menor tampoco: la cartera es del acudiente.
 * `?pago=<ref>` es la vuelta del checkout: se dice que el pago está en proceso hasta que
 * el webhook lo confirme.
 */

import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getTranslations, getFormatter } from 'next-intl/server';
import { getRequestContext } from '@/lib/authz/request-context';
import { listOwnAccounts } from '@/features/billing/server/account.service';
import { isWompiConfigured } from '@/lib/billing/wompi';
import { Page, PageHeader, PageSection } from '@/components/templates/page';
import { EmptyState } from '@/components/molecules/empty-state';
import { DataTable } from '@/components/molecules/data-table';
import { Badge } from '@/components/atoms/badge';
import { AccountSummary } from '@/features/billing/components/account-summary';
import { getPolicy } from '@/features/admin/server/policies.service';
import { Alert } from '@/components/atoms/alert';
import { PayButton } from './pay-button';

export const metadata: Metadata = { title: 'Mi cuenta' };

export default async function MyAccountPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const ctx = await getRequestContext();
  const scopes = ctx.capabilities.get('billing.read.own') ?? [];
  if (scopes.length === 0) redirect('/aprender');
  const t = await getTranslations('learn.account');
  const format = await getFormatter();
  const sp = await searchParams;
  const returned = typeof sp.pago === 'string' ? sp.pago : null;

  const [accounts, policy] = await Promise.all([
    listOwnAccounts({ institutionId: ctx.institution.id, scopes }),
    getPolicy({ institutionId: ctx.institution.id }),
  ]);
  const cop = (v: number) =>
    format.number(v, { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });
  const when = (iso: string) =>
    format.dateTime(new Date(iso), { day: 'numeric', month: 'short', year: 'numeric' });
  const dayOf = (day: string) =>
    format.dateTime(new Date(`${day}T00:00:00Z`), {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC',
    });
  const online = isWompiConfigured();

  return (
    <Page>
      <PageHeader title={t('title')} description={t('description')} />

      {returned && <Alert severity="info">{t('returned')}</Alert>}

      {accounts.length === 0 ? (
        <EmptyState
          title={t('empty')}
          description={t('emptyHint')}
          supportEmail={ctx.institution.supportEmail}
        />
      ) : (
        accounts.map((a) => {
          type Installment = (typeof a.installments)[number];
          type Payment = (typeof a.payments)[number];
          return (
            <section
              key={a.enrollmentId}
              aria-labelledby={`cuenta-${a.enrollmentId}`}
              className="space-y-6"
            >
              <div className="bg-surface-base border-border-muted rounded-card elevation-resting border p-5">
                <h2 id={`cuenta-${a.enrollmentId}`} className="type-heading">
                  {a.cohort.code} — {a.cohort.name}
                </h2>
                {/* E4 (23/9): la cuenta en lenguaje de persona; la frontera menor/adulto va dentro. */}
                <div className="mt-2">
                  <AccountSummary
                    account={a}
                    requireAgreementForNextCohort={policy.requireAgreementForNextCohort}
                  />
                </div>
                {a.summary.next && (
                  <div className="mt-4 flex flex-wrap items-start gap-4">
                    {online ? <PayButton installmentId={a.summary.next.id} /> : null}
                    <details className="type-body">
                      <summary className="text-text-link min-h-touch inline-flex cursor-pointer items-center underline">
                        {t('transferData')}
                      </summary>
                      <p className="type-caption text-text-muted max-w-reading mt-2">
                        {t('transferHint', { email: ctx.institution.supportEmail ?? '' })}
                      </p>
                    </details>
                  </div>
                )}
              </div>

              <PageSection title={t('installments')}>
                <DataTable<Installment>
                  caption={t('installmentsCaption')}
                  rows={a.installments.filter((i) => i.status !== 'VOID')}
                  rowKey={(i) => i.id}
                  empty={<EmptyState title={t('noInstallments')} description="" />}
                  columns={[
                    {
                      key: 'position',
                      header: t('position'),
                      narrow: true,
                      cell: (i) => i.position,
                    },
                    // Fecha en palabras (E4): «2026-09-18» al lado de «19 de sept de 2026»
                    // era el ISO que la opinión señaló. `dueOn` es un día: se pinta en UTC.
                    { key: 'dueOn', header: t('dueOn'), cell: (i) => dayOf(i.dueOn) },
                    {
                      key: 'amount',
                      header: t('amount'),
                      numeric: true,
                      cell: (i) => cop(i.amount),
                    },
                    {
                      key: 'status',
                      header: t('status'),
                      cell: (i) => (
                        <Badge
                          variant={
                            i.overdue
                              ? 'error'
                              : i.status === 'PAID'
                                ? 'success'
                                : i.status === 'PARTIALLY_PAID'
                                  ? 'info'
                                  : 'neutral'
                          }
                        >
                          {i.overdue ? t('overdue') : t(`installmentStatuses.${i.status}`)}
                        </Badge>
                      ),
                    },
                  ]}
                />
              </PageSection>

              {a.payments.length > 0 && (
                <PageSection title={t('payments')}>
                  <DataTable<Payment>
                    caption={t('paymentsCaption')}
                    rows={a.payments.filter((p) => !p.voidedAt)}
                    rowKey={(p) => p.id}
                    empty={<EmptyState title={t('noPayments')} description="" />}
                    columns={[
                      { key: 'paidAt', header: t('paidAt'), cell: (p) => when(p.paidAt) },
                      {
                        key: 'inst',
                        header: t('position'),
                        narrow: true,
                        cell: (p) => p.installmentPosition,
                      },
                      {
                        key: 'amount',
                        header: t('amount'),
                        numeric: true,
                        cell: (p) => cop(p.amount),
                      },
                      { key: 'method', header: t('method'), cell: (p) => t(`methods.${p.method}`) },
                      {
                        key: 'state',
                        header: t('status'),
                        cell: (p) => (
                          <Badge variant={p.confirmedAt ? 'success' : 'warning'}>
                            {p.confirmedAt ? t('confirmed') : t('processing')}
                          </Badge>
                        ),
                      },
                    ]}
                  />
                </PageSection>
              )}
            </section>
          );
        })
      )}
    </Page>
  );
}
