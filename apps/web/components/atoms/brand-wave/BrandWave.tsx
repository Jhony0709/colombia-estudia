/**
 * La onda pequeña de la marca (`AlbaWave` «side» del landing) con tokens de la app (8/10).
 * Decorativa. `base`: la última capa, `surface` para cortar sobre la tarjeta (portadas),
 * `canvas` sobre el fondo de la página (héroes) o `accent` para terminar en azul (constancia).
 */

import { cn } from '@/lib/utils';

export function BrandWave({
  className,
  base = 'surface',
}: {
  className?: string;
  base?: 'surface' | 'canvas' | 'accent';
}) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 600 160"
      preserveAspectRatio="none"
      className={cn('pointer-events-none block w-full', className)}
    >
      <path
        className="fill-brand-yellow"
        d="M0 70C120 40 260 50 380 96C460 126 540 136 600 128V160H0Z"
      />
      <path
        className="fill-accent-base"
        d="M0 104C140 76 280 86 400 122C480 146 550 152 600 148V160H0Z"
      />
      <path
        className={
          base === 'surface'
            ? 'fill-surface-base'
            : base === 'canvas'
              ? 'fill-surface-canvas'
              : 'fill-accent-active'
        }
        d="M0 140C150 120 300 126 430 148C500 158 560 160 600 158V160H0Z"
      />
    </svg>
  );
}
