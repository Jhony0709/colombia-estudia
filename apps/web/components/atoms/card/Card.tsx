/**
 * Card: un panel con nombre propio.
 * SSOT: reference/03-ui/layout-y-componentes.md §3 y §4.
 *
 * **Agrupa el borde, no la sombra.** La razón original sigue en pie y no es de gusto: en modo
 * oscuro una sombra prácticamente no se ve, así que una tarjeta que agrupara con sombra
 * dejaría de agrupar en cuanto alguien cambia de tema. Lo que cambió el 18/9 es que ahora
 * además lleva `elevation-resting`, que en claro despega el blanco del lienzo gris y en
 * oscuro no se nota. Es refuerzo: quitar la sombra no rompe nada, quitar el borde sí.
 *
 * **No es para listas.** Una lista de lo mismo —personas, temas, cohortes— son filas
 * (`molecules/data-table`, §4): en filas el dato cae en la misma columna y se compara de un
 * vistazo; en tarjetas hay que leer cada una entera. Esto es para paneles heterogéneos, pocos
 * y distintos entre sí.
 *
 * **No se anidan.** Una tarjeta dentro de una tarjeta no crea jerarquía, crea ruido (§3).
 *
 * **Botones contextuales (24/9).** Además de `action` —la acción de la tarjeta, la que hace
 * algo con lo que hay dentro— una tarjeta puede llevar `actions`: controles que cambian CÓMO
 * se ve lo de dentro, no lo que es (la vista bloques/Markdown del editor, un filtro, un
 * colapsar). Van en la fila del encabezado, a la derecha, y con `labelledBy` la tarjeta acepta
 * `label` para pintar en esa misma fila el elemento de fuera que la nombra.
 */

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface CardProps {
  /**
   * El encabezado de la tarjeta. Opcional: una tarjeta sin título es un agrupador visual y
   * no una sección, y entonces no debe anunciarse como región.
   */
  title?: string;
  description?: string;
  /** Una acción, la de la tarjeta. Si hacen falta tres, es una sección, no una tarjeta. */
  action?: ReactNode;
  /**
   * Botones contextuales: cambian cómo se ve la tarjeta (una vista, un filtro), no lo que
   * hay en ella. Van a la derecha del encabezado; el que los pasa ya los agrupa
   * (`SegmentedControl`, un `role="group"`).
   */
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  /** El nivel del encabezado, según dónde cuelgue. Por defecto `h3`: vive dentro de una sección. */
  as?: 'h2' | 'h3' | 'h4';
  /**
   * El `id` de un elemento de fuera que ya nombra a esta tarjeta. Es para el caso en que el
   * nombre lo pone un `<label>` —el editor de un tema: la sección se llama como el campo, y el
   * campo manda—: la tarjeta es una región con ese nombre, sin pintar un encabezado propio que
   * lo duplique. Excluyente con `title`.
   */
  labelledBy?: string;
  /**
   * Con `labelledBy`: el elemento que nombra a la tarjeta (el `<p id>` o `<label>` de fuera),
   * para que se pinte en la fila del encabezado, en línea con `actions`. Sin `actions` da igual
   * pasarlo aquí o como primer hijo.
   */
  label?: ReactNode;
}

export function Card({
  title,
  description,
  action,
  actions,
  children,
  className,
  as = 'h3',
  labelledBy,
  label,
}: CardProps) {
  const Heading = as;
  const headingId = title ? `card-${title.toLowerCase().replace(/\s+/g, '-')}` : undefined;

  const body = (
    <>
      {(title || label || action || actions) && (
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div className="space-y-1">
            {title && (
              <Heading id={headingId} className="type-body-emphasis text-text">
                {title}
              </Heading>
            )}
            {!title && label}
            {description && <p className="type-caption text-text-muted">{description}</p>}
          </div>
          {(action || actions) && (
            <div className="flex flex-wrap items-center gap-2">
              {actions}
              {action}
            </div>
          )}
        </div>
      )}
      {children}
    </>
  );

  const shell = cn(
    'bg-surface-base border-border-muted rounded-card elevation-resting border p-5 space-y-3',
    className
  );

  // Con título es una región con nombre y se puede saltar a ella; sin título, un `div`
  // anunciado como región sería una región que no se sabe decir.
  if (labelledBy) {
    return (
      <section aria-labelledby={labelledBy} className={shell}>
        {body}
      </section>
    );
  }

  return title ? (
    <section aria-labelledby={headingId} className={shell}>
      {body}
    </section>
  ) : (
    <div className={shell}>{body}</div>
  );
}
