'use client';

/**
 * Un chat se lee desde abajo (5/11): al abrirlo se ve lo último con la caja de respuesta, y si
 * llega algo nuevo se baja suave solo cuando ya se estaba al final; si alguien sube a releer,
 * no se le mueve la página.
 */

import { useEffect, useRef } from 'react';

const NEAR_BOTTOM = 160;

export function ScrollToLatest({ count }: { count: number }) {
  const first = useRef(true);
  // Se mide al hacer scroll, no al llegar el mensaje: para entonces la página ya creció.
  const atBottom = useRef(true);

  useEffect(() => {
    const onScroll = () => {
      atBottom.current =
        window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - NEAR_BOTTOM;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (!first.current && !atBottom.current) return;
    const reduced =
      window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
      document.documentElement.dataset.motion === 'reduced';
    window.scrollTo({
      top: document.documentElement.scrollHeight,
      behavior: first.current || reduced ? 'auto' : 'smooth',
    });
    first.current = false;
  }, [count]);

  return null;
}
