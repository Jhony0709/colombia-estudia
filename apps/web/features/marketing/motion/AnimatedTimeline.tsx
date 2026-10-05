'use client';

/**
 * La línea del proceso, dibujada con el scroll (5/10). En escritorio la curva avanza con la
 * lectura y, cuando llega a cada punto, el punto crece (.6 → 1) y su número e icono pasan de
 * .35 a 1. El texto de cada paso no se atenúa: un paso a medio leer tiene que leerse igual
 * (contraste AA). En el teléfono, y con movimiento reducido, todo está dibujado y activo.
 *
 * `children` es la lista de pasos (servidor); cada uno lleva `data-step`. La curva y los puntos
 * los pinta este componente. Solo `stroke-dashoffset`, `opacity` y `transform`.
 */

import { useEffect, useRef, type ReactNode } from 'react';
import { scroll } from 'motion';
import { prefersReducedMotion } from './env';

/** Dónde caen los puntos a lo largo de la curva (x de cada columna: 1/6, 1/2, 5/6). */
const MARKS = [1 / 6, 1 / 2, 5 / 6];
const DOT_X = ['left-[16.667%]', 'left-1/2', 'left-[83.333%]'] as const;
/** Altura de cada punto en px sobre el SVG de 112 px: los extremos de los tramos del `d`. */
const DOT_Y = ['top-[62px]', 'top-[30px]', 'top-[66px]'] as const;

export function AnimatedTimeline({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const line = useRef<SVGPathElement>(null);

  useEffect(() => {
    const root = ref.current;
    const path = line.current;
    if (!root || !path || prefersReducedMotion()) return;
    if (!window.matchMedia('(min-width: 1024px)').matches) return;
    const steps = Array.from(root.querySelectorAll<HTMLElement>('[data-step]'));
    const dots = Array.from(root.querySelectorAll<HTMLElement>('[data-dot]'));
    root.setAttribute('data-timeline', 'live');
    const stop = scroll(
      (progress: number) => {
        path.style.strokeDashoffset = String(1 - progress);
        MARKS.forEach((mark, i) => {
          const on = progress >= mark - 0.02;
          steps[i]?.toggleAttribute('data-active', on);
          dots[i]?.toggleAttribute('data-active', on);
        });
      },
      { target: root, offset: ['start 85%', 'end 55%'] }
    );
    return () => {
      stop();
      root.removeAttribute('data-timeline');
      path.style.strokeDashoffset = '';
    };
  }, []);

  return (
    <div ref={ref} className="relative mt-10 lg:mt-14">
      <div aria-hidden="true" className="relative hidden h-[112px] lg:block">
        <svg
          viewBox="0 0 1200 112"
          preserveAspectRatio="none"
          className="absolute inset-0 h-full w-full overflow-visible"
          focusable="false"
        >
          <path
            ref={line}
            className="site-timeline-path"
            d="M0 92C90 92 120 62 200 62C350 62 450 30 600 30C750 30 850 66 1000 66C1090 66 1140 44 1200 40"
            fill="none"
            stroke="var(--site-blue)"
            strokeWidth="2.5"
            strokeLinecap="round"
            pathLength={1}
            strokeDasharray="1"
          />
        </svg>
        {MARKS.map((mark, i) => (
          <span
            key={mark}
            data-dot
            className={`site-timeline-dot absolute -translate-x-1/2 -translate-y-1/2 ${DOT_X[i]} ${DOT_Y[i]}`}
          />
        ))}
      </div>
      {children}
    </div>
  );
}
