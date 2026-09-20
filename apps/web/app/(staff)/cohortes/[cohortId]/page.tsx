/**
 * Cohort detail: enrolments and their cycle.
 * SSOT: routes.md:46, plan/06-cohortes-y-personas.md:72-77.
 *
 * The three tabs the plan describes for the enrolment detail (progreso, ajustes, cartera)
 * belong to phases 4 and 5: there is no progress, no accommodation screen and no payment plan
 * to show yet. What exists today is the cycle: enrol, withdraw, extend.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { getRequestContext } from '@/lib/authz/request-context';
import { requireCapability } from '@/lib/authz/with-capability';
import { getCohortDetail, type CohortDetail } from '@/features/cohorts/server/enrollments.service';
import { countSubmissions } from '@/features/cohorts/server/submissions.service';
import { listLiveSessions } from '@/features/cohorts/server/live-sessions.service';
import { DataTable } from '@/components/molecules/data-table';
import { EmptyState } from '@/components/molecules/empty-state';
import { Page, PageHeader, PageSection } from '@/components/templates/page';
import { Alert } from '@/components/atoms/alert';
import { Badge } from '@/components/atoms/badge';
import { Button } from '@/components/atoms/button';
import { CohortStatusAction } from '../cohort-actions';
import { EnrollForm, EnrollmentActions } from './enrollment-actions';
import { BulkInvitations } from './bulk-invitations';
import { LiveSessions } from './live-sessions';
import { Breadcrumb } from '@/components/molecules/breadcrumb';

export const metadata: Metadata = { title: 'Cohorte' };

type Params = Promise<{ cohortId: string }>;
type Enrollment = CohortDetail['enrollments'][number];

export default async function CohortDetailPage({ params }: { params: Params }) {
  await requireCapability('cohort.manage');
  const ctx = await getRequestContext();
  const { cohortId } = await params;

  const [cohort, submissions, liveSessions, t, tc, ti] = await Promise.all([
    getCohortDetail({ institutionId: ctx.institution.id, cohortId }),
    countSubmissions({ institutionId: ctx.institution.id, cohortId }),
    listLiveSessions({ institutionId: ctx.institution.id, cohortId, includeArchived: true }),
    getTranslations('enrollments'),
    getTranslations('cohorts'),
    getTranslations('bulkInvitations'),
  ]);

  if (!cohort) notFound();

  const openForEnrolment = cohort.status === 'PLANNED' || cohort.status === 'OPEN';

  const tb = await getTranslations('crumbs');

  return (
    <Page>
      <PageHeader
        overline={cohort.programName}
        title={`${cohort.code} — ${cohort.name}`}
        description={`${tc(`statuses.${cohort.status}`)} · ${tc(
          `progression${cohort.progression === 'LINEAR' ? 'Linear' : 'Free'}`
        )} · ${cohort.startsOn} → ${cohort.endsOn}`}
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
            Abrir y cerrar vivían **solo** en la lista de cohortes. Quien entra a la ficha de
            una cohorte a administrarla no encontraba la acción, y una cohorte sin abrir no
            deja entrar a nadie. Desde el 19/9 es LA acción de la cabecera; importar va al lado
            como secundaria.
          */
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="secondary">
              <Link href={`/cohortes/${cohort.id}/avance`}>{tc('progress')}</Link>
            </Button>
            {/* La cola de entregas (19/9): con pendientes, el número va en el botón. */}
            <Button asChild variant="secondary">
              <Link href={`/cohortes/${cohort.id}/entregas`}>
                {submissions.SUBMITTED > 0
                  ? tc('submissionsPending', { count: submissions.SUBMITTED })
                  : tc('submissions')}
              </Link>
            </Button>
            {openForEnrolment && (
              <Button asChild variant="secondary">
                <Link href={`/cohortes/${cohort.id}/importar`}>{t('importCsv')}</Link>
              </Button>
            )}
            <CohortStatusAction
              cohortId={cohort.id}
              status={cohort.status}
              code={cohort.code}
              prominent
            />
          </div>
        }
      />

      {cohort.status === 'PLANNED' && <Alert severity="warning">{tc('plannedNotice')}</Alert>}
      {cohort.status === 'OPEN' && <Alert severity="success">{tc('openNotice')}</Alert>}

      <PageSection title={t('enrolTitle')} description={t('enrolHint')} id="matricular" card>
        <EnrollForm cohortId={cohort.id} disabled={!openForEnrolment} />
      </PageSection>

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

      {/* Sesiones en vivo (plan/08 §5, 19/9): el estudiante las ve en su calendario. */}
      <PageSection
        title={tc('liveSessionsTitle')}
        description={tc('liveSessionsHint')}
        id="sesiones"
        card
      >
        <LiveSessions cohortId={cohort.id} sessions={liveSessions} />
      </PageSection>

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
                </>
              ),
            },
            {
              key: 'status',
              header: t('status'),
              cell: (e) => (
                <>
                  <Badge
                    variant={
                      e.status === 'ACTIVE'
                        ? 'success'
                        : e.status === 'COMPLETED'
                          ? 'info'
                          : 'neutral'
                    }
                  >
                    {t(`statuses.${e.status}`)}
                  </Badge>
                  {e.withdrawReason && (
                    <span className="type-caption text-text-muted block">{e.withdrawReason}</span>
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
    </Page>
  );
}
