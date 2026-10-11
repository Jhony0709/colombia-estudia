'use client';

/**
 * Un grupo que entra escalonado, una vez (5/10): los hijos directos, en orden, con `step`
 * segundos entre uno y otro. Dentro de cada hijo, `data-mo-icon` hace crecer el icono de .92 a
 * 1 con su elemento (valores).
 */

import { useEffect, useRef, type ElementType, type ReactNode } from 'react';
import { animate, inView } from 'motion';
import { cn } from '@/lib/utils';
import { isIn, markIn, prefersReducedMotion } from './env';
import { applyFirstFrame, release, revealKeyframes, type RevealVariant } from './keyframes';
import { motionTokens } from './tokens';

export function Stagger({
  children,
  variant = 'fade-up',
  step = motionTokens.stagger.base,
  distance,
  duration = motionTokens.duration.reveal,
  as: Tag = 'div',
  className,
}: {
  children: ReactNode;
  variant?: RevealVariant;
  /** Segundos entre hijos. */
  step?: number;
  distance?: number;
  duration?: number;
  as?: ElementType;
  className?: string;
}) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const root = ref.current;
    if (!root || prefersReducedMotion()) return;
    const stop = inView(
      root,
      () => {
        stop();
        if (isIn(root)) return;
        const items = Array.from(root.children) as HTMLElement[];
        const frames = revealKeyframes(variant, distance);
        items.forEach((item) => applyFirstFrame(item, frames));
        markIn(root);
        items.forEach((item, i) => {
          const delay = i * step;
          animate(item, frames, {
            duration,
            delay,
            ease: motionTokens.easing.standard,
          }).then(() => release(item));
          item.querySelectorAll<HTMLElement>('[data-mo-icon]').forEach((icon) => {
            animate(
              icon,
              { scale: [0.92, 1] },
              { duration, delay, ease: motionTokens.easing.standard }
            ).then(() => release(icon));
          });
        });
      },
      { amount: motionTokens.amount }
    );
    return stop;
  }, [variant, step, distance, duration]);

  return (
    <Tag ref={ref} data-mo="stagger" className={cn(className)}>
      {children}
    </Tag>
  );
}
