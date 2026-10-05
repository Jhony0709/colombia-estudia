'use client';

/**
 * Las ondas en movimiento (5/10), una vez y al entrar en pantalla:
 *
 * - `separator`: el separador se descubre a lo ancho (`scaleX` .92 → 1, opacidad .6 → 1) desde
 *   `origin`, que se alterna izquierda/derecha entre secciones: el camino continúa.
 * - `draw`: los trazos (`.alba-wave__stroke`, con `pathLength="1"`) se dibujan de izquierda a
 *   derecha. Solo en «Historias»: dibujar en todas partes deja de significar algo.
 * - `rise`: la estela de color (`.alba-wave__trail`) sube 24 px y se asienta (cierre).
 *
 * En el teléfono las ondas están quietas: ya están dibujadas al llegar.
 *
 * La entrada de las ondas del hero es CSS (`site.css`): ocurre al cargar, antes de hidratar.
 */

import { useEffect, useRef, type ReactNode } from 'react';
import { animate, inView } from 'motion';
import { cn } from '@/lib/utils';
import { isCompact, isIn, markIn, prefersReducedMotion } from './env';
import { applyFirstFrame, release } from './keyframes';
import { motionTokens } from './tokens';

export function AnimatedWave({
  children,
  mode,
  origin = 'left',
  className,
}: {
  children: ReactNode;
  mode: 'separator' | 'draw' | 'rise';
  origin?: 'left' | 'right';
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || prefersReducedMotion()) return;
    const stop = inView(
      el,
      () => {
        stop();
        if (isIn(el)) return;
        if (isCompact()) {
          markIn(el);
          return;
        }
        const options = {
          duration: motionTokens.duration.wave,
          ease: motionTokens.easing.expressive,
        };
        if (mode === 'separator') {
          el.style.opacity = '0.6';
          el.style.transform = 'scaleX(0.92)';
          markIn(el);
          animate(el, { opacity: [0.6, 1], scaleX: [0.92, 1] }, options).then(() => release(el));
          return;
        }
        if (mode === 'draw') {
          markIn(el);
          el.querySelectorAll<SVGPathElement>('.alba-wave__stroke').forEach((path, i) => {
            animate(
              path,
              { strokeDashoffset: [1, 0] },
              { ...options, delay: i * motionTokens.stagger.loose }
            );
          });
          return;
        }
        markIn(el);
        el.querySelectorAll<SVGElement>('.alba-wave__trail').forEach((trail) => {
          applyFirstFrame(trail, { y: [24] });
          animate(trail, { y: [24, 0] }, options).then(() => release(trail));
        });
      },
      { amount: mode === 'separator' ? 0.5 : motionTokens.amount }
    );
    return stop;
  }, [mode]);

  return (
    <div
      ref={ref}
      data-mo={`wave-${mode}`}
      className={cn(origin === 'left' ? 'origin-left' : 'origin-right', className)}
    >
      {children}
    </div>
  );
}
