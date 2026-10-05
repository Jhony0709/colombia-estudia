'use client';

/**
 * Revelar al entrar en pantalla, una sola vez (5/10). Variantes con nombre (`keyframes.ts`):
 * `fade`, `fade-up` (por defecto, 24 px; 12 en el teléfono), `slide-left`, `slide-right`,
 * `mask`. Se dispara con el 20 % visible y no se repite al salir y volver.
 *
 * El estado oculto lo pone el CSS (`[data-mo]` bajo `.site[data-mo-ready]`), no un estilo en el
 * HTML: la CSP no deja estilos en línea y sin JavaScript todo debe verse.
 */

import { useEffect, useRef, type ElementType, type ReactNode } from 'react';
import { animate, inView } from 'motion';
import { cn } from '@/lib/utils';
import { isIn, markIn, prefersReducedMotion } from './env';
import { applyFirstFrame, release, revealKeyframes, type RevealVariant } from './keyframes';
import { motionTokens } from './tokens';

export function Reveal({
  children,
  variant = 'fade-up',
  delay = 0,
  distance,
  duration = motionTokens.duration.reveal,
  as: Tag = 'div',
  className,
}: {
  children: ReactNode;
  variant?: RevealVariant;
  /** En segundos. */
  delay?: number;
  /** En px; en el teléfono se recorta a 12. */
  distance?: number;
  duration?: number;
  as?: ElementType;
  className?: string;
}) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || prefersReducedMotion()) return;
    const stop = inView(
      el,
      () => {
        stop();
        if (isIn(el)) return;
        const frames = revealKeyframes(variant, distance);
        applyFirstFrame(el, frames);
        markIn(el);
        animate(el, frames, {
          duration,
          delay,
          ease: motionTokens.easing.standard,
        }).then(() => release(el));
      },
      { amount: motionTokens.amount }
    );
    return stop;
  }, [variant, delay, distance, duration]);

  return (
    <Tag ref={ref} data-mo={variant} className={cn(className)}>
      {children}
    </Tag>
  );
}
