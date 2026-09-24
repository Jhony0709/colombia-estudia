/**
 * TaskBar: la barra fina del modo tarea en el teléfono (E2, 23/9). Sustituye a la barra
 * global mientras la persona está en un tema o en un intento: a la izquierda la vuelta a
 * la ruta, en medio dónde estoy («Módulo 1 · Tema 2 de 2»), a la derecha lo que la pantalla
 * quiera (el menú Opciones). Solo por debajo de `lg`; en escritorio la barra global sigue.
 *
 * Es de servidor y no lleva estado: lo que muestra viene de la página.
 */

import Link from 'next/link';
import type { Route } from 'next';
import { ArrowLeft } from 'lucide-react';

export function TaskBar({
  backHref,
  backLabel,
  place,
  action,
}: {
  backHref: string;
  backLabel: string;
  /** Dónde estoy, en una línea corta. */
  place: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="bg-surface-base border-border-muted sticky top-0 z-10 -mx-4 -mt-8 mb-6 flex items-center gap-2 border-b px-2 py-1 sm:-mx-6 lg:hidden">
      <Link
        href={backHref as Route}
        className="text-text-muted hover:bg-surface-sunken hover:text-text rounded-control min-h-touch min-w-touch inline-flex items-center justify-center"
      >
        <ArrowLeft aria-hidden className="size-5" />
        <span className="sr-only">{backLabel}</span>
      </Link>
      <p className="type-caption text-text-muted m-0 min-w-0 flex-1 truncate">{place}</p>
      {action}
    </div>
  );
}
