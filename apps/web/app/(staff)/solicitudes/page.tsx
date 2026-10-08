/**
 * `/solicitudes` — lo que piden los estudiantes desde `/aprender` (6/10): inscribirse en un
 * curso de pago o que les habiliten el siguiente componente. SSOT: reference/01-routing/routes.md.
 *
 * Una fila, una decisión, sin salir: quién, qué, desde cuándo y lo que hace falta para decidir
 * (cartera de la matrícula, menor sin acudiente). «Matricular» abre la hoja de la cohorte ya
 * con la persona y el punto de entrada; «Habilitar» es el mismo clic que en la ficha. Hacerlo
 * cierra la solicitud desde donde sea; «Descartar» es lo único que se hace aquí a mano.
 */

import type { Metadata } from 'next';
import type { Route } from 'next';
import Link from 'next/link';
import { getFormatter, getTranslations } from 'next-intl/server';
import { Inbox } from 'lucide-react';
import { requireCapability } from '@/lib/authz/with-capability';
import { getRequestContext } from '@/lib/authz/request-context';
import {
  countPendingRequests,
  listRequests,
  type StaffRequestRow,
} from '@/features/requests/server/requests.service';
import { Page, PageHeader } from '@/components/templates/page';
import { Breadcrumb } from '@/components/molecules/breadcrumb';
import { SectionNav } from '@/components/molecules/section-nav';
import { DataTable } from '@/components/molecules/data-table';
import { EmptyState } from '@/components/molecules/empty-state';
import { Badge } from '@/components/atoms/badge';
import { EnrollSheet } from '../cohortes/[cohortId]/enrollment-actions';
import { DismissAction, UnlockAction } from './request-actions';

export const metadata: Metadata = { title: 'Solicitudes' };

export default async function RequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ seccion?: string | string[] }>;
}) {
  await requireCapability('cohort.manage');
  const ctx = await getRequestContext();
  const institutionId = ctx.institution.id;
  const { seccion } = await searchParams;
  const closed = seccion === 'cerradas';
  const now = new Date();

  const [rows, pending, t, format] = await Promise.all([
    listRequests({ institutionId, status: closed ? 'CLOSED' : 'PENDING', now }),
    countPendingRequests(institutionId),
    getTranslations('requests'),
    getFormatter(),
  ]);

  const when = (iso: string) => (
    <time
      dateTime={iso}
      title={format.dateTime(new Date(iso), { dateStyle: 'long', timeStyle: 'short' })}
    >
      {format.relativeTime(new Date(iso), now)}
    </time>
  );

  const what = (row: StaffRequestRow) =>
    row.kind === 'ENROLL' ? (
      <>
        <span className="type-body-emphasis text-text block">
          {t('kind.ENROLL', { program: row.cohort.programName })}
        </span>
        <span className="type-caption text-text-muted block">
          {t('kind.ENROLLContext', { cohort: row.cohort.code, module: row.module.name })}
        </span>
      </>
    ) : (
      <>
        <span className="type-body-emphasis text-text block">
          {t('kind.UNLOCK', { module: row.module.name })}
        </span>
        <span className="type-caption text-text-muted block">
          {t('kind.UNLOCKContext', { program: row.cohort.programName, cohort: row.cohort.code })}
        </span>
      </>
    );

  // Lo que hace falta saber para decidir, sin abrir otra pantalla.
  const context = (row: StaffRequestRow) => {
    if (row.kind === 'ENROLL') {
      if (row.person.isMinor && !row.person.hasGuardian) {
        return <Badge variant="warning">{t('context.minorNoGuardian')}</Badge>;
      }
      return <span className="type-caption text-text-muted">{t('context.noEnrollment')}</span>;
    }
    if (!row.billing)
      return <span className="type-caption text-text-muted">{t('context.noPlan')}</span>;
    if (row.billing.overdue === 0) return <Badge variant="success">{t('context.upToDate')}</Badge>;
    return (
      <Link
        href={`/cartera/${row.enrollmentId}` as Route}
        className="text-text-link type-caption underline underline-offset-4"
      >
        {t('context.overdue', { count: row.billing.overdue })}
      </Link>
    );
  };

  const actions = (row: StaffRequestRow) => {
    const label = `${row.person.name}: ${row.kind === 'ENROLL' ? row.cohort.programName : row.module.name}`;
    const first = row.cohort.modules[0];
    // Por dónde entra: la hoja usa la posición sin grados y el grado con grados.
    const graded = row.cohort.modules.some((m) => m.grade !== null);
    const entry =
      row.module.id === first?.id
        ? ''
        : graded
          ? String(row.module.grade ?? '')
          : String(row.module.position);
    return (
      <div className="flex flex-wrap items-start gap-2">
        {row.kind === 'ENROLL' ? (
          row.cohort.open && row.person.handle ? (
            <EnrollSheet
              cohortId={row.cohort.id}
              disabled={false}
              modules={row.cohort.modules}
              initialHandle={row.person.handle}
              initialStartsAt={entry}
              triggerLabel={t('actions.enroll')}
              prominent
            />
          ) : (
            <span className="type-caption text-text-muted">{t('actions.cohortClosed')}</span>
          )
        ) : (
          row.enrollmentId && (
            <>
              <UnlockAction
                enrollmentId={row.enrollmentId}
                moduleId={row.module.id}
                moduleName={row.module.name}
              />
              <Link
                href={
                  `/cohortes/${row.cohort.id}/matriculas/${row.enrollmentId}#componentes` as Route
                }
                className="text-text-link min-h-touch type-label inline-flex items-center underline underline-offset-4"
              >
                {t('actions.withDates')}
              </Link>
            </>
          )
        )}
        <DismissAction requestId={row.id} label={label} />
      </div>
    );
  };

  const outcome = (row: StaffRequestRow) => (
    <span className="type-caption text-text-muted">
      {t(`status.${row.status}`, { name: row.resolvedByName ?? t('status.someone') })}
      {row.resolvedAt && <> · {when(row.resolvedAt)}</>}
    </span>
  );

  return (
    <Page wide>
      <PageHeader
        back={<Breadcrumb items={[{ label: t('home'), href: '/inicio' }, { label: t('title') }]} />}
        overline={t('overline')}
        title={t('title')}
        description={t('description')}
      />
      <SectionNav
        label={t('tabs.label')}
        items={[
          { href: '/solicitudes', label: t('tabs.open'), count: pending },
          { href: '/solicitudes?seccion=cerradas' as Route, label: t('tabs.closed') },
        ]}
      />
      <DataTable
        caption={closed ? t('captionClosed') : t('caption')}
        rows={rows}
        rowKey={(row) => row.id}
        align="top"
        empty={
          <EmptyState
            icon={Inbox}
            title={closed ? t('emptyClosed') : t('empty')}
            description={closed ? undefined : t('emptyHint')}
          />
        }
        columns={[
          {
            key: 'person',
            header: t('columns.person'),
            cell: (row) => (
              <Link
                href={`/personas/${row.person.code}` as Route}
                className="text-text-link type-body-emphasis underline underline-offset-4"
              >
                {row.person.name}
              </Link>
            ),
          },
          { key: 'what', header: t('columns.what'), cell: what },
          {
            key: 'when',
            header: t('columns.when'),
            cell: (row) => when(row.createdAt),
            hideBelow: 'md',
          },
          closed
            ? { key: 'outcome', header: t('columns.outcome'), cell: outcome }
            : { key: 'context', header: t('columns.context'), cell: context, hideBelow: 'lg' },
          ...(closed ? [] : [{ key: 'actions', header: t('columns.actions'), cell: actions }]),
        ]}
      />
    </Page>
  );
}
