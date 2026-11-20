'use client';

/**
 * Las escenas del contenido (14/11, `:::escena` en el Markdown): el servidor manda la lista;
 * aquí cada elemento recibe su posición (`--i`) y la escena se anima al entrar en vista: los
 * pasos aparecen en orden, el ciclo resalta uno tras otro sin parar y la línea de tiempo se
 * despliega; las columnas y las ramas (19/11) sueltan después sus puntos (`--j`). Sin JS, con
 * movimiento reducido o sin IntersectionObserver: la lista quieta.
 */

import { useEffect } from 'react';
import { motionReduced } from '@/lib/motion/preference';

/** `watch`: cuando cambia (la vista previa del editor), se vuelven a buscar las escenas. */
export function Escenas({ watch }: { watch?: string } = {}) {
  useEffect(() => {
    const escenas = document.querySelectorAll<HTMLElement>('.contenido .escena');
    if (escenas.length === 0 || motionReduced() || !('IntersectionObserver' in window)) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          (entry.target as HTMLElement).dataset.escena = 'viva';
          observer.unobserve(entry.target);
        }
      },
      { rootMargin: '0px 0px -15% 0px' }
    );
    for (const escena of escenas) {
      const items = escena.querySelectorAll<HTMLElement>(':scope > ol > li, :scope > ul > li');
      items.forEach((item, i) => {
        item.style.setProperty('--i', String(i));
        // Sublistas (`comparar`, `mapa`): cada punto con su posición dentro de su rama.
        item
          .querySelectorAll<HTMLElement>(':scope > ul > li, :scope > ol > li')
          .forEach((sub, j) => sub.style.setProperty('--j', String(j)));
      });
      escena.style.setProperty('--n', String(items.length));
      escena.dataset.escena = 'pendiente';
      observer.observe(escena);
    }
    return () => observer.disconnect();
  }, [watch]);
  return null;
}
