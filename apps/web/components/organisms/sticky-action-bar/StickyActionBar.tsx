/**
 * La barra fija al pie de una pantalla de tarea (23/9, `docs/ux/decision-ux-2309.md`):
 * a la izquierda el estado —qué falta o qué pasó—, a la derecha **una** acción que cambia
 * con ese estado, y en medio, si hace falta, una salida secundaria (volver, anterior).
 *
 * `sticky` y no `fixed`: al ir en el flujo de la columna no tapa el final del contenido ni
 * el foco de lo último de la página (WCAG 2.2, 2.4.11), y en escritorio respeta la columna
 * del rail. Superficie `base` sobre el lienzo, borde arriba, sin sombra (la sombra no
 * agrupa: `layout-y-componentes.md` §3).
 */

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function StickyActionBar({
  label,
  status,
  secondary,
  action,
  className,
}: {
  /** El nombre accesible de la barra (`aria-label` del `nav`). */
  label: string;
  /** Lo que falta o lo que pasó, en palabras. Va con `role="status"`. */
  status?: ReactNode;
  /** Enlaces de salida: anterior, volver a la ruta. */
  secondary?: ReactNode;
  /** La acción. Una. */
  action?: ReactNode;
  className?: string;
}) {
  return (
    <nav
      aria-label={label}
      className={cn(
        'border-border bg-surface-base sticky bottom-0 z-10 -mx-4 mt-12 border-t px-4 py-3 sm:mx-0 sm:px-0',
        className
      )}
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {status !== undefined && (
          <p
            role="status"
            className="type-caption text-text-muted min-w-0 flex-1 basis-full sm:basis-auto"
          >
            {status}
          </p>
        )}
        {secondary && <div className="flex min-w-0 items-center gap-3">{secondary}</div>}
        {action && <div className="ml-auto shrink-0">{action}</div>}
      </div>
    </nav>
  );
}
