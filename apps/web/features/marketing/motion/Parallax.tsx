'use client';

/**
 * Parallax de lo decorativo, nunca de texto (5/10): el elemento se desplaza `distance` px
 * mientras su sección cruza la pantalla. Rango pequeño (±40 px). Solo en escritorio con ratón y
 * sin movimiento reducido; en el teléfono no hay. `scroll()` de Motion usa ScrollTimeline del
 * navegador cuando existe: va por el compositor, no por JavaScript en cada fotograma.
 */

import { useEffect, useRef, type ReactNode } from 'react';
import { animate, scroll } from 'motion';
import { cn } from '@/lib/utils';
import { canParallax } from './env';

export function Parallax({
  children,
  distance,
  decorative = true,
  className,
}: {
  children: ReactNode;
  /** px al terminar de cruzar; negativo sube. */
  distance: number;
  /** `false` si dentro hay contenido con nombre (la foto del hero y su `alt`). */
  decorative?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || !canParallax()) return;
    const section = el.closest('section') ?? el;
    return scroll(animate(el, { y: [0, distance] }, { ease: 'linear' }), {
      target: section,
      offset: ['start start', 'end start'],
    });
  }, [distance]);

  return (
    <div ref={ref} aria-hidden={decorative || undefined} className={cn(className)}>
      {children}
    </div>
  );
}
