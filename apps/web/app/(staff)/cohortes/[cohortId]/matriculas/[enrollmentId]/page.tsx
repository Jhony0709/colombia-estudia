/**
 * El detalle de una matrícula: progreso, intentos, ajustes; cartera cuando exista (Fase 5).
 * SSOT: reference/01-routing/routes.md (§Cohortes), plan/06-cohortes-y-personas.md:72-77,
 * plan/08 §8.
 *
 * Quién entra: `cohort.manage` (operación) o `accommodation.manage` (inclusión). Lo que ve
 * cada uno es distinto: el progreso lo ven los dos; el formulario de ajustes solo inclusión,
 * y operación ni siquiera sabe si hay ajustes (ajustes-razonables.md: «no segrega»).
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getTranslations, getFormatter } from 'next-intl/server';
import { getRequestContext } from '@/lib/authz/request-context';
import { HOME_AFTER_LOGIN } from '@/lib/authz/routes';
import { getEnrollmentDetail } from '@/features/cohorts/server/enrollment-detail.service';
import {
  getAccommodation,
  listAccommodationHistory,
} from '@/features/inclusion/server/accommodations.service';
import { Page, PageHeader, PageSection } from '@/components/templates/page';
import { Breadcrumb } from '@/components/molecules/breadcrumb';
import { DataTable } from '@/components/molecules/data-table';
import { EmptyState } from '@/components/molecules/empty-state';
import { Badge } from '@/components/atoms/badge';
import { StatusBadge } from '@/components/molecules/status-badge/StatusBadge';
import { ProgressOverride } from './progress-override';
import { AccommodationForm } from './accommodation-form';
import { RevokeCertificate } from './revoke-certificate';
import { listCertificatesForEnrollment } from '@/features/certificates/server/certificates.service';

export const metadata: Metadata = { title: 'Matrícula' };

export default async function EnrollmentDetailPage({
  params,
}: {
  params: Promise<{ cohortId: string; enrollmentId: string }>;
}) {
  const ctx = await getRequestContext();
  const can = (
    c: 'cohort.manage' | 'accommodation.manage' | 'progress.override' | 'institution.manage'
  ) => (ctx.capabilities.get(c)?.length ?? 0) > 0;
  if (!can('cohort.manage') && !can('accommodation.manage')) redirect(HOME_AFTER_LOGIN);

  const { cohortId, enrollmentId } = await params;
  const institutionId = ctx.institution.id;

  const [detail, certificates, t, te, tb, format] = await Promise.all([
    getEnrollmentDetail({ institutionId, cohortId, enrollmentId }),
    listCertificatesForEnrollment({ institutionId, enrollmentId }),
    getTranslations('enrollmentDetail'),
    getTranslations('enrollments'),
    getTranslations('crumbs'),
    getFormatter(),
  ]);
  if (!detail) notFound();

  const inclusion = can('accommodation.manage');
  const [accommodation, history] = inclusion
    ? await Promise.all([
        getAccommodation({ institutionId, enrollmentId }),
        listAccommodationHistory({ institutionId, enrollmentId }),
      ])
    : [null, []];

  // Los valores del historial vienen como texto crudo del `AuditLog`; aquí se dicen en cristiano.
  const human = (v: string) => (v === 'true' ? t('yes') : v === 'false' ? t('no') : v);
  const when = (iso: string) =>
    format.dateTime(new Date(iso), {
      day: 'numeric',
      month: 'short',
      hour: 'numeric',
      minute: '2-digit',
    });

  type Lesson = (typeof detail.lessons)[number];
  type Assessment = (typeof detail.assessments)[number];

  return (
    <Page wide>
      <PageHeader
        overline={`${detail.cohort.code} · ${detail.cohort.programName}`}
        title={detail.student.name}
        description={`${te(`statuses.${detail.status}`)} · ${t('accessUntil', { date: detail.accessUntil })}${
          detail.isMinorAtEnrollment ? ` · ${t('minor')}` : ''
        }${
          detail.startsAtModule !== null
            ? ` · ${t('startsAtModule', { position: detail.startsAtModule })}`
            : ''
        }`}
        back={
          <Breadcrumb
            label={tb('label')}
            items={[
              { label: tb('home'), href: '/ingresar' },
              { label: tb('cohorts'), href: '/cohortes' },
              { label: detail.cohort.code, href: `/cohortes/${detail.cohort.id}` },
              { label: detail.student.name },
            ]}
          />
        }
        action={
          can('cohort.manage') ? (
            <Link
              href={`/personas/${detail.student.id}`}
              className="text-text-link min-h-touch inline-flex items-center underline underline-offset-4"
            >
              {t('personLink')}
            </Link>
          ) : undefined
        }
      />

      {detail.status === 'WITHDRAWN' && detail.withdrawReason && (
        <p className="type-body text-text-muted">
          {t('withdrawn', { reason: detail.withdrawReason })}
        </p>
      )}

      <PageSection
        title={t('progressTitle')}
        description={t('progressHint', {
          completed: detail.progress.completed,
          total: detail.progress.total,
        })}
        id="progreso"
      >
        <DataTable<Lesson>
          caption={t('lessonsCaption')}
          rows={detail.lessons}
          rowKey={(l) => l.assignmentId}
          empty={<EmptyState title={t('noLessons')} description={t('noLessonsHint')} />}
          columns={[
            {
              key: 'title',
              header: t('lesson'),
              cell: (l) => (
                <>
                  {l.title}
                  <span className="type-caption text-text-muted block">{l.moduleName}</span>
                </>
              ),
            },
            {
              key: 'status',
              header: t('status'),
              narrow: true,
              cell: (l) => (
                <>
                  <StatusBadge domain="lesson" status={l.status} />
                  {l.source === 'MANUAL' && (
                    <span className="type-caption text-text-muted block">{t('manual')}</span>
                  )}
                  {l.submissionStatus && (
                    <span className="type-caption text-text-muted block">
                      {t(`submission.${l.submissionStatus}`)}
                    </span>
                  )}
                </>
              ),
            },
            {
              key: 'activity',
              header: t('lastActivity'),
              cell: (l) =>
                l.completedAt
                  ? t('completedOn', { date: when(l.completedAt) })
                  : l.lastActivityAt
                    ? when(l.lastActivityAt)
                    : '—',
            },
            {
              key: 'actions',
              header: <span className="sr-only">{t('actions')}</span>,
              headerLabel: t('actions'),
              cell: (l) =>
                can('progress.override') && l.status !== 'COMPLETED' ? (
                  <ProgressOverride
                    enrollmentId={detail.id}
                    assignmentId={l.assignmentId}
                    title={l.title}
                  />
                ) : null,
            },
          ]}
        />
      </PageSection>

      <PageSection title={t('assessmentsTitle')} id="examenes">
        <DataTable<Assessment>
          caption={t('assessmentsCaption')}
          rows={detail.assessments}
          rowKey={(a) => a.assignmentId}
          empty={<EmptyState title={t('noAssessments')} description={t('noAssessmentsHint')} />}
          columns={[
            {
              key: 'title',
              header: t('assessment'),
              cell: (a) => (
                <>
                  {a.title}
                  <span className="type-caption text-text-muted block">
                    {a.moduleName || t(`kind.${a.kind}`)}
                  </span>
                </>
              ),
            },
            {
              key: 'attempts',
              header: t('attempts'),
              cell: (a) =>
                a.attempts.length === 0 ? (
                  <span className="text-text-muted">
                    {t('noAttempts', { allowed: a.attemptsAllowed })}
                  </span>
                ) : (
                  <ul className="m-0 list-none space-y-1 p-0">
                    {a.attempts.map((x) => (
                      <li key={x.id} className="type-caption">
                        {t('attemptLine', {
                          number: x.number,
                          status: t(`attemptStatus.${x.status}`),
                          score:
                            x.score !== null && x.maxScore !== null
                              ? `${x.score}/${x.maxScore}`
                              : '—',
                          date: x.submittedAt ? when(x.submittedAt) : '—',
                        })}
                      </li>
                    ))}
                  </ul>
                ),
            },
            {
              key: 'best',
              header: t('best'),
              numeric: true,
              cell: (a) => {
                const graded = a.attempts.filter((x) => x.status === 'GRADED' && x.maxScore);
                if (graded.length === 0) return '—';
                const best = Math.max(
                  ...graded.map((x) => ((x.score ?? 0) / (x.maxScore ?? 1)) * 100)
                );
                const percent = Math.round(best * 100) / 100;
                const passed = a.passPercent === null ? true : percent >= a.passPercent;
                return <Badge variant={passed ? 'success' : 'warning'}>{percent} %</Badge>;
              },
            },
          ]}
        />
      </PageSection>

      {inclusion && (
        <PageSection
          title={t('accommodationTitle')}
          description={t('accommodationHint')}
          id="ajustes"
          card
        >
          <AccommodationForm
            enrollmentId={detail.id}
            initial={
              accommodation
                ? {
                    extraTimeFactor: accommodation.extraTimeFactor,
                    exemptFromTimer: accommodation.exemptFromTimer,
                    allowedAttemptsBonus: accommodation.allowedAttemptsBonus,
                    requiresCaptions: accommodation.requiresCaptions,
                    allowsAssistiveTech: accommodation.allowsAssistiveTech,
                    notes: accommodation.notes,
                  }
                : null
            }
          />
          {history.length > 0 && (
            <div className="border-border-muted mt-6 border-t pt-4">
              <h3 className="type-body-emphasis">{t('historyTitle')}</h3>
              <ol className="mt-2 space-y-3">
                {history.map((h) => (
                  <li key={h.id} className="type-caption">
                    <p className="text-text m-0">
                      {t(`historyAction.${h.action}`, {
                        name: h.actorName ?? t('someone'),
                        date: when(h.occurredAt),
                      })}
                    </p>
                    <ul className="text-text-muted m-0 list-disc pl-5">
                      {h.changes.map((c) => (
                        <li key={c.field}>
                          {t(`field.${c.field}`)}: {human(c.before)} → {human(c.after)}
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </PageSection>
      )}

      <PageSection
        title={t('certificates.title')}
        description={t('certificates.hint')}
        id="constancias"
      >
        {certificates.length === 0 ? (
          <p className="type-body text-text-muted">{t('certificates.empty')}</p>
        ) : (
          <ul className="divide-border-muted divide-y">
            {certificates.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div>
                  <p className="type-body-emphasis m-0">
                    {c.kind === 'PROGRAM' ? t('certificates.program') : c.moduleName}
                  </p>
                  <p className="type-caption text-text-muted m-0">
                    {when(c.issuedAt)} · <span className="font-mono">{c.code}</span>
                    {c.revokedAt
                      ? ` · ${t('certificates.revokedOn', { date: when(c.revokedAt) })}`
                      : ''}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Link
                    href={`/certificado/${c.code}`}
                    className="text-text-link min-h-touch inline-flex items-center underline underline-offset-4"
                  >
                    {t('certificates.view')}
                  </Link>
                  {can('institution.manage') && !c.revokedAt && (
                    <RevokeCertificate certificateId={c.id} code={c.code} />
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </PageSection>

      {can('cohort.manage') && (
        <PageSection title={t('billingTitle')} id="cartera">
          <p className="type-body">
            <Link
              href={`/cartera/${detail.id}`}
              className="text-text-link min-h-touch inline-flex items-center underline underline-offset-4"
            >
              {t('billingLink')}
            </Link>
          </p>
        </PageSection>
      )}
    </Page>
  );
}
