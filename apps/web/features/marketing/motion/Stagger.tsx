'use client';

/**
 * Un grupo que entra escalonado, una vez (5/10): los hijos directos, en orden, con `step`
 * segundos entre uno y otro. Dentro de cada hijo, dos marcas opcionales:
 *
 * - `data-mo-icon`: el icono crece de .92 a 1 con su elemento (valores);
 * - `data-mo-label`: la etiqueta sube 4 px un poco después (mosaico).
 *
 * `variant="mask"` descubre cada hijo de abajo arriba conservando sus esquinas (`round`); en
 * el teléfono, sube 12 px con fundido.
 */

import { useEffect, useRef, type ElementType, type ReactNode } from 'react';
import { animate, inView } from 'motion';
import { cn } from '@/lib/utils';
import { isCompact, isIn, markIn, prefersReducedMotion } from './env';
import {
  applyFirstFrame,
  maskFrames,
  release,
  revealKeyframes,
  type RevealVariant,
} from './keyframes';
import { motionTokens } from './tokens';

export function Stagger({
  children,
  variant = 'fade-up',
  step = motionTokens.stagger.base,
  distance,
  duration = motionTokens.duration.reveal,
  round = '0px',
  as: Tag = 'div',
  className,
}: {
  children: ReactNode;
  variant?: RevealVariant;
  /** Segundos entre hijos. */
  step?: number;
  distance?: number;
  duration?: number;
  /** Radio del recorte con `mask`. */
  round?: string;
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
        const mask = variant === 'mask' && !isCompact();
        const frames = mask
          ? { clipPath: maskFrames('bottom', round) }
          : revealKeyframes(variant === 'mask' ? 'fade-up' : variant, distance);
        items.forEach((item) => applyFirstFrame(item, frames));
        markIn(root);
        items.forEach((item, i) => {
          const delay = i * step;
          animate(item, frames, {
            duration,
            delay,
            ease: mask ? motionTokens.easing.expressive : motionTokens.easing.standard,
          }).then(() => release(item));
          item.querySelectorAll<HTMLElement>('[data-mo-icon]').forEach((icon) => {
            animate(
              icon,
              { scale: [0.92, 1] },
              { duration, delay, ease: motionTokens.easing.standard }
            ).then(() => release(icon));
          });
          item.querySelectorAll<HTMLElement>('[data-mo-label]').forEach((label) => {
            applyFirstFrame(label, { opacity: [0], y: [4] });
            animate(
              label,
              { opacity: [0, 1], y: [4, 0] },
              {
                duration: motionTokens.duration.base,
                delay: delay + duration * 0.6,
                ease: motionTokens.easing.standard,
              }
            ).then(() => release(label));
          });
        });
      },
      { amount: motionTokens.amount }
    );
    return stop;
  }, [variant, step, distance, duration, round]);

  return (
    <Tag ref={ref} data-mo="stagger" className={cn(className)}>
      {children}
    </Tag>
  );
}
