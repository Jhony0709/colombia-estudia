'use client';

/**
 * Un control segmentado: pocas opciones excluyentes, todas a la vista, una elegida.
 * SSOT: reference/03-ui/layout-y-componentes.md §3 (botones contextuales de `Card`).
 *
 * Es el patrón de `ThemeToggle` (`molecules/theme-toggle`), generalizado: botones de
 * alternancia con `aria-pressed` dentro de un `role="group"` con nombre, y no un grupo de
 * radios. Con `aria-pressed` el tabulador recorre las opciones y cualquiera se pulsa con
 * Intro o espacio; un grupo de radios saca del tabulador las no elegidas y obliga a las
 * flechas, que es maquinaria de más para dos o tres botones en una fila.
 *
 * Sirve para cambiar CÓMO se ve algo (una vista, un intervalo, un filtro), no para hacer
 * algo con ello: para eso está `Button`. Si hay más de cuatro opciones, es un `<select>`.
 *
 * El texto va siempre; el icono, si lo hay, lo acompaña. Sin tooltips: lo que se puede leer
 * no hace falta explicarlo al pasar el ratón (`icon` solo no está permitido a propósito).
 *
 * El alto es el del control de la densidad menos el relleno del marco, para que el conjunto
 * mida `min-h-control` y quede a ras de un `Button` de al lado. El foco lo pinta el global
 * (`globals.css` `:focus-visible`), como en `Button`.
 */

import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  icon?: LucideIcon;
}

export interface SegmentedControlProps<T extends string> {
  /** El nombre del grupo, para el lector de pantalla: «Vista», «Periodo». */
  label: string;
  options: readonly SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}

export function SegmentedControl<T extends string>({
  label,
  options,
  value,
  onChange,
  className,
}: SegmentedControlProps<T>) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cn(
        'border-border-muted bg-surface-sunken rounded-control inline-flex gap-0.5 border p-0.5',
        className
      )}
    >
      {options.map(({ value: option, label: text, icon: Icon }) => {
        const pressed = option === value;
        return (
          <button
            key={option}
            type="button"
            aria-pressed={pressed}
            onClick={() => {
              if (!pressed) onChange(option);
            }}
            className={cn(
              'rounded-control type-caption inline-flex min-h-[calc(var(--density-control-height)-0.5rem)] items-center gap-1.5 px-2.5',
              'duration-fast ease-standard transition-colors',
              pressed
                ? 'bg-surface-base text-text elevation-resting'
                : 'text-text-muted hover:text-text'
            )}
          >
            {Icon && <Icon className="h-4 w-4" aria-hidden="true" />}
            {text}
          </button>
        );
      })}
    </div>
  );
}
