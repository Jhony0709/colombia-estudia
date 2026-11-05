'use client';

/**
 * Un chat se lee desde abajo (5/11): al abrirlo se ve lo último, y si llega algo nuevo se baja
 * solo cuando ya se estaba al final; si alguien sube a releer, no se le mueve la página.
 */

import { useEffect, useRef } from 'react';

export function ScrollToLatest({ count }: { count: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const first = useRef(true);
  useEffect(() => {
    const atBottom =
      window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 400;
    if (first.current || atBottom) ref.current?.scrollIntoView({ block: 'end' });
    first.current = false;
  }, [count]);
  return <div ref={ref} aria-hidden />;
}
