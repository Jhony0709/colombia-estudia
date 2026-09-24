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
import { ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Filas expandibles (24/9, pedido de Jhonny: «como en Basikon»). Es el patrón de
 * `TableExtended` de basikon-client: una primera columna estrecha con un chevron, y al abrir
 * una fila hija a todo lo ancho (`colSpan`) con lo que cuelga de esa fila —una subtabla, un
 * formulario—. El estado vive en quien usa la tabla (`isExpanded`/`onToggle`), así que el
 * `DataTable` sigue sin ser cliente. El botón lleva `aria-expanded` y `aria-controls` a la
 * fila hija; el nombre accesible dice de qué fila se trata («Mostrar módulos de COC-1»).
 */
export interface DataTableExpandable<T> {
  isExpanded: (row: T) => boolean;
  onToggle: (row: T) => void;
  /** Lo que se pinta debajo de la fila cuando está abierta. */
  content: (row: T) => ReactNode;
  /** Nombre accesible del botón, según esté abierta o cerrada. */
  label: (row: T, expanded: boolean) => string;
}

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
  /** Filas con hija desplegable. Ver `DataTableExpandable`. */
  expandable?: DataTableExpandable<T>;
  /**
   * Alineación vertical de las celdas. `top` (por defecto) para tablas donde una celda de
   * dos líneas se lee de arriba abajo con las demás; `middle` cuando la fila lleva botones,
   * chevrones o menús, que centrados quedan a la altura del texto (24/9, Programas).
   */
  align?: 'top' | 'middle';
}

export function DataTable<T>({
  caption,
  columns,
  rows,
  rowKey,
  empty,
  plain = false,
  compactRows = false,
  expandable,
  align = 'top',
}: DataTableProps<T>) {
  const alignClass = align === 'middle' ? 'align-middle' : 'align-top';
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
            {expandable && (
              <th scope="col" className="w-px px-2 py-3 first:pl-0">
                <span className="sr-only">{caption}</span>
              </th>
            )}
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
          {rows.map((row) => {
            const key = rowKey(row);
            const expanded = expandable ? expandable.isExpanded(row) : false;
            const childId = `${key}-expanded`;
            return [
              <tr key={key} className={cn('border-border', alignClass, !expanded && 'border-b')}>
                {expandable && (
                  <td className={cn('w-px px-2 first:pl-0', compactRows ? 'py-1' : 'py-2')}>
                    <button
                      type="button"
                      aria-expanded={expanded}
                      aria-controls={expanded ? childId : undefined}
                      onClick={() => expandable.onToggle(row)}
                      className="text-text-muted hover:bg-surface-sunken hover:text-text rounded-control min-h-touch min-w-touch inline-flex items-center justify-center"
                    >
                      {expanded ? (
                        <ChevronDown className="size-4" aria-hidden="true" />
                      ) : (
                        <ChevronRight className="size-4" aria-hidden="true" />
                      )}
                      <span className="sr-only">{expandable.label(row, expanded)}</span>
                    </button>
                  </td>
                )}
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
              </tr>,
              expandable && expanded ? (
                // La fila hija: a todo lo ancho, con fondo hundido para que se lea como
                // «lo de dentro» de la fila de arriba y no como una fila más.
                <tr key={childId} id={childId} className="border-border border-b">
                  <td colSpan={columns.length + 1} className="bg-surface-canvas px-3 py-4">
                    {expandable.content(row)}
                  </td>
                </tr>
              ) : null,
            ];
          })}
        </tbody>
      </table>
    </div>
  );
}
