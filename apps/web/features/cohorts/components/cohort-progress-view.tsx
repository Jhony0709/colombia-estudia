/**
 * El avance de una cohorte en pantalla: métricas arriba, tabla por estudiante debajo.
 * Lo comparten `/cohortes/[id]/avance` (staff) y `/aliado` (contacto del aliado): los
 * mismos números, y la única diferencia es qué enlaces hay (el aliado no navega a personas).
 * SSOT: reportes.md, plan/08 §7.
 *
 * Server Component sin estado: recibe el resultado de `getCohortProgress` ya calculado.
 */

import Link from 'next/link';
import { getTranslations, getFormatter } from 'next-intl/server';
import { Users, Activity, TriangleAlert, ClipboardCheck } from 'lucide-react';
import { StatCard, StatGrid } from '@/components/molecules/stat-card';
import { DataTable } from '@/components/molecules/data-table';
import { EmptyState } from '@/components/molecules/empty-state';
import { Badge } from '@/components/atoms/badge';
import type { CohortProgress, CohortProgressRow } from '../server/progress.service';

export async function CohortProgressView({
  progress,
  personLinks,
  exportHref,
}: {
  progress: CohortProgress;
  /** Enlazar cada fila a `/cohortes/[id]/matriculas/[e]`: solo staff. */
  personLinks: boolean;
  exportHref: string;
}) {
  const t = await getTranslations('cohortProgress');
  const format = await getFormatter();
  const pct = (fraction: number) =>
    format.number(fraction, { style: 'percent', maximumFractionDigits: 0 });
  const when = (iso: string) =>
    format.dateTime(new Date(iso), {
      day: 'numeric',
      month: 'short',
      hour: 'numeric',
      minute: '2-digit',
    });
  const m = progress.metrics;

  return (
    <div className="space-y-6">
      <section aria-label={t('statsLabel')}>
        <StatGrid>
          <StatCard label={t('active')} value={m.active} icon={Users} />
          <StatCard
            label={t('evidenceAverage')}
            value={Math.round(m.evidenceAverage * 100)}
            icon={Activity}
            tone="success"
          />
          <StatCard
            label={t('atRisk')}
            value={m.atRisk}
            icon={TriangleAlert}
            tone={m.atRisk > 0 ? 'warning' : 'info'}
          />
          <StatCard
            label={t('assessmentsPassed')}
            value={m.assessmentsPassed}
            icon={ClipboardCheck}
          />
        </StatGrid>
        <p className="type-caption text-text-muted mt-3">
          {t('summary', {
            completion: pct(m.completionRate),
            manual: pct(m.manualAverage),
            taken: m.assessmentsTaken,
            median: m.medianDaysToComplete === null ? '—' : String(m.medianDaysToComplete),
          })}
        </p>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="type-caption text-text-muted m-0" role="status">
          {t('rowCount', { count: progress.rows.length })}
        </p>
        <a
          href={exportHref}
          className="text-text-link min-h-touch inline-flex items-center underline underline-offset-4"
          download
        >
          {t('exportCsv')}
        </a>
      </div>

      <DataTable<CohortProgressRow>
        caption={t('tableCaption')}
        rows={progress.rows}
        rowKey={(r) => r.enrollmentId}
        empty={<EmptyState title={t('empty')} description={t('emptyHint')} />}
        columns={[
          {
            key: 'name',
            header: t('student'),
            cell: (r) =>
              personLinks ? (
                <Link
                  href={`/cohortes/${progress.cohort.id}/matriculas/${r.enrollmentId}`}
                  className="text-text-link underline underline-offset-4"
                >
                  {r.name}
                </Link>
              ) : (
                r.name
              ),
          },
          {
            key: 'status',
            header: t('status'),
            narrow: true,
            cell: (r) => (
              <Badge
                variant={
                  r.status === 'ACTIVE' ? 'success' : r.status === 'COMPLETED' ? 'info' : 'neutral'
                }
              >
                {t(`enrollmentStatus.${r.status}`)}
              </Badge>
            ),
          },
          {
            key: 'evidence',
            header: t('evidence'),
            numeric: true,
            cell: (r) => (
              <>
                {r.evidenceCompleted}/{r.assigned}
                {r.manualCompleted > 0 && (
                  <span className="type-caption text-text-muted block">
                    {t('manualNote', { count: r.manualCompleted })}
                  </span>
                )}
              </>
            ),
          },
          {
            key: 'assessments',
            header: t('assessments'),
            numeric: true,
            cell: (r) => `${r.assessmentsPassed}/${r.assessmentsTaken}`,
          },
          {
            key: 'activity',
            header: t('lastActivity'),
            cell: (r) => (
              <>
                {r.lastActivityAt ? when(r.lastActivityAt) : t('never')}
                {r.atRisk && (
                  <span className="text-status-warning-base type-caption block">
                    {t('atRiskLabel')}
                  </span>
                )}
              </>
            ),
          },
        ]}
      />
    </div>
  );
}
