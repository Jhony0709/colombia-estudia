/**
 * El momento del resultado de un cuestionario (8/10, Jhonny): **amanecer** al aprobar —el sol
 * de la marca con su check, rayos, chispas y dos ondas— y **respiración** al no aprobar, sin
 * rojo de fracaso. Decorativo (`aria-hidden`): lo que pasó lo dice el título de al lado.
 * La coreografía vive en `globals.css` (`.result-*`), con tokens y corte con movimiento reducido.
 */

import { cn } from '@/lib/utils';

const RAYS = [0, 45, 90, 135, 180, 225, 270, 315];

export function ResultMoment({
  kind,
  className,
}: {
  kind: 'success' | 'breath';
  className?: string;
}) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 96 96"
      className={cn('result-moment size-24 shrink-0 overflow-visible sm:size-28', className)}
    >
      {kind === 'success' ? (
        <>
          <circle
            cx="48"
            cy="48"
            r="34"
            strokeWidth="3"
            className="result-ripple stroke-brand-yellow fill-none"
          />
          <circle
            cx="48"
            cy="48"
            r="34"
            strokeWidth="2"
            className="result-ripple result-ripple--late stroke-status-success-base fill-none"
          />
          {RAYS.map((deg) => (
            <g key={`spark-${deg}`} transform={`rotate(${deg + 22.5} 48 48)`}>
              <circle cx="48" cy="9" r="2" className="result-spark fill-accent-base" />
            </g>
          ))}
          {RAYS.map((deg) => (
            <g key={deg} transform={`rotate(${deg} 48 48)`}>
              <rect
                x="46.5"
                y="4"
                width="3"
                height="9"
                rx="1.5"
                className="result-ray fill-brand-yellow"
              />
            </g>
          ))}
          <g className="result-pop">
            <circle cx="48" cy="48" r="30" className="fill-status-success-base" />
            {/* Máscara de luminancia: el blanco es «se ve», no un color de la interfaz. */}
            <mask id="result-check-mask">
              <rect x="30" y="30" width="36" height="36" fill="white" className="result-reveal" />
            </mask>
            <path
              d="M35 49 L44 58 L62 39"
              mask="url(#result-check-mask)"
              className="stroke-text-on-accent fill-none"
              strokeWidth="6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </g>
        </>
      ) : (
        <>
          <circle cx="48" cy="48" r="44" className="result-breathe-halo fill-accent-base" />
          <circle cx="48" cy="48" r="28" className="result-breathe fill-accent-base" />
          <circle cx="48" cy="48" r="12" className="result-breathe fill-surface-base" />
        </>
      )}
    </svg>
  );
}
