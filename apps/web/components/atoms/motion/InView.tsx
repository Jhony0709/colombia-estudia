'use client';

/**
 * Entrada al entrar en vista (6/10, experiencia-colombia-estudia §5), solo para bloques bajo
 * el pliegue. Sale del servidor visible: al hidratar, si el bloque está fuera de la pantalla
 * se marca pendiente (el CSS lo oculta) y entra cuando aparece. Lo que ya se ve al cargar no
 * se toca. Sin JS, con movimiento reducido, con la pestaña oculta (no hay frames que observar)
 * o sin IntersectionObserver: visible siempre.
 */

import { useEffect, useRef, type ReactNode } from 'react';
import { motionReduced } from '@/lib/motion/preference';
import { cn } from '@/lib/utils';

export function InView({
  children,
  className,
  as: Tag = 'div',
}: {
  children: ReactNode;
  className?: string;
  as?: 'div' | 'section' | 'li';
}) {
  const ref = useRef<HTMLDivElement>(null);
  const Component = Tag as 'div';

  useEffect(() => {
    const el = ref.current;
    if (!el || motionReduced() || document.hidden || !('IntersectionObserver' in window)) return;
    if (el.getBoundingClientRect().top < window.innerHeight) return;

    el.dataset.motionPending = '';
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        delete el.dataset.motionPending;
        el.dataset.motionIn = '';
        observer.disconnect();
      },
      { rootMargin: '0px 0px -10% 0px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <Component ref={ref} className={cn('motion-inview', className)}>
      {children}
    </Component>
  );
}
