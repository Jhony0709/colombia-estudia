/**
 * `/cartera/[enrollmentId]`: cuotas, pagos, acuerdos, historial de una matrícula.
 * SSOT: routes.md (§Operaciones), plan/09 §6.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTranslations, getFormatter } from 'next-intl/server';
import { getRequestContext } from '@/lib/authz/request-context';
import { requireCapability } from '@/lib/authz/with-capability';
import { getAccount } from '@/features/billing/server/billing.service';
import { listCohortFormOptions } from '@/features/cohorts/server/cohorts.service';
import { Page, PageHeader, PageSection } from '@/components/templates/page';
import { Breadcrumb } from '@/components/molecules/breadcrumb';
import { DataTable } from '@/components/molecules/data-table';
import { EmptyState } from '@/components/molecules/empty-state';
import { StatCard, StatGrid } from '@/components/molecules/stat-card';
import { Badge, type BadgeVariant } from '@/components/atoms/badge';
import { Alert } from '@/components/atoms/alert';
import { Wallet, TriangleAlert, CalendarClock, CircleCheck } from 'lucide-react';
import {
  CreatePlan,
  RegisterPayment,
  VoidPayment,
  EditInstallment,
  SignAgreement,
  CancelAgreement,
} from './billing-actions';

export const metadata: Metadata = { title: 'Cartera de la matrícula' };

const STATUS_BADGE: Record<string, BadgeVariant> = {
  CURRENT: 'success',
  OVERDUE: 'error',
  IN_AGREEMENT: 'warning',
  PARTNER_PAID: 'info',
};
const INSTALLMENT_BADGE: Record<string, BadgeVariant> = {
  OPEN: 'neutral',
  PARTIALLY_PAID: 'info',
  PAID: 'success',
  VOID: 'neutral',
};

export default async function EnrollmentBillingPage({
  params,
}: {
  params: Promise<{ enrollmentId: string }>;
}) {
  await requireCapability('billing.manage');
  const ctx = await getRequestContext();
  const { enrollmentId } = await params;

  const [account, options, t, tb, format] = await Promise.all([
    getAccount({ institutionId: ctx.institution.id, enrollmentId }),
    listCohortFormOptions(ctx.institution.id),
    getTranslations('billing'),
    getTranslations('crumbs'),
    getFormatter(),
  ]);
  if (!account) notFound();

  const cop = (v: number) =>
    format.number(v, { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });
  const when = (iso: string) =>
    format.dateTime(new Date(iso), { day: 'numeric', month: 'short', year: 'numeric' });
  type Installment = (typeof account.installments)[number];
  type Payment = (typeof account.payments)[number];
  const activeAgreement = account.agreements.find((a) => a.status === 'ACTIVE') ?? null;

  return (
    <Page wide>
      <PageHeader
        overline={`${account.cohort.code} · ${account.cohort.name}`}
        title={account.student.name}
        description={
          account.plan
            ? `${t(`statuses.${account.status}`)} · ${account.plan.payerType === 'PARTNER' ? t('paidBy', { name: account.plan.partnerName ?? '' }) : t('payer', { name: account.plan.payerName ?? t('noPayer') })}`
            : t('statuses.NO_PLAN')
        }
        back={
          <Breadcrumb
            label={tb('label')}
            items={[
              { label: tb('home'), href: '/ingresar' },
              { label: t('crumb'), href: '/cartera' },
              { label: account.student.name },
            ]}
          />
        }
        action={
          <Link
            href={`/cohortes/${account.cohort.id}/matriculas/${account.enrollmentId}`}
            className="text-text-link min-h-touch inline-flex items-center underline underline-offset-4"
          >
            {t('enrollmentLink')}
          </Link>
        }
      />

      {account.student.isMinor && <Alert severity="info">{t('minorNotice')}</Alert>}

      {!account.plan ? (
        <PageSection title={t('plan.title')} description={t('plan.hint')} card>
          <CreatePlan
            enrollmentId={account.enrollmentId}
            isMinor={account.student.isMinor}
            partners={options.partners}
          />
        </PageSection>
      ) : (
        <>
          <section aria-label={t('statsLabel')}>
            <StatGrid>
              <StatCard label={t('total')} value={account.plan.totalAmount} icon={Wallet} />
              <StatCard
                label={t('paid')}
                value={account.summary.paid}
                icon={CircleCheck}
                tone="success"
              />
              <StatCard
                label={t('overdue')}
                value={account.summary.overdue}
                icon={TriangleAlert}
                tone={account.summary.overdue > 0 ? 'warning' : 'info'}
              />
              <StatCard label={t('pending')} value={account.summary.pending} icon={CalendarClock} />
            </StatGrid>
            <p className="type-caption text-text-muted mt-3">
              {account.summary.next
                ? t('nextInstallment', {
                    position: account.summary.next.position,
                    amount: cop(account.summary.next.amount),
                    dueOn: account.summary.next.dueOn,
                  })
                : t('allPaid')}
              {' · '}
              <Badge variant={STATUS_BADGE[account.status ?? 'CURRENT']}>
                {t(`statuses.${account.status}`)}
              </Badge>
            </p>
          </section>

          <PageSection title={t('installments')} id="cuotas">
            <DataTable<Installment>
              caption={t('installmentsCaption')}
              rows={account.installments}
              rowKey={(i) => i.id}
              empty={<EmptyState title={t('noInstallments')} description="" />}
              columns={[
                {
                  key: 'position',
                  header: t('installment.position'),
                  narrow: true,
                  cell: (i) => `${i.position}${i.agreementId ? ' *' : ''}`,
                },
                {
                  key: 'dueOn',
                  header: t('installment.dueOn'),
                  cell: (i) =>
                    i.overdue ? <span className="text-status-error-base">{i.dueOn}</span> : i.dueOn,
                },
                {
                  key: 'amount',
                  header: t('installment.amount'),
                  numeric: true,
                  cell: (i) => cop(i.amount),
                },
                {
                  key: 'paid',
                  header: t('installment.paid'),
                  numeric: true,
                  cell: (i) => cop(i.paid),
                },
                {
                  key: 'status',
                  header: t('status'),
                  narrow: true,
                  cell: (i) => (
                    <Badge variant={i.overdue ? 'error' : INSTALLMENT_BADGE[i.status]}>
                      {i.overdue ? t('installment.overdue') : t(`installment.statuses.${i.status}`)}
                    </Badge>
                  ),
                },
                {
                  key: 'actions',
                  header: <span className="sr-only">{t('actions')}</span>,
                  headerLabel: t('actions'),
                  cell: (i) =>
                    i.status === 'OPEN' ? (
                      <EditInstallment
                        installment={{ id: i.id, amount: i.amount, dueOn: i.dueOn }}
                      />
                    ) : null,
                },
              ]}
            />
            {account.installments.some((i) => i.agreementId) && (
              <p className="type-caption text-text-muted mt-2">{t('agreementMark')}</p>
            )}
          </PageSection>

          <PageSection title={t('payment.title')} description={t('payment.hint')} id="pago" card>
            <RegisterPayment installments={account.installments} />
          </PageSection>

          <PageSection title={t('paymentsTitle')} id="pagos">
            <DataTable<Payment>
              caption={t('paymentsCaption')}
              rows={account.payments}
              rowKey={(p) => p.id}
              empty={<EmptyState title={t('noPayments')} description={t('noPaymentsHint')} />}
              columns={[
                { key: 'paidAt', header: t('payment.paidAt'), cell: (p) => when(p.paidAt) },
                {
                  key: 'inst',
                  header: t('installment.position'),
                  narrow: true,
                  cell: (p) => p.installmentPosition,
                },
                {
                  key: 'amount',
                  header: t('payment.amount'),
                  numeric: true,
                  cell: (p) => cop(p.amount),
                },
                {
                  key: 'method',
                  header: t('payment.method'),
                  cell: (p) => (
                    <>
                      {t(`payment.methods.${p.method}`)}
                      {(p.reference || p.gatewayRef) && (
                        <span className="type-caption text-text-muted block">
                          {p.reference ?? p.gatewayRef}
                        </span>
                      )}
                    </>
                  ),
                },
                {
                  key: 'state',
                  header: t('status'),
                  cell: (p) =>
                    p.voidedAt ? (
                      <>
                        <Badge variant="neutral">{t('payment.voidedBadge')}</Badge>
                        <span className="type-caption text-text-muted block">{p.voidReason}</span>
                      </>
                    ) : p.confirmedAt ? (
                      <>
                        <Badge variant="success">{t('payment.confirmedBadge')}</Badge>
                        {p.confirmedByName && (
                          <span className="type-caption text-text-muted block">
                            {p.confirmedByName}
                          </span>
                        )}
                      </>
                    ) : (
                      <Badge variant="warning">{t('payment.unconfirmedBadge')}</Badge>
                    ),
                },
                {
                  key: 'actions',
                  header: <span className="sr-only">{t('actions')}</span>,
                  headerLabel: t('actions'),
                  cell: (p) => (!p.voidedAt ? <VoidPayment paymentId={p.id} /> : null),
                },
              ]}
            />
          </PageSection>

          <PageSection
            title={t('agreement.title')}
            description={t('agreement.sectionHint')}
            id="acuerdo"
            card
          >
            {account.agreements.length > 0 && (
              <ul className="divide-border-muted mb-4 divide-y">
                {account.agreements.map((a) => (
                  <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                    <div>
                      <p className="type-body-emphasis m-0">
                        <Badge
                          variant={
                            a.status === 'ACTIVE'
                              ? 'warning'
                              : a.status === 'FULFILLED'
                                ? 'success'
                                : 'neutral'
                          }
                        >
                          {t(`agreement.statuses.${a.status}`)}
                        </Badge>{' '}
                        {t('agreement.signedOn', {
                          date: when(a.signedAt),
                          name: a.signerName ?? t('noPayer'),
                        })}
                      </p>
                      <p className="type-caption text-text-muted m-0">
                        {t('agreement.installmentsCount', { count: a.installmentIds.length })}
                        {a.notes ? ` · ${a.notes}` : ''}
                      </p>
                    </div>
                    {a.status === 'ACTIVE' && <CancelAgreement agreementId={a.id} />}
                  </li>
                ))}
              </ul>
            )}
            <SignAgreement
              enrollmentId={account.enrollmentId}
              hasActive={activeAgreement !== null}
            />
          </PageSection>
        </>
      )}
    </Page>
  );
}
