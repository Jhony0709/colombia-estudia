/**
 * El marco de un editor (ola 2 UX, 23/9): el cuerpo para escribir a la izquierda y una
 * columna derecha fija de 20rem con la «lista de salida» (`ReadinessPanel` en `rail`).
 * En escritorio (`lg`) la columna acompaña el scroll (`sticky`); por debajo, el mismo panel
 * va plegado arriba en un `<details>` cuyo resumen dice cuántas cosas piden algo, para que
 * en un celular no empuje el editor dos pantallas hacia abajo.
 *
 * Sin estado ni JavaScript: `details` abre y cierra solo, y en escritorio el CSS lo pinta
 * siempre abierto (`lg:open` no existe: se enseña la columna y se esconde el `details`).
 */

import type { ReactNode } from 'react';

export function EditorLayout({
  rail,
  railSummary,
  children,
}: {
  /** La columna derecha (escritorio) / el bloque plegado (móvil). */
  rail: ReactNode;
  /** El resumen del bloque plegado: «Preparación · 2 pendientes». */
  railSummary: string;
  children: ReactNode;
}) {
  return (
    <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start lg:gap-8">
      <details className="border-border-muted rounded-card mb-6 border lg:hidden">
        <summary className="type-label text-text min-h-touch flex cursor-pointer items-center px-4">
          {railSummary}
        </summary>
        <div className="px-2 pb-2">{rail}</div>
      </details>
      <div className="min-w-0 space-y-8">{children}</div>
      <aside className="sticky top-4 hidden lg:block">{rail}</aside>
    </div>
  );
}
