/**
 * DataTable molecule.
 * SSOT: plan/11-ux.md:56 ("tablas densas con filtros en la URL, acciones por fila"),
 *       DESIGN.md §Espaciado ("tablas en contenedor con scroll propio").
 *
 * One table markup for the whole staff area: a real `<caption>`, `<th scope="col">`, and a
 * horizontal scroll container so a dense table reflows at 320 px without pushing the page
 * sideways. The container is focusable and labelled, because a scrollable region that only
 * a mouse can reach is not reachable (WCAG 2.1.1).
 */

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface DataTableColumn<T> {
  /** Stable key, used for React and nothing else. */
  key: string;
  /** Texto, o un nodo (la casilla de «seleccionar todo», 19/9). Si es nodo, da `headerLabel`. */
  header: ReactNode;
  /** Nombre de la columna para lectores cuando `header` no es texto. */
  headerLabel?: string;
  cell: (row: T) => ReactNode;
  /** Columna estrecha (casilla, menú): sin crecer y sin partir. */
  narrow?: boolean;
  /** Numbers line up on tabular figures (DESIGN.md: rol `data`). */
  numeric?: boolean;
}

export interface DataTableProps<T> {
  /** Describes the table for someone who cannot see it. Not decorative. */
  caption: string;
  columns: Array<DataTableColumn<T>>;
  rows: T[];
  rowKey: (row: T) => string;
  /** Shown instead of the table when there is nothing — never an empty grid. */
  empty: ReactNode;
  /**
   * Sin tarjeta: para una tabla que ya vive dentro de una (los grupos de temas). Por defecto la
   * tabla ES la tarjeta: desde el 19/9 el área de staff es lienzo gris y lo que se lee va en
   * blanco, y una tabla suelta sobre el lienzo era lo único que quedaba sin despegar.
   */
  plain?: boolean;
  /**
   * Filas de 8 px de padding vertical en vez de 12 (ola 3 UX, 23/9): para listas largas que
   * se recorren de arriba abajo (matrículas, cartera, personas), donde la densidad ayuda a
   * comparar. No baja del objetivo presionable: las celdas con enlace siguen midiendo
   * `min-h-touch` por el enlace, no por la fila. La tabla por defecto sigue en 12.
   */
  compactRows?: boolean;
}

export function DataTable<T>({
  caption,
  columns,
  rows,
  rowKey,
  empty,
  plain = false,
  compactRows = false,
}: DataTableProps<T>) {
  if (rows.length === 0) {
    return <>{empty}</>;
  }

  return (
    // El contenedor con scroll tiene que poder recibir foco de teclado: si no, quien
    // navega con teclado no puede desplazar la tabla (WCAG 2.1.1, y es exactamente lo
    // que exige la regla `scrollable-region-focusable` de axe, que corre en pa11y).
    // `jsx-a11y/no-noninteractive-tabindex` no conoce este caso —su lista blanca solo
    // trae `tabpanel`—, asi que la regla se desactiva aqui y solo aqui. Quitar el
    // tabIndex callaria al linter a cambio de romper el acceso por teclado.
    <div
      role="region"
      aria-label={caption}
      // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
      tabIndex={0}
      className={cn(
        'overflow-x-auto',
        !plain &&
          'bg-surface-base border-border-muted rounded-card elevation-resting border px-5 py-1'
      )}
    >
      <table className="w-full border-collapse text-left">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-border border-b">
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                aria-label={column.headerLabel}
                className={cn(
                  'type-overline text-text-muted px-2 py-3 uppercase first:pl-0 last:pr-0',
                  column.narrow && 'w-px whitespace-nowrap'
                )}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={rowKey(row)} className="border-border border-b align-top">
              {columns.map((column) => (
                <td
                  key={column.key}
                  className={cn(
                    'text-text px-2 first:pl-0 last:pr-0',
                    compactRows ? 'py-2' : 'py-3',
                    column.numeric ? 'type-data' : 'type-body',
                    column.narrow && 'w-px whitespace-nowrap'
                  )}
                >
                  {column.cell(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
