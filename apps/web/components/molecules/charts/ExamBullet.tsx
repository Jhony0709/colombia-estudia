/**
 * Un examen como gráfico de bala (4/10): la mejor nota sobre una pista de 0 a 100 y una raya en
 * el umbral de aprobación. El estado va en texto e icono, nunca solo en el color (ui-craft AP4);
 * el color de la barra es de estado porque significa aprobado / no aprobado.
 *
 * Server Component: geometría en atributos del SVG (CSP). La raya del umbral usa
 * `vector-effect="non-scaling-stroke"` para medir 2 px aunque el SVG se estire a lo ancho.
 */

import Link from 'next/link';
import { CircleCheck, CircleDashed, CircleAlert, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';

export type ExamBulletState = 'passed' | 'failed' | 'pending' | 'locked';

export interface ExamBulletProps {
  title: string;
  href: string | null;
  state: ExamBulletState;
  /** 0–100, la mejor nota visible; nula si no hay. */
  percent: number | null;
  /** 0–100; nulo = sin umbral. */
  passPercent: number | null;
  /** «Aprobado · 80 %», «Pendiente», «Se habilita al completar…». */
  status: string;
  /** Texto accesible de la barra: «Mejor nota 80 %, para aprobar 60 %». */
  summary: string;
}

const ICONS = {
  passed: CircleCheck,
  failed: CircleAlert,
  pending: CircleDashed,
  locked: Lock,
} as const;

const TONE = {
  passed: 'text-status-success-base',
  failed: 'text-status-warning-base',
  pending: 'text-text-muted',
  locked: 'text-status-locked-base',
} as const;

const FILL = {
  passed: 'fill-status-success-base',
  failed: 'fill-status-warning-base',
  pending: 'fill-accent-base',
  locked: 'fill-status-locked-base',
} as const;

/** Solo la barra (4/10): la usa también la tarjeta de examen de Resultados. */
export function ExamBulletBar({
  state,
  percent,
  passPercent,
  summary,
}: Pick<ExamBulletProps, 'state' | 'percent' | 'passPercent' | 'summary'>) {
  const value = percent === null ? 0 : Math.max(0, Math.min(100, percent));
  return (
    <svg
      role="img"
      aria-label={summary}
      viewBox="0 0 100 10"
      preserveAspectRatio="none"
      className="h-2.5 w-full overflow-hidden rounded-full"
    >
      <rect width="100" height="10" className="fill-surface-sunken" />
      {percent !== null && (
        <rect width={value} height="10" className={cn(FILL[state], 'chart-grow-x')} />
      )}
      {passPercent !== null && (
        <line
          x1={passPercent}
          x2={passPercent}
          y1="0"
          y2="10"
          strokeWidth="2"
          vectorEffect="non-scaling-stroke"
          className="stroke-text"
        />
      )}
    </svg>
  );
}

export function ExamBullet({
  title,
  href,
  state,
  percent,
  passPercent,
  status,
  summary,
}: ExamBulletProps) {
  const Icon = ICONS[state];
  return (
    <div className="space-y-2">
      <div className="flex items-start justify-between gap-3">
        {href ? (
          <Link
            href={href}
            className="type-body-emphasis text-text-link min-w-0 underline underline-offset-4"
          >
            {title}
          </Link>
        ) : (
          <span className="type-body-emphasis text-text min-w-0">{title}</span>
        )}
        <span className={cn('type-caption inline-flex shrink-0 items-center gap-1', TONE[state])}>
          <Icon aria-hidden className="size-4" />
          <span className="text-text">{status}</span>
        </span>
      </div>
      <ExamBulletBar state={state} percent={percent} passPercent={passPercent} summary={summary} />
    </div>
  );
}
