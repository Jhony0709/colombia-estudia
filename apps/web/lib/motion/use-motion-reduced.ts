'use client';

/**
 * ¿Movimiento reducido? Del sistema (`useReducedMotion` de motion) o de la plataforma
 * (`html[data-motion="reduced"]`, 6/10). Para lo que anima `motion/react`: el CSS ya lo corta
 * la regla global de `globals.css`.
 */

import { useEffect, useState } from 'react';
import { useReducedMotion } from 'motion/react';

export function useMotionReduced(): boolean {
  const system = useReducedMotion() === true;
  const [platform, setPlatform] = useState(false);

  useEffect(() => {
    const html = document.documentElement;
    const read = () => setPlatform(html.dataset.motion === 'reduced');
    read();
    const observer = new MutationObserver(read);
    observer.observe(html, { attributes: true, attributeFilter: ['data-motion'] });
    return () => observer.disconnect();
  }, []);

  return system || platform;
}
