/**
 * `/familia` — los pupilos del acudiente, con su avance y su estado (Fase C, 23/9).
 * SSOT: docs/plan-redefinicion-2009.md Fase C.2, routes.md (`/familia`).
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { getTranslations, getFormatter } from 'next-intl/server';
import { getRequestContext } from '@/lib/authz/request-context';
import { listWards } from '@/features/family/server/family.service';
import { Page, PageHeader, PageSection } from '@/components/templates/page';
import { ArrowRight, CircleAlert } from 'lucide-react';
import { EmptyState } from '@/components/molecules/empty-state';
import { StatusBadge } from '@/components/molecules/status-badge/StatusBadge';

export const metadata: Metadata = { title: 'Mi familia' };

export default async function FamilyPage() {
  const ctx = await getRequestContext();
  const [wards, t, format] = await Promise.all([
    listWards({
      institutionId: ctx.institution.id,
      wardScopes: ctx.capabilities.get('progress.read.ward') ?? [],
      billingScopes: ctx.capabilities.get('billing.read.own') ?? [],
    }),
    getTranslations('family'),
    getFormatter(),
  ]);

  // Días (`YYYY-MM-DD`) en UTC, o Bogotá los pinta un día antes; en palabras, no en ISO.
  const day = (iso: string) =>
    format.dateTime(new Date(`${iso}T00:00:00Z`), {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    });
  const cop = (v: number) =>
    format.number(v, { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });

  const today = new Date().toISOString().slice(0, 10);
  const soon = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const attention = wards.flatMap((ward) => {
    const href = `/familia/${ward.enrollmentId}` as const;
    const items: Array<{ key: string; text: string; href: typeof href }> = [];
    if (ward.account && ward.account.overdueCount > 0) {
      items.push({
        key: `${ward.enrollmentId}-overdue`,
        text: t('attention.overdue', {
          name: ward.student.name,
          cohort: ward.cohort.code,
          count: ward.account.overdueCount,
          amount: cop(ward.account.overdue),
        }),
        href,
      });
    }
    // «No ha empezado» solo si la cohorte ya empezó: antes del inicio no hay nada que empezar.
    if (
      ward.status === 'ACTIVE' &&
      ward.cohort.status === 'OPEN' &&
      ward.cohort.startsOn <= today &&
      ward.progress.completed === 0
    ) {
      items.push({
        key: `${ward.enrollmentId}-notStarted`,
        text: t('attention.notStarted', { name: ward.student.name, cohort: ward.cohort.code }),
        href,
      });
    }
    if (ward.status === 'ACTIVE' && ward.accessUntil <= soon) {
      items.push({
        key: `${ward.enrollmentId}-access`,
        text: t('attention.accessEnding', {
          name: ward.student.name,
          cohort: ward.cohort.code,
          date: day(ward.accessUntil),
        }),
        href,
      });
    }
    return items;
  });

  return (
    <Page>
      <PageHeader title={t('title')} description={t('description')} />

      {/*
        Ola 3 (23/9): lo que requiere atención, arriba, antes de las tarjetas. Solo lo que el
        acudiente puede hacer algo al respecto: una cuota vencida (si la paga), un pupilo que
        no ha empezado con la cohorte ya abierta, un acceso que vence pronto. Cada línea lleva
        a la ficha del pupilo.
      */}
      {attention.length > 0 && (
        <PageSection title={t('attention.title')} id="atencion" card>
          <ul className="divide-border-muted -my-1 divide-y">
            {attention.map((item) => (
              <li key={item.key} className="flex items-center gap-3 py-2">
                <CircleAlert aria-hidden className="text-status-warning-base size-4 shrink-0" />
                <span className="type-body text-text flex-1">{item.text}</span>
                <Link
                  href={item.href}
                  className="text-text-link min-h-touch inline-flex items-center gap-1 underline underline-offset-4"
                >
                  {t('attention.go')}
                  <ArrowRight aria-hidden className="size-4" />
                </Link>
              </li>
            ))}
          </ul>
        </PageSection>
      )}

      {wards.length === 0 ? (
        <EmptyState
          title={t('empty')}
          description={t('emptyHint')}
          supportEmail={ctx.institution.supportEmail}
        />
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {wards.map((ward) => (
            <li
              key={ward.enrollmentId}
              className="bg-surface-base border-border-muted rounded-card elevation-resting flex flex-col gap-3 border p-5"
            >
              <div>
                <p className="type-caption text-text-muted">{ward.cohort.programName}</p>
                <h2 className="type-subheading text-text">{ward.student.name}</h2>
                <p className="type-caption text-text-muted">
                  {ward.cohort.code} · {ward.cohort.name}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge domain="enrollment" status={ward.status} />
                {ward.account?.status && (
                  <StatusBadge domain="account" status={ward.account.status} />
                )}
              </div>

              <div className="space-y-1">
                {/* SVG y no un div con `style`: la CSP no admite estilos en línea. */}
                <svg
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={ward.progress.percent}
                  aria-label={t('progressLabel', { name: ward.student.name })}
                  viewBox="0 0 100 8"
                  preserveAspectRatio="none"
                  className="h-2 w-full overflow-hidden rounded-full"
                >
                  <rect width="100" height="8" className="fill-surface-sunken" />
                  <rect width={ward.progress.percent} height="8" className="fill-accent-base" />
                </svg>
                <p className="type-caption text-text-muted">
                  {t('progress', {
                    completed: ward.progress.completed,
                    total: ward.progress.total,
                    percent: ward.progress.percent,
                  })}
                </p>
              </div>

              <p className="type-caption text-text-muted">
                {t('accessUntil', { date: day(ward.accessUntil) })}
              </p>

              <Link
                href={`/familia/${ward.enrollmentId}`}
                className="text-text-link type-body-emphasis min-h-touch mt-auto inline-flex items-center underline underline-offset-4"
              >
                {t('open', { name: ward.student.name })}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Page>
  );
}
