/**
 * Una barra de avance (27/9). SVG y no un `div` con `style`: la CSP no admite estilos en línea.
 *
 * Vivía copiada en `/aprender` y en `/familia`; ahora la ruta del tema también la necesita y
 * son tres. Server Component: solo pinta; el porcentaje y el texto los calcula quien la usa.
 */

import { cn } from '@/lib/utils';

export interface ProgressBarProps {
  /** 0–100; se recorta a ese rango. */
  percent: number;
  /** El nombre accesible: qué avanza («Avance en Bachillerato»). */
  label: string;
  className?: string;
}

export function ProgressBar({ percent, label, className }: ProgressBarProps) {
  const value = Math.max(0, Math.min(100, Math.round(percent)));
  return (
    <svg
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={value}
      aria-label={label}
      viewBox="0 0 100 8"
      preserveAspectRatio="none"
      className={cn('h-2 w-full overflow-hidden rounded-full', className)}
    >
      <rect width="100" height="8" className="fill-surface-sunken" />
      <rect width={value} height="8" className="fill-accent-base" />
    </svg>
  );
}
