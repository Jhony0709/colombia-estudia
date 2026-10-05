'use client';

/**
 * Columnas por día (4/10, «Tu ritmo» de `/aprender`). Cliente solo por el tooltip: al pasar el
 * puntero o al llegar con el teclado (una sola parada de tabulador y flechas, foco itinerante),
 * el día dice su cifra. Todo lo demás llega hecho del servidor, fechas incluidas (F4).
 *
 * Forma y marcas según la skill de dataviz: una serie, sin leyenda (el título la nombra);
 * columnas de 24 px con el extremo de datos redondeado y la base recta, creciendo desde la base
 * (`chart-grow-y`, `duration.normal`; corte con movimiento reducido); la cifra directa solo en
 * el máximo. Sin `style`: la geometría son atributos del SVG (CSP). En el teléfono, la semana
 * actual; desde `sm`, las dos.
 */

import { useRef, useState, type KeyboardEvent } from 'react';
import { cn } from '@/lib/utils';

export interface ActivityDay {
  date: string;
  steps: number;
  /** Inicial del día («L»). */
  short: string;
  /** Lo que dice el tooltip y oye el lector: «2 pasos · lunes 28 de septiembre». */
  description: string;
  today: boolean;
}

const HEIGHT = 96;
const WIDTH = 24;
const RADIUS = 4;

/** Una columna con el extremo de arriba redondeado y la base recta. */
function columnPath(height: number): string {
  const top = HEIGHT - height;
  if (height <= RADIUS) return `M0,${HEIGHT} V${top} H${WIDTH} V${HEIGHT} Z`;
  return [
    `M0,${HEIGHT}`,
    `V${top + RADIUS}`,
    `Q0,${top} ${RADIUS},${top}`,
    `H${WIDTH - RADIUS}`,
    `Q${WIDTH},${top} ${WIDTH},${top + RADIUS}`,
    `V${HEIGHT}`,
    'Z',
  ].join(' ');
}

export function ActivityColumns({ days, label }: { days: ActivityDay[]; label: string }) {
  const [active, setActive] = useState<number | null>(null);
  const [focusIndex, setFocusIndex] = useState(days.length - 1);
  const refs = useRef<Array<HTMLLIElement | null>>([]);

  // Escala estable: con días de uno o dos pasos, una columna sola no llena el gráfico.
  const max = Math.max(4, ...days.map((d) => d.steps));
  const peak = days.reduce((best, d, i) => (d.steps > (days[best]?.steps ?? 0) ? i : best), 0);
  const firstVisibleOnPhone = Math.max(0, days.length - 7);

  const move = (event: KeyboardEvent<HTMLLIElement>, index: number) => {
    // En el teléfono la primera semana no se pinta: las flechas no la visitan.
    const phone =
      typeof window.matchMedia === 'function' && !window.matchMedia('(min-width: 640px)').matches;
    const first = phone ? firstVisibleOnPhone : 0;
    let next = index;
    if (event.key === 'ArrowRight') next = index + 1;
    else if (event.key === 'ArrowLeft') next = index - 1;
    else if (event.key === 'Home') next = first;
    else if (event.key === 'End') next = days.length - 1;
    else return;
    event.preventDefault();
    next = Math.max(first, Math.min(days.length - 1, next));
    setFocusIndex(next);
    refs.current[next]?.focus();
  };

  return (
    <ol aria-label={label} className="m-0 flex list-none items-end justify-between gap-1 p-0">
      {days.map((day, index) => {
        const height = day.steps === 0 ? 2 : Math.max(6, (day.steps / max) * (HEIGHT - 8));
        const open = active === index;
        const edge = index < 2 ? 'start' : index > days.length - 3 ? 'end' : 'center';
        return (
          // Foco itinerante del gráfico: el día enfocado enseña su cifra (dataviz: lo mismo con
          // teclado que con puntero). Sin acción que ejecutar, no es un botón.
          // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/no-noninteractive-tabindex
          <li
            key={day.date}
            ref={(node) => {
              refs.current[index] = node;
            }}
            tabIndex={index === focusIndex ? 0 : -1}
            onFocus={() => {
              setActive(index);
              setFocusIndex(index);
            }}
            onBlur={() => setActive(null)}
            onPointerEnter={() => setActive(index)}
            onPointerLeave={() => setActive(null)}
            onKeyDown={(event) => move(event, index)}
            className={cn(
              'rounded-control relative flex flex-1 flex-col items-center gap-2 pt-6 outline-offset-2',
              index < firstVisibleOnPhone && 'hidden sm:flex'
            )}
          >
            <span className="sr-only">{day.description}</span>

            {/* El tooltip: el valor primero, el día después (dataviz, interacción). */}
            <span
              aria-hidden="true"
              className={cn(
                'bg-surface-raised border-border-muted elevation-floating rounded-control type-caption text-text pointer-events-none absolute bottom-full z-10 mb-1 whitespace-nowrap border px-2 py-1',
                'duration-fast ease-standard transition-opacity',
                open ? 'opacity-100' : 'opacity-0',
                edge === 'start' && 'left-0',
                edge === 'end' && 'right-0',
                edge === 'center' && 'left-1/2 -translate-x-1/2'
              )}
            >
              {day.description}
            </span>

            {index === peak && day.steps > 0 && (
              <span aria-hidden="true" className="type-caption text-text tabular-nums">
                {day.steps}
              </span>
            )}

            <svg aria-hidden="true" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="h-24 w-6">
              <path
                d={columnPath(height)}
                className={cn(
                  'chart-grow-y',
                  day.steps === 0
                    ? 'fill-border-muted'
                    : open
                      ? 'fill-accent-hover'
                      : 'fill-accent-base'
                )}
              />
            </svg>
            <span
              aria-hidden="true"
              className={cn(
                'type-caption',
                day.today ? 'text-text font-semibold' : 'text-text-muted'
              )}
            >
              {day.short}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
