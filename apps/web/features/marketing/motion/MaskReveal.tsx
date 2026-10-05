'use client';

/**
 * Una foto que se descubre desde un borde, no un fundido (5/10): `clip-path` de cerrado a
 * abierto en 800 ms con la curva expresiva y, si `zoom`, la imagen de dentro baja de 1.04 a 1.
 * Solo `clip-path` y `transform`: nada de layout.
 *
 * En el teléfono, un fundido: el recorte es un efecto de escritorio.
 *
 * Se observa el envoltorio y se recorta el de dentro: Chrome descuenta el `clip-path` del propio
 * elemento al calcular la intersección, y una foto cerrada del todo nunca «entraba» en pantalla.
 */

import { useEffect, useRef, type ReactNode } from 'react';
import { animate, inView } from 'motion';
import { cn } from '@/lib/utils';
import { isCompact, isIn, markIn, prefersReducedMotion } from './env';
import { applyFirstFrame, maskFrames, release, type MaskFrom } from './keyframes';
import { motionTokens } from './tokens';

export function MaskReveal({
  children,
  from = 'bottom',
  zoom = true,
  delay = 0,
  className,
}: {
  children: ReactNode;
  from?: MaskFrom;
  zoom?: boolean;
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const outer = ref.current;
    const el = inner.current;
    if (!outer || !el || prefersReducedMotion()) return;
    const stop = inView(
      outer,
      () => {
        stop();
        if (isIn(el)) return;
        const compact = isCompact();
        const frames = compact ? { opacity: [0, 1] } : { clipPath: maskFrames(from) };
        applyFirstFrame(el, frames);
        markIn(el);
        const options = {
          duration: motionTokens.duration.slow,
          delay,
          ease: motionTokens.easing.expressive,
        };
        animate(el, frames, options).then(() => release(el));
        if (zoom && !compact) {
          el.querySelectorAll('img').forEach((img) =>
            animate(img, { scale: [1.04, 1] }, options).then(() => release(img))
          );
        }
      },
      { amount: motionTokens.amount }
    );
    return stop;
  }, [from, zoom, delay]);

  return (
    <div ref={ref} className={cn(className)}>
      <div ref={inner} data-mo={`mask-${from}`} className="relative">
        {children}
      </div>
    </div>
  );
}
