/**
 * Indicador: un número con su etiqueta y un icono. Solo el valor actual, sin «+12 % vs. mes
 * anterior» (decisión 19/9: sin histórico no hay variación honesta). El número va en rol
 * `data` (dígitos tabulares) y la etiqueta es el nombre accesible del bloque.
 */

import type { LucideIcon } from 'lucide-react';
import Link from 'next/link';

export interface StatCardProps {
  label: string;
  value: number;
  icon: LucideIcon;
  /** Si el indicador lleva a la lista filtrada que lo explica. */
  href?: string;
  /** Tono del icono; `warning` para lo que pide acción (vencidas, en mora). */
  tone?: 'info' | 'success' | 'warning';
}

const TONE = {
  info: 'bg-status-info-muted text-status-info-base',
  success: 'bg-status-success-muted text-status-success-base',
  warning: 'bg-status-warning-muted text-status-warning-base',
} as const;

export function StatCard({ label, value, icon: Icon, href, tone = 'info' }: StatCardProps) {
  const body = (
    <>
      <span
        className={`rounded-control inline-flex size-11 shrink-0 items-center justify-center ${TONE[tone]}`}
      >
        <Icon aria-hidden="true" className="size-5" />
      </span>
      <span className="min-w-0">
        <span className="type-caption text-text-muted block">{label}</span>
        <span className="type-display text-text block tabular-nums">
          {new Intl.NumberFormat('es-CO').format(value)}
        </span>
      </span>
    </>
  );
  const shell =
    'bg-surface-base border-border-muted rounded-card elevation-resting flex items-center gap-4 border p-5';
  return href ? (
    <Link href={href} className={`${shell} hover:bg-surface-sunken transition-colors`}>
      {body}
    </Link>
  ) : (
    <div className={shell}>{body}</div>
  );
}

export function StatGrid({
  children,
  columns = 4,
}: {
  children: React.ReactNode;
  /** Cuántas tarjetas por fila en pantallas anchas. Seis cifras en filas de cuatro dejan una fila coja. */
  columns?: 3 | 4;
}) {
  return (
    <div
      className={
        columns === 3
          ? 'grid gap-4 sm:grid-cols-2 xl:grid-cols-3'
          : 'grid gap-4 sm:grid-cols-2 xl:grid-cols-4'
      }
    >
      {children}
    </div>
  );
}
