'use client';

/**
 * Aparición discreta al entrar en pantalla. El estado inicial oculto lo pone el CSS solo
 * bajo `@media (scripting: enabled)` y sin `prefers-reduced-motion`, así que sin JavaScript,
 * o con movimiento reducido, todo se ve desde el principio: este componente solo añade una
 * clase, nunca decide la visibilidad.
 */

import { useEffect, useRef, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function Reveal({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!('IntersectionObserver' in window)) {
      el.classList.add('is-in');
      return;
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          el.classList.add('is-in');
          io.disconnect();
        }
      },
      { rootMargin: '0px 0px -8% 0px' }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={ref} className={cn('reveal', className)}>
      {children}
    </div>
  );
}

/** Pone `is-stuck` en la cabecera fija cuando la página ya no está arriba del todo. */
export function StickyHeaderShadow() {
  useEffect(() => {
    const header = document.querySelector<HTMLElement>('.site-header');
    if (!header) return;
    const update = () => header.classList.toggle('is-stuck', window.scrollY > 8);
    update();
    window.addEventListener('scroll', update, { passive: true });
    return () => window.removeEventListener('scroll', update);
  }, []);
  return null;
}
