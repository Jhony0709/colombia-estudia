'use client';

/**
 * Qué componentes abre cada cuota al quedar pagada (20/11).
 * SSOT: reference/04-business-logic/acceso-y-cartera.md §3.
 */

import { useTranslations } from 'next-intl';
import { SegmentedControl } from '@/components/molecules/segmented-control';
import { cn } from '@/lib/utils';

export interface PlanStage {
  id: string;
  name: string;
  position: number;
}

export type StagePreset = 'none' | 'each' | 'first' | 'custom';

/** Por componente, la cuota que lo abre (1…n); sin entrada, ninguna. */
export type StageMap = Record<string, number>;

export function presetMap(preset: StagePreset, stages: PlanStage[], count: number): StageMap {
  if (preset === 'first') return Object.fromEntries(stages.map((stage) => [stage.id, 1]));
  if (preset === 'each') {
    return Object.fromEntries(stages.slice(0, count).map((stage, index) => [stage.id, index + 1]));
  }
  return {};
}

/** La forma de `POST /api/billing/plans`: una lista de componentes por cuota. */
export function toUnlocks(map: StageMap, stages: PlanStage[], count: number): string[][] {
  return Array.from({ length: count }, (_, index) =>
    stages.filter((stage) => map[stage.id] === index + 1).map((stage) => stage.id)
  );
}

export function StageMatrix({
  stages,
  count,
  preset,
  map,
  onPreset,
  onToggle,
}: {
  stages: PlanStage[];
  count: number;
  preset: StagePreset;
  map: StageMap;
  onPreset: (preset: StagePreset) => void;
  onToggle: (stageId: string, installment: number) => void;
}) {
  const t = useTranslations('billing.plan.stages');
  const installments = Array.from({ length: count }, (_, index) => index + 1);

  return (
    <fieldset className="m-0 space-y-3 border-0 p-0">
      <legend className="type-body-emphasis p-0">{t('title')}</legend>
      <p className="type-caption text-text-muted m-0">{t('hint')}</p>
      <SegmentedControl
        label={t('presetLabel')}
        value={preset}
        onChange={onPreset}
        options={[
          { value: 'none', label: t('preset.none') },
          { value: 'each', label: t('preset.each') },
          { value: 'first', label: t('preset.first') },
          { value: 'custom', label: t('preset.custom') },
        ]}
      />
      {preset === 'none' ? (
        <p className="type-caption text-text-muted m-0">{t('noneNote')}</p>
      ) : (
        <ul className="m-0 list-none space-y-2 p-0">
          {installments.map((installment) => {
            const mine = stages.filter((stage) => map[stage.id] === installment);
            return (
              <li key={installment} className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <span className="type-body-emphasis w-20 shrink-0">
                  {t('installment', { position: installment })}
                </span>
                <span
                  role="group"
                  aria-label={t('rowLabel', { position: installment })}
                  className="flex flex-wrap gap-1"
                >
                  {stages.map((stage) => {
                    const pressed = map[stage.id] === installment;
                    return (
                      <button
                        key={stage.id}
                        type="button"
                        aria-pressed={pressed}
                        aria-label={t('stage', { position: stage.position, name: stage.name })}
                        onClick={() => onToggle(stage.id, installment)}
                        className={cn(
                          'rounded-control min-h-touch min-w-touch type-caption border',
                          'duration-fast ease-standard transition-colors',
                          pressed
                            ? 'bg-accent-base text-text-on-accent border-transparent'
                            : 'bg-surface-base text-text-muted border-border-muted hover:text-text'
                        )}
                      >
                        {stage.position}
                      </button>
                    );
                  })}
                </span>
                <span className="type-caption text-text-muted">
                  {mine.length > 0
                    ? t('opens', { names: mine.map((stage) => stage.name).join(', ') })
                    : t('opensNone')}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </fieldset>
  );
}
