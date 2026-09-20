/**
 * La cola de entregas de una cohorte.
 * SSOT: reference/01-routing/routes.md (§staff), plan/08-aprender-y-evaluar.md:72-76.
 *
 * Una lista y, al lado, la entrega abierta (`?entrega=<id>`): se lee el texto, se descarga
 * el archivo con URL firmada y se decide. Todo llega del servidor en la misma petición;
 * decidir refresca la ruta. No hay endpoint de detalle: la página **es** el detalle, y así el
 * enlace a una entrega concreta se puede mandar por la notificación (`submission_received`).
 *
 * Por defecto se enseñan las pendientes (`estado=SUBMITTED`): es lo que hay que atender.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTranslations, getFormatter } from 'next-intl/server';
import { Inbox, RotateCcw, CircleCheck, FileText, Eye, Info } from 'lucide-react';
import { getRequestContext } from '@/lib/authz/request-context';
import { requireCapability } from '@/lib/authz/with-capability';
import {
  SUBMISSION_STATUSES,
  countSubmissions,
  getSubmission,
  getSubmissionsCohortHeader,
  listSubmissionLessons,
  listSubmissions,
  type SubmissionRow,
  type SubmissionStatusFilter,
} from '@/features/cohorts/server/submissions.service';
import { Page, PageHeader } from '@/components/templates/page';
import { Breadcrumb } from '@/components/molecules/breadcrumb';
import { DataTable } from '@/components/molecules/data-table';
import { EmptyState } from '@/components/molecules/empty-state';
import { FilterChips, type FilterChip } from '@/components/molecules/filter-chips';
import { StatCard, StatGrid } from '@/components/molecules/stat-card';
import { WithRail, RailCard } from '@/components/molecules/rail';
import { FormField, FormSelect } from '@/components/atoms/form-field';
import { Button } from '@/components/atoms/button';
import { Badge, type BadgeVariant } from '@/components/atoms/badge';
import { ReviewActions } from './review-actions';

export const metadata: Metadata = { title: 'Entregas' };

type Params = Promise<{ cohortId: string }>;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

interface Filters {
  status: SubmissionStatusFilter | null;
  lessonId: string | null;
  open: string | null;
}

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? '';

function parseFilters(sp: Record<string, string | string[] | undefined>): Filters {
  const estado = first(sp.estado);
  return {
    // Sin parámetro: pendientes. `estado=` vacío explícito: todas.
    status:
      'estado' in sp
        ? (SUBMISSION_STATUSES as readonly string[]).includes(estado)
          ? (estado as SubmissionStatusFilter)
          : null
        : 'SUBMITTED',
    lessonId: first(sp.tema) || null,
    open: first(sp.entrega) || null,
  };
}

function hrefFor(cohortId: string, f: Partial<Filters>): string {
  const search = new URLSearchParams();
  search.set('estado', f.status ?? '');
  if (f.lessonId) search.set('tema', f.lessonId);
  if (f.open) search.set('entrega', f.open);
  return `/cohortes/${cohortId}/entregas?${search.toString()}`;
}

const BADGE: Record<SubmissionStatusFilter, BadgeVariant> = {
  SUBMITTED: 'info',
  RETURNED: 'warning',
  APPROVED: 'success',
};

export default async function SubmissionsPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  await requireCapability('assessment.grade');
  const ctx = await getRequestContext();
  const { cohortId } = await params;
  const filters = parseFilters(await searchParams);
  const institutionId = ctx.institution.id;

  const [cohort, counts, lessons, rows, open, t, tb, format] = await Promise.all([
    getSubmissionsCohortHeader({ institutionId, cohortId }),
    countSubmissions({ institutionId, cohortId }),
    listSubmissionLessons({ institutionId, cohortId }),
    listSubmissions({
      institutionId,
      cohortId,
      status: filters.status,
      lessonId: filters.lessonId,
    }),
    filters.open ? getSubmission({ institutionId, cohortId, submissionId: filters.open }) : null,
    getTranslations('submissions'),
    getTranslations('crumbs'),
    getFormatter(),
  ]);

  if (!cohort) notFound();

  const when = (d: Date) =>
    format.dateTime(d, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
  const lessonTitle = (id: string) => lessons.find((l) => l.id === id)?.title ?? id;

  const chips: FilterChip[] = [];
  if (filters.status)
    chips.push({
      key: 'estado',
      label: t(`statuses.${filters.status}`),
      removeHref: hrefFor(cohortId, { ...filters, status: null }),
    });
  if (filters.lessonId)
    chips.push({
      key: 'tema',
      label: lessonTitle(filters.lessonId),
      removeHref: hrefFor(cohortId, { ...filters, lessonId: null }),
    });

  return (
    <Page wide>
      <PageHeader
        overline={`${cohort.code} · ${cohort.programName}`}
        title={t('title')}
        description={t('description')}
        back={
          <Breadcrumb
            label={tb('label')}
            items={[
              { label: tb('home'), href: '/ingresar' },
              { label: tb('cohorts'), href: '/cohortes' },
              { label: cohort.code, href: `/cohortes/${cohort.id}` },
              { label: t('crumb') },
            ]}
          />
        }
      />

      <section aria-label={t('statsLabel')}>
        <StatGrid>
          <StatCard
            label={t('statuses.SUBMITTED')}
            value={counts.SUBMITTED}
            icon={Inbox}
            tone={counts.SUBMITTED > 0 ? 'warning' : 'info'}
            href={hrefFor(cohortId, { status: 'SUBMITTED' })}
          />
          <StatCard
            label={t('statuses.RETURNED')}
            value={counts.RETURNED}
            icon={RotateCcw}
            href={hrefFor(cohortId, { status: 'RETURNED' })}
          />
          <StatCard
            label={t('statuses.APPROVED')}
            value={counts.APPROVED}
            icon={CircleCheck}
            tone="success"
            href={hrefFor(cohortId, { status: 'APPROVED' })}
          />
        </StatGrid>
      </section>

      <WithRail
        railLabel={t('rail.label')}
        rail={
          open ? (
            <RailCard id="entrega-abierta" title={t('rail.openTitle')} icon={Eye} tone="info">
              <div className="space-y-3">
                <div>
                  <p className="type-label">{open.studentName}</p>
                  <p className="type-caption text-text-muted">
                    {open.moduleName} · {open.lessonTitle}
                  </p>
                  <p className="type-caption text-text-muted">
                    {t('sentOn', { date: when(open.submittedAt) })}
                    {open.reviewedAt && open.reviewerName
                      ? ` · ${t('reviewedBy', { name: open.reviewerName, date: when(open.reviewedAt) })}`
                      : ''}
                  </p>
                  <div className="mt-1">
                    <Badge variant={BADGE[open.status]}>{t(`statuses.${open.status}`)}</Badge>
                  </div>
                </div>

                {open.text && (
                  <div>
                    <p className="type-caption text-text-muted">{t('textLabel')}</p>
                    <p className="type-body max-h-80 overflow-y-auto whitespace-pre-wrap">
                      {open.text}
                    </p>
                  </div>
                )}

                {open.file && (
                  <a
                    href={open.file.url}
                    download
                    className="text-text-link min-h-touch inline-flex items-center gap-1.5 underline underline-offset-4"
                  >
                    <FileText className="size-4" aria-hidden="true" />
                    {t('downloadFile', { name: open.file.name })}
                  </a>
                )}

                {open.feedback && (
                  <blockquote className="border-border border-l-2 pl-3">
                    <p className="type-caption text-text-muted">{t('previousFeedback')}</p>
                    <p className="type-body whitespace-pre-wrap">{open.feedback}</p>
                  </blockquote>
                )}

                <ReviewActions
                  cohortId={cohort.id}
                  submissionId={open.id}
                  status={open.status}
                  studentName={open.studentName}
                />
              </div>
            </RailCard>
          ) : (
            <RailCard id="entregas-como" title={t('rail.howTitle')} icon={Info}>
              <p className="type-body text-text-muted">{t('rail.howBody')}</p>
            </RailCard>
          )
        }
      >
        <form
          method="get"
          role="search"
          className="bg-surface-base border-border-muted rounded-card elevation-resting space-y-4 border p-5"
        >
          <div className="flex flex-wrap items-end gap-3">
            <div className="w-48">
              <FormField label={t('status')} name="estado">
                <FormSelect name="estado" defaultValue={filters.status ?? ''}>
                  <option value="">{t('anyStatus')}</option>
                  {SUBMISSION_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {t(`statuses.${s}`)}
                    </option>
                  ))}
                </FormSelect>
              </FormField>
            </div>
            <div className="min-w-56 flex-1">
              <FormField label={t('lesson')} name="tema">
                <FormSelect name="tema" defaultValue={filters.lessonId ?? ''}>
                  <option value="">{t('anyLesson')}</option>
                  {lessons.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.title}
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
            clearHref={hrefFor(cohortId, { status: null })}
            clearLabel={t('clearFilters')}
            removeLabel={(label) => t('removeFilter', { label })}
          />
        </form>

        <p className="type-caption text-text-muted m-0" role="status">
          {t('resultCount', { count: rows.length })}
        </p>

        <DataTable<SubmissionRow>
          caption={t('tableCaption')}
          rows={rows}
          rowKey={(r) => r.id}
          empty={
            <EmptyState
              title={filters.status === 'SUBMITTED' ? t('emptyPending') : t('empty')}
              description={lessons.length === 0 ? t('emptyNoLessons') : t('emptyHint')}
              supportEmail={ctx.institution.supportEmail}
            />
          }
          columns={[
            {
              key: 'student',
              header: t('student'),
              cell: (r) => (
                <>
                  <Link
                    href={hrefFor(cohortId, { ...filters, open: r.id })}
                    aria-current={open?.id === r.id ? 'true' : undefined}
                    className="text-text-link underline underline-offset-4"
                  >
                    {r.studentName}
                  </Link>
                  <span className="type-caption text-text-muted block">
                    {r.hasText && r.hasFile
                      ? t('withTextAndFile')
                      : r.hasFile
                        ? t('withFile')
                        : t('withText')}
                  </span>
                </>
              ),
            },
            {
              key: 'lesson',
              header: t('lesson'),
              cell: (r) => (
                <>
                  {r.lessonTitle}
                  <span className="type-caption text-text-muted block">{r.moduleName}</span>
                </>
              ),
            },
            {
              key: 'status',
              header: t('status'),
              narrow: true,
              cell: (r) => <Badge variant={BADGE[r.status]}>{t(`statuses.${r.status}`)}</Badge>,
            },
            {
              key: 'submittedAt',
              header: t('submittedAt'),
              cell: (r) => (
                <>
                  {when(r.submittedAt)}
                  {r.reviewedAt && r.reviewerName && (
                    <span className="type-caption text-text-muted block">
                      {t('reviewedBy', { name: r.reviewerName, date: when(r.reviewedAt) })}
                    </span>
                  )}
                </>
              ),
            },
            {
              key: 'actions',
              header: <span className="sr-only">{t('actions')}</span>,
              headerLabel: t('actions'),
              narrow: true,
              cell: (r) => (
                <Button asChild variant={r.status === 'SUBMITTED' ? 'primary' : 'quiet'}>
                  <Link href={hrefFor(cohortId, { ...filters, open: r.id })}>
                    {r.status === 'SUBMITTED' ? t('reviewAction') : t('viewAction')}
                  </Link>
                </Button>
              ),
            },
          ]}
        />
      </WithRail>
    </Page>
  );
}
