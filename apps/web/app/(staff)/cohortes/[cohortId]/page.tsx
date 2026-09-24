/**
 * La ficha de una cohorte, por secciones (ola 2 UX, 23/9; `docs/ux/decision-ux-2309.md`).
 * SSOT: routes.md (`/cohortes/[cohortId]`), plan/06-cohortes-y-personas.md:72-77.
 *
 * Hasta el 23/9 era una sola página larga: resumen, actualizaciones, matricular,
 * invitaciones, sesiones y la tabla, con cuatro botones iguales en la cabecera. Ahora:
 * `SectionNav` (Resumen · Ruta · Personas · Actividades · Avance · Sesiones · Cartera; las
 * tres últimas rutas ya existían), **una** acción en la cabecera según el estado (Abrir si
 * está planeada; Matricular si está abierta) y lo demás en «Gestión». Cada sección es una
 * URL (`?seccion=`), no un panel escondido.
 */

import type { Metadata } from 'next';
import type { Route } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getFormatter, getTranslations } from 'next-intl/server';
import { getRequestContext } from '@/lib/authz/request-context';
import { requireCapability } from '@/lib/authz/with-capability';
import { getCohortDetail, type CohortDetail } from '@/features/cohorts/server/enrollments.service';
import { countSubmissions } from '@/features/cohorts/server/submissions.service';
import { listLiveSessions } from '@/features/cohorts/server/live-sessions.service';
import { listPendingContentUpdates } from '@/features/cohorts/server/cohorts.service';
import { listCohortAssignments } from '@/features/cohorts/server/assignments.service';
import { getCohortProgress } from '@/features/cohorts/server/progress.service';
import { StatCard, StatGrid } from '@/components/molecules/stat-card';
import { SectionNav, type SectionNavItem } from '@/components/molecules/section-nav';
import {
  Users,
  UserRound,
  Inbox,
  TrendingUp,
  TriangleAlert,
  CalendarClock,
  CircleAlert,
  ArrowRight,
} from 'lucide-react';
import { ContentUpdates } from './content-updates';
import { AssignmentRows } from './assignment-rows';
import { CohortManagement } from './cohort-management';
import { DataTable } from '@/components/molecules/data-table';
import { EmptyState } from '@/components/molecules/empty-state';
import { Page, PageHeader, PageSection } from '@/components/templates/page';
import { Alert } from '@/components/atoms/alert';
import { StatusBadge } from '@/components/molecules/status-badge/StatusBadge';
import { CohortStatusAction } from '../cohort-actions';
import { EnrollSheet, EnrollmentActions } from './enrollment-actions';
import { BulkInvitations } from './bulk-invitations';
import { LiveSessions } from './live-sessions';
import { Breadcrumb } from '@/components/molecules/breadcrumb';

export const metadata: Metadata = { title: 'Cohorte' };

type Params = Promise<{ cohortId: string }>;
type Enrollment = CohortDetail['enrollments'][number];

type Section = 'resumen' | 'ruta' | 'personas' | 'sesiones';
const SECTIONS: readonly Section[] = ['resumen', 'ruta', 'personas', 'sesiones'];

export default async function CohortDetailPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: Promise<{ seccion?: string | string[] }>;
}) {
  await requireCapability('cohort.manage');
  const ctx = await getRequestContext();
  const { cohortId } = await params;
  const { seccion } = await searchParams;
  const wanted = Array.isArray(seccion) ? seccion[0] : seccion;
  const section: Section = (SECTIONS as readonly string[]).includes(wanted ?? '')
    ? (wanted as Section)
    : 'resumen';

  // El avance es otra capacidad (`progress.read.cohort`): sin ella, las cifras de avance no
  // se piden ni se pintan; el resto del resumen sí.
  const canReadProgress = (ctx.capabilities.get('progress.read.cohort')?.length ?? 0) > 0;

  const [cohort, submissions, liveSessions, updates, progress, assignments, t, tc, ti] =
    await Promise.all([
      getCohortDetail({ institutionId: ctx.institution.id, cohortId }),
      countSubmissions({ institutionId: ctx.institution.id, cohortId }),
      listLiveSessions({ institutionId: ctx.institution.id, cohortId, includeArchived: true }),
      listPendingContentUpdates({ institutionId: ctx.institution.id, cohortId }),
      canReadProgress ? getCohortProgress({ institutionId: ctx.institution.id, cohortId }) : null,
      section === 'ruta' || section === 'resumen'
        ? listCohortAssignments({ institutionId: ctx.institution.id, cohortId })
        : null,
      getTranslations('enrollments'),
      getTranslations('cohorts'),
      getTranslations('bulkInvitations'),
    ]);
  const format = await getFormatter();

  if (!cohort) notFound();

  const active = cohort.enrollments.filter((e) => e.status === 'ACTIVE');
  const minors = active.filter((e) => e.isMinorAtEnrollment).length;
  const nowIso = new Date().toISOString();
  const upcomingSessions = liveSessions.filter(
    (session) => !session.archived && session.endsAt >= nowIso
  ).length;

  const openForEnrolment = cohort.status === 'PLANNED' || cohort.status === 'OPEN';

  const tb = await getTranslations('crumbs');
  const base = `/cohortes/${cohort.id}`;
  const outdated = assignments?.outdated ?? 0;
  const routeCount = updates.length + outdated;

  const nav: SectionNavItem[] = [
    { href: base as Route, label: tc('sections.resumen') },
    { href: `${base}?seccion=ruta` as Route, label: tc('sections.ruta'), count: routeCount },
    {
      href: `${base}?seccion=personas` as Route,
      label: tc('sections.personas'),
      count: cohort.enrollments.length,
    },
    {
      href: `${base}/actividades` as Route,
      label: tc('sections.actividades'),
      count: submissions.SUBMITTED,
    },
    ...(canReadProgress ? [{ href: `${base}/avance` as Route, label: tc('sections.avance') }] : []),
    {
      href: `${base}?seccion=sesiones` as Route,
      label: tc('sections.sesiones'),
      count: upcomingSessions,
    },
    { href: `/cartera?cohorte=${cohort.id}` as Route, label: tc('sections.cartera') },
  ];

  // Lo que requiere atención, en el resumen, con el enlace a donde se actúa.
  const attention: Array<{ key: string; text: string; href: Route }> = [];
  if (submissions.SUBMITTED > 0) {
    attention.push({
      key: 'submissions',
      text: tc('attention.submissions', { count: submissions.SUBMITTED }),
      href: `${base}/actividades` as Route,
    });
  }
  if (updates.length > 0) {
    attention.push({
      key: 'updates',
      text: tc('attention.updates', { count: updates.length }),
      href: `${base}?seccion=ruta` as Route,
    });
  }
  if (outdated > 0) {
    attention.push({
      key: 'outdated',
      text: tc('attention.outdated', { count: outdated }),
      href: `${base}?seccion=ruta` as Route,
    });
  }
  if (cohort.status === 'OPEN' && active.length === 0) {
    attention.push({
      key: 'noone',
      text: tc('attention.noEnrollments'),
      href: `${base}?seccion=personas` as Route,
    });
  }
  if (progress && progress.metrics.atRisk > 0) {
    attention.push({
      key: 'risk',
      text: tc('attention.atRisk', { count: progress.metrics.atRisk }),
      href: `${base}/avance` as Route,
    });
  }

  return (
    <Page>
      <PageHeader
        overline={cohort.programName}
        title={`${cohort.code} — ${cohort.name}`}
        description={[
          tc(`statuses.${cohort.status}`),
          tc(`progression${cohort.progression === 'LINEAR' ? 'Linear' : 'Free'}`),
          `${cohort.startsOn} → ${cohort.endsOn}`,
          transitionLine(cohort.lastTransition, tc, format),
        ]
          .filter((part) => part !== null)
          .join(' · ')}
        back={
          <Breadcrumb
            label={tb('label')}
            items={[
              { label: tb('home'), href: '/ingresar' },
              { label: tb('cohorts'), href: '/cohortes' },
              { label: cohort.code },
            ]}
          />
        }
        action={
          /*
            Una acción según el estado (ola 2, 23/9): planeada → Abrir (con revisión previa);
            abierta → Matricular a alguien. Lo demás —importar, exportar, cerrar— en «Gestión».
          */
          <div className="flex flex-wrap items-center gap-2">
            <CohortManagement
              cohortId={cohort.id}
              code={cohort.code}
              status={cohort.status}
              canExport={canReadProgress}
            />
            {cohort.status === 'PLANNED' ? (
              <CohortStatusAction
                cohortId={cohort.id}
                status={cohort.status}
                code={cohort.code}
                programId={cohort.programId}
                prominent
              />
            ) : (
              <EnrollSheet
                cohortId={cohort.id}
                disabled={!openForEnrolment}
                modules={cohort.modules}
                prominent
              />
            )}
          </div>
        }
      />

      <SectionNav label={tc('sections.label')} items={nav} />

      {section === 'resumen' && (
        <>
          {cohort.status === 'PLANNED' && <Alert severity="warning">{tc('plannedNotice')}</Alert>}
          {cohort.status === 'OPEN' && attention.length === 0 && (
            <Alert severity="success">{tc('openNotice')}</Alert>
          )}

          {attention.length > 0 && (
            <PageSection title={tc('attention.title')} id="atencion" card>
              <ul className="divide-border-muted -my-1 divide-y">
                {attention.map((item) => (
                  <li key={item.key} className="flex items-center gap-3 py-2">
                    <CircleAlert aria-hidden className="text-status-warning-base size-4 shrink-0" />
                    <span className="type-body text-text flex-1">{item.text}</span>
                    <Link
                      href={item.href}
                      className="text-text-link min-h-touch inline-flex items-center gap-1 underline underline-offset-4"
                    >
                      {tc('attention.go')}
                      <ArrowRight aria-hidden className="size-4" />
                    </Link>
                  </li>
                ))}
              </ul>
            </PageSection>
          )}

          <section aria-label={tc('summary.label')}>
            <StatGrid columns={progress !== null ? 3 : 4}>
              <StatCard
                label={tc('summary.active')}
                value={active.length}
                icon={Users}
                href={`${base}?seccion=personas`}
              />
              <StatCard
                label={tc('summary.minors')}
                value={minors}
                icon={UserRound}
                href={`${base}?seccion=personas`}
              />
              <StatCard
                label={tc('summary.toReview')}
                value={submissions.SUBMITTED}
                icon={Inbox}
                tone={submissions.SUBMITTED > 0 ? 'warning' : 'info'}
                href={`${base}/actividades`}
              />
              <StatCard
                label={tc('summary.upcomingSessions')}
                value={upcomingSessions}
                icon={CalendarClock}
                href={`${base}?seccion=sesiones`}
              />
              {progress !== null && (
                <>
                  <StatCard
                    label={tc('summary.progress')}
                    value={Math.round(progress.metrics.evidenceAverage * 100)}
                    icon={TrendingUp}
                    tone="success"
                    href={`${base}/avance`}
                  />
                  <StatCard
                    label={tc('summary.atRisk')}
                    value={progress.metrics.atRisk}
                    icon={TriangleAlert}
                    tone={progress.metrics.atRisk > 0 ? 'warning' : 'info'}
                    href={`${base}/avance`}
                  />
                </>
              )}
            </StatGrid>
          </section>
        </>
      )}

      {section === 'ruta' && (
        <>
          {updates.length > 0 && (
            <PageSection
              title={tc('updates.title')}
              description={tc('updates.hint')}
              id="actualizaciones"
              card
            >
              <ContentUpdates cohortId={cohort.id} updates={updates} />
            </PageSection>
          )}

          {cohort.status === 'PLANNED' ? (
            <PageSection title={tc('route.title')} id="ruta">
              <EmptyState title={tc('route.plannedTitle')} description={tc('route.plannedHint')} />
            </PageSection>
          ) : (
            assignments &&
            assignments.modules.map((module) => (
              <PageSection
                key={module.id}
                title={`${module.position}. ${module.name}`}
                id={`modulo-${module.position}`}
                card
              >
                {module.items.length === 0 ? (
                  <p className="type-body text-text-muted">{tc('route.emptyModule')}</p>
                ) : (
                  <AssignmentRows items={module.items} />
                )}
              </PageSection>
            ))
          )}
          {assignments && assignments.programItems.length > 0 && (
            <PageSection title={tc('route.programItems')} id="programa" card>
              <AssignmentRows items={assignments.programItems} />
            </PageSection>
          )}
        </>
      )}

      {section === 'personas' && (
        <>
          {!openForEnrolment && <Alert severity="info">{t('closedForEnrolment')}</Alert>}

          {/*
            Invitar es un paso aparte de matricular e importar (plan/06:57). Solo aparece si
            hay a quién invitar: una sección con un botón que no puede hacer nada es ruido.
          */}
          {cohort.enrollments.length > 0 && (
            <PageSection
              title={ti('sectionTitle')}
              description={ti('sectionHint')}
              id="invitaciones"
              card
            >
              <BulkInvitations cohortId={cohort.id} />
            </PageSection>
          )}

          <PageSection title={t('listTitle', { count: cohort.enrollments.length })} id="matriculas">
            <DataTable<Enrollment>
              caption={t('tableCaption')}
              rows={cohort.enrollments}
              rowKey={(enrollment) => enrollment.id}
              empty={
                <EmptyState
                  title={t('empty')}
                  description={openForEnrolment ? t('emptyHint') : t('closedForEnrolment')}
                  supportEmail={ctx.institution.supportEmail}
                />
              }
              columns={[
                {
                  key: 'student',
                  header: t('student'),
                  cell: (e) => (
                    <>
                      <Link
                        href={`/personas/${e.personId}`}
                        className="text-text-link underline underline-offset-4"
                      >
                        {e.name}
                      </Link>
                      {e.isMinorAtEnrollment && (
                        <span className="type-caption text-text-muted block">{t('minor')}</span>
                      )}
                      {e.startsAtModule !== null && (
                        <span className="type-caption text-text-muted block">
                          {t('startsAtModule', { position: e.startsAtModule })}
                        </span>
                      )}
                    </>
                  ),
                },
                {
                  key: 'status',
                  header: t('status'),
                  cell: (e) => (
                    <>
                      <StatusBadge domain="enrollment" status={e.status} />
                      {e.withdrawReason && (
                        <span className="type-caption text-text-muted block">
                          {e.withdrawReason}
                        </span>
                      )}
                    </>
                  ),
                },
                {
                  key: 'accessUntil',
                  header: t('accessUntil'),
                  numeric: true,
                  cell: (e) => e.accessUntil,
                },
                {
                  key: 'actions',
                  header: t('actions'),
                  cell: (e) => (
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/cohortes/${cohort.id}/matriculas/${e.id}`}
                        className="text-text-link min-h-touch inline-flex items-center underline underline-offset-4"
                      >
                        {t('detail')}
                      </Link>
                      <EnrollmentActions enrollmentId={e.id} name={e.name} status={e.status} />
                    </div>
                  ),
                },
              ]}
            />
          </PageSection>
        </>
      )}

      {section === 'sesiones' && (
        <PageSection
          title={tc('liveSessionsTitle')}
          description={tc('liveSessionsHint')}
          id="sesiones"
          card
        >
          <LiveSessions cohortId={cohort.id} sessions={liveSessions} />
        </PageSection>
      )}
    </Page>
  );
}

/**
 * «Abierta por X el …» / «Cerrada el …»: la auditoría que importa, en la cabecera (ola 2,
 * 23/9). Nada si la cohorte nunca cambió de estado (sigue planeada).
 */
function transitionLine(
  transition: CohortDetail['lastTransition'],
  tc: Awaited<ReturnType<typeof getTranslations<'cohorts'>>>,
  format: Awaited<ReturnType<typeof getFormatter>>
): string | null {
  if (!transition) return null;
  const date = format.dateTime(new Date(transition.at), { dateStyle: 'medium' });
  return transition.by
    ? tc(`audit.${transition.action}By`, { name: transition.by, date })
    : tc(`audit.${transition.action}At`, { date });
}
