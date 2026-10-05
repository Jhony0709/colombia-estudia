/**
 * Una tira de días (4/10): un cuadrado por día, lleno si hubo actividad. Micro-gráfico de la
 * cifra «Días activos»; el número y el texto van al lado, así que la tira es decorativa para el
 * lector de pantalla (`aria-hidden`). Hoy lleva un aro para situarse sin depender del color.
 */

import { cn } from '@/lib/utils';

const CELL = 10;
const GAP = 3;

export function DayStrip({
  days,
  className,
}: {
  days: Array<{ date: string; active: boolean }>;
  className?: string;
}) {
  const width = days.length * CELL + (days.length - 1) * GAP;
  return (
    <svg
      aria-hidden="true"
      viewBox={`-1 -1 ${width + 2} ${CELL + 2}`}
      className={cn('h-3 w-auto max-w-full', className)}
    >
      {days.map((day, index) => {
        const today = index === days.length - 1;
        return (
          <rect
            key={day.date}
            x={index * (CELL + GAP)}
            y={0}
            width={CELL}
            height={CELL}
            rx={2.5}
            className={cn(
              day.active ? 'fill-accent-base' : 'fill-surface-sunken',
              today && 'stroke-text'
            )}
            strokeWidth={today ? 1.5 : undefined}
          />
        );
      })}
    </svg>
  );
}
