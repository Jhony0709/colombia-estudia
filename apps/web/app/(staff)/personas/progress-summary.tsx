/**
 * El avance de una matrícula en pocas líneas (1/11): la columna de `/personas`, la ficha de la
 * persona y la tabla de registros. Las cifras las calcula `progressByEnrollment`.
 */

import { getFormatter, getTranslations } from 'next-intl/server';
import type { EnrollmentProgress } from '@/features/cohorts/server/progress.service';
import { Badge } from '@/components/atoms/badge';
import { ProgressBar } from '@/components/atoms/progress-bar';

export async function ProgressSummary({
  progress,
  detail = false,
}: {
  progress: EnrollmentProgress;
  /** En la ficha: cuestionarios y lo marcado a mano. */
  detail?: boolean;
}) {
  const [t, format] = await Promise.all([getTranslations('people.progress'), getFormatter()]);
  const m = progress.currentModule;
  return (
    <span className="block min-w-40 space-y-1">
      <span className="type-caption text-text line-clamp-1 block">
        {m === null
          ? t('noLessons')
          : m.done
            ? t('done', { total: m.total })
            : t('module', { index: m.index, total: m.total, name: m.name })}
      </span>
      <ProgressBar
        percent={progress.percent}
        label={t('label', { program: progress.programName })}
        className="block max-w-48"
      />
      <span className="type-caption text-text-muted flex flex-wrap items-center gap-x-2 gap-y-1">
        <span>{t('percent', { percent: progress.percent })}</span>
        <span>
          {progress.lastActivityAt
            ? t('lastActivity', {
                date: format.dateTime(new Date(progress.lastActivityAt), { dateStyle: 'medium' }),
              })
            : t('noActivity')}
        </span>
        {progress.atRisk && (
          <Badge variant="warning">
            {t('atRisk')}
            <span className="sr-only">: {t('atRiskHint')}</span>
          </Badge>
        )}
      </span>
      {detail && (
        <span className="type-caption text-text-muted block">
          {t('assessments', {
            passed: progress.assessmentsPassed,
            taken: progress.assessmentsTaken,
          })}
          {progress.manualCompleted > 0 && (
            <> · {t('manual', { count: progress.manualCompleted })}</>
          )}
        </span>
      )}
    </span>
  );
}
