/**
 * `/inicio` — la pantalla de situación del staff (ola 3 UX, 23/9).
 * SSOT: docs/ux/decision-ux-2309.md («Aterrizaje de ADMIN»), reference/01-routing/routes.md.
 *
 * Tres bloques y nada más: lo que requiere atención hoy (cada línea lleva a la pantalla que
 * lo resuelve, y solo salen las que la persona puede resolver), cómo van los tres embudos
 * de la ola 1 en los últimos 30 días, y —para quien opera cohortes— lo que viene y lo último
 * que pasó. La configuración no está aquí: esto es para mirar cada día, no para ajustar.
 */

import type { Metadata } from 'next';
import type { Route } from 'next';
import Link from 'next/link';
import { getFormatter, getTranslations } from 'next-intl/server';
import { ArrowRight, CircleAlert, CircleCheck } from 'lucide-react';
import type { Capability } from '@colombia-estudia/domain';
import { requireStaffSession } from '@/lib/authz/staff';
import { getRequestContext } from '@/lib/authz/request-context';
import {
  getStaffInbox,
  type AttentionKind,
  type StaffInbox,
} from '@/features/staff/server/inbox.service';
import {
  listRecentCohortActivity,
  listUpcomingCohorts,
} from '@/features/cohorts/server/cohorts.service';
import { Page, PageHeader, PageSection } from '@/components/templates/page';
import { WithRail } from '@/components/molecules/rail';
import { StatGrid } from '@/components/molecules/stat-card';
import { CohortsRail } from '../cohortes/cohorts-rail';

export const metadata: Metadata = { title: 'Inicio' };

/** Qué capacidad hace accionable cada línea: sin ella, la línea no se muestra. */
const NEEDS: Record<AttentionKind, Capability> = {
  submissions: 'assessment.grade',
  planned_missing: 'cohort.manage',
  content_updates: 'cohort.manage',
  invitations: 'people.manage',
  overdue: 'billing.manage',
};

export default async function StaffHomePage() {
  await requireStaffSession();
  const ctx = await getRequestContext();
  const institutionId = ctx.institution.id;
  const can = (c: Capability) => (ctx.capabilities.get(c)?.length ?? 0) > 0;
  const now = new Date();

  const [inbox, upcoming, activity, t, format] = await Promise.all([
    getStaffInbox({ institutionId, now }),
    can('cohort.manage') ? listUpcomingCohorts({ institutionId, now }) : null,
    can('cohort.manage') ? listRecentCohortActivity({ institutionId }) : null,
    getTranslations('home'),
    getFormatter(),
  ]);

  const attention = inbox.attention.filter((item) => can(NEEDS[item.kind]));
  const since = format.dateTime(new Date(inbox.funnels.since), { dateStyle: 'medium' });

  const body = (
    <>
      <PageSection title={t('attention.title')} id="atencion" card>
        {attention.length === 0 ? (
          <p className="type-body text-text-muted m-0 flex items-center gap-2">
            <CircleCheck aria-hidden className="text-status-success-base size-4 shrink-0" />
            {t('attention.empty')}
          </p>
        ) : (
          <ul className="divide-border-muted -my-1 divide-y">
            {attention.map((item) => (
              <li key={`${item.kind}-${item.href}`} className="flex items-center gap-3 py-2">
                <CircleAlert aria-hidden className="text-status-warning-base size-4 shrink-0" />
                <span className="type-body text-text flex-1">
                  {t(`attention.${item.kind}`, { count: item.count })}
                  {item.cohort && (
                    <span className="type-caption text-text-muted block">
                      {item.cohort.code} · {item.cohort.name}
                    </span>
                  )}
                </span>
                <Link
                  href={item.href as Route}
                  className="text-text-link min-h-touch inline-flex items-center gap-1 underline underline-offset-4"
                >
                  {t('attention.go')}
                  <ArrowRight aria-hidden className="size-4" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </PageSection>

      <PageSection
        title={t('funnels.title')}
        description={t('funnels.description', { since })}
        id="embudos"
      >
        <StatGrid columns={3}>
          <FunnelCard
            label={t('funnels.onboarding')}
            hint={t('funnels.onboardingHint')}
            {...inbox.funnels.onboarding}
          />
          <FunnelCard
            label={t('funnels.lessons')}
            hint={t('funnels.lessonsHint')}
            {...inbox.funnels.lessons}
          />
          <FunnelCard
            label={t('funnels.submissions')}
            hint={t('funnels.submissionsHint')}
            {...inbox.funnels.submissions}
          />
        </StatGrid>
        <p className="type-caption text-text-muted mt-3">{t('funnels.note')}</p>
      </PageSection>

      <PageSection
        title={t('journey.title')}
        description={t('journey.description')}
        id="recorrido"
        card
      >
        <Journey steps={inbox.journey} labels={(key) => t(`journey.steps.${key}`)} />
      </PageSection>
    </>
  );

  return (
    <Page wide>
      <PageHeader
        overline={ctx.institution.name}
        title={t('title', { name: ctx.person?.givenName ?? '' })}
        description={t('description')}
      />
      {upcoming && activity ? (
        <WithRail
          railLabel={t('rail.label')}
          rail={<CohortsRail upcoming={upcoming} activity={activity} />}
        >
          {body}
        </WithRail>
      ) : (
        body
      )}
    </Page>
  );
}

/**
 * Un embudo en una tarjeta: «X de Y» y el porcentaje. No es `StatCard` porque el valor no
 * es una cifra sino una razón, y el porcentaje solo cuando hay denominador: 0 de 0 no es 0 %.
 */
function FunnelCard({
  label,
  hint,
  entered,
  completed,
}: {
  label: string;
  hint: string;
  entered: number;
  completed: number;
}) {
  const percent = entered === 0 ? null : Math.round((completed / entered) * 100);
  return (
    <div className="bg-surface-base border-border-muted rounded-card elevation-resting flex flex-col gap-1 border p-4">
      <p className="type-label text-text-muted m-0">{label}</p>
      <p className="type-display text-text m-0">
        {completed}
        <span className="type-body text-text-muted"> / {entered}</span>
        {percent !== null && <span className="type-body text-text-muted"> · {percent} %</span>}
      </p>
      <p className="type-caption text-text-muted m-0">{hint}</p>
    </div>
  );
}

/**
 * El recorrido del estudiante como barras horizontales, una por paso, con personas y el
 * porcentaje sobre el primer paso. SVG con `width` como atributo (la CSP no admite `style`
 * en línea). Sin el primer paso (nadie vio la acción) todo sale a cero y se dice.
 */
function Journey({
  steps,
  labels,
}: {
  steps: StaffInbox['journey'];
  labels: (key: StaffInbox['journey'][number]['key']) => string;
}) {
  const first = steps[0]?.people ?? 0;
  return (
    <ol className="m-0 list-none space-y-3 p-0">
      {steps.map((step) => {
        const percent = first === 0 ? 0 : Math.round((step.people / first) * 100);
        return (
          <li
            key={step.key}
            className="grid grid-cols-[minmax(0,14rem)_minmax(0,1fr)_auto] items-center gap-3"
          >
            <span className="type-body text-text">{labels(step.key)}</span>
            <svg
              aria-hidden="true"
              viewBox="0 0 100 8"
              preserveAspectRatio="none"
              className="h-2 w-full overflow-hidden rounded-full"
            >
              <rect width="100" height="8" className="fill-surface-sunken" />
              <rect width={percent} height="8" className="fill-accent-base" />
            </svg>
            <span className="type-data text-text-muted whitespace-nowrap">
              {step.people}
              {first > 0 && <span> · {percent} %</span>}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
