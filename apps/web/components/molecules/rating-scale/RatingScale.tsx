'use client';

/** Medidor de 1 a 5 (11/10): botones con `aria-pressed`, llenos hasta el elegido. */

import { useState } from 'react';
import { cn } from '@/lib/utils';

export const RATING_VALUES = [1, 2, 3, 4, 5] as const;

export interface RatingScaleProps {
  /** El nombre del grupo: la pregunta. */
  label: string;
  value: number | null;
  /** La palabra de cada valor, de 1 a 5. */
  words: readonly [string, string, string, string, string];
  /** Las puntas, bajo el primero y el último. */
  low: string;
  high: string;
  /** «{value} de 5, {word}» para el lector. */
  valueLabel: (value: number, word: string) => string;
  onSelect: (value: number) => void;
  className?: string;
}

export function RatingScale({
  label,
  value,
  words,
  low,
  high,
  valueLabel,
  onSelect,
  className,
}: RatingScaleProps) {
  // Lo que se ve lleno: el elegido, o el que está bajo el ratón (solo vista previa).
  const [hovered, setHovered] = useState<number | null>(null);
  const shown = hovered ?? value;

  return (
    <div className={cn('w-full max-w-[26rem] space-y-2', className)}>
      <div
        role="group"
        aria-label={label}
        className="grid grid-cols-5 gap-2"
        onPointerLeave={() => setHovered(null)}
      >
        {RATING_VALUES.map((n) => {
          const pressed = value === n;
          const filled = shown !== null && n <= shown;
          return (
            <button
              key={n}
              type="button"
              aria-pressed={pressed}
              aria-label={valueLabel(n, words[n - 1] ?? '')}
              onClick={() => onSelect(n)}
              onPointerEnter={(event) => {
                if (event.pointerType === 'mouse') setHovered(n);
              }}
              className={cn(
                'rounded-control type-subheading min-h-touch flex h-14 items-center justify-center border-2 tabular-nums',
                'duration-fast ease-standard transition-[background-color,border-color,color,transform] active:scale-95',
                pressed
                  ? 'bg-accent-base border-accent-base text-text-on-accent'
                  : filled
                    ? 'bg-status-info-muted border-accent-base text-text'
                    : 'bg-surface-base border-border text-text hover:border-accent-base'
              )}
            >
              {n}
            </button>
          );
        })}
      </div>
      <div className="type-caption text-text-muted flex items-start justify-between gap-4">
        <span>{low}</span>
        <span className="text-right">{high}</span>
      </div>
      {/* La palabra del valor, a la vista; el lector ya la oye en el botón. */}
      <p aria-hidden="true" className="type-body-emphasis text-text m-0 min-h-6 text-center">
        {shown !== null ? words[shown - 1] : ''}
      </p>
    </div>
  );
}
