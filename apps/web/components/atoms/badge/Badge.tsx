/**
 * Badge: una palabra de estado con forma de píldora.
 * SSOT: reference/03-ui/layout-y-componentes.md, plan/11-ux.md:79.
 *
 * **La palabra es el estado; el color es refuerzo.** Es la misma regla que ya obligaba a poner
 * el contador de avisos en texto y no en un punto rojo: quien no distingue el azul del gris, y
 * quien escucha la página en vez de verla, tiene que recibir «Borrador» igual de claro. Por eso
 * no existe una variante que sea solo color, y por eso `children` es texto y no un icono.
 *
 * Los pares de contraste están medidos contra los dos temas antes de escribirlos:
 *
 * | variante | claro | oscuro |
 * | -------- | ----- | ------ |
 * | neutral  | 6.22  | 8.15   |
 * | info     | 5.49  | 6.28   |
 * | success  | 5.27  | 6.76   |
 * | warning  | 5.03  | 7.85   |
 * | error    | 5.25  | 5.72   |
 *
 * Los cinco pares están **en el contrato** (`contract/pairs.ts`), no solo en este comentario:
 * medirlos una vez y anotarlos aquí es exactamente lo que dejó a `text.subtle` sobre
 * `surface.sunken` en 1.05 durante meses. `success` y `warning` en claro entraban a 4.57 y
 * 4.51 sobre un mínimo de 4.5, así que los dos colores bajaron un escalón al añadirlos.
 */

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type BadgeVariant = 'neutral' | 'info' | 'success' | 'warning' | 'error';

const VARIANTS: Record<BadgeVariant, string> = {
  neutral: 'bg-surface-sunken text-text-muted',
  info: 'bg-status-info-muted text-status-info-base',
  success: 'bg-status-success-muted text-status-success-base',
  warning: 'bg-status-warning-muted text-status-warning-base',
  error: 'bg-status-error-muted text-status-error-base',
};

export interface BadgeProps {
  variant?: BadgeVariant;
  children: ReactNode;
  className?: string;
}

export function Badge({ variant = 'neutral', children, className }: BadgeProps) {
  return (
    <span
      className={cn(
        'rounded-pill type-caption inline-flex items-center whitespace-nowrap px-2 py-0.5',
        VARIANTS[variant],
        className
      )}
    >
      {children}
    </span>
  );
}
