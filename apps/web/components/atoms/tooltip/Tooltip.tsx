'use client';

/**
 * Tooltip: el nombre de un botón que solo enseña un icono, al pasar por encima o al enfocarlo.
 * SSOT: reference/03-ui/layout-y-componentes.md §3.
 *
 * **No sustituye al nombre accesible: lo enseña.** Cada botón de icono sigue llevando su texto
 * en `sr-only`, que es lo que lee el lector de pantalla y lo que se ve en el árbol. El tooltip
 * es para quien ve la pantalla y no sabe qué hace una flecha. Por eso el contenido es
 * `aria-hidden`: si no, el lector diría el nombre dos veces (el del botón y el del tooltip).
 *
 * Radix lo abre con el ratón y con el foco del teclado, lo cierra con Escape, y no lo abre al
 * tocar: en un teléfono no hay «pasar por encima», y un tooltip que aparece al pulsar tapa lo
 * que se acaba de pulsar. Retraso corto (300 ms): quien recorre una barra de botones no
 * quiere esperar en cada uno; quien pasa de largo no quiere una lluvia de etiquetas.
 *
 * El `Provider` va en el layout raíz, una vez: comparte el retraso entre todos y hace que, una
 * vez abierto uno, el siguiente de la misma barra se abra sin esperar.
 */

import * as RadixTooltip from '@radix-ui/react-tooltip';
import type { ReactNode } from 'react';

export function TooltipProvider({ children }: { children: ReactNode }) {
  return (
    <RadixTooltip.Provider delayDuration={300} skipDelayDuration={400}>
      {children}
    </RadixTooltip.Provider>
  );
}

export interface TooltipProps {
  /** Lo que dice. Es el mismo texto que el `sr-only` del botón. */
  label: string;
  /** Un solo elemento que acepte `ref` y los manejadores de ratón y foco: el botón. */
  children: ReactNode;
  side?: 'top' | 'bottom' | 'left' | 'right';
}

export function Tooltip({ label, children, side = 'top' }: TooltipProps) {
  return (
    <RadixTooltip.Root>
      <RadixTooltip.Trigger asChild>{children}</RadixTooltip.Trigger>
      <RadixTooltip.Portal>
        <RadixTooltip.Content
          side={side}
          sideOffset={6}
          aria-hidden="true"
          className="bg-text text-surface-base type-caption rounded-control elevation-floating z-50 select-none px-2 py-1"
        >
          {label}
        </RadixTooltip.Content>
      </RadixTooltip.Portal>
    </RadixTooltip.Root>
  );
}
