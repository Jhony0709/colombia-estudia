'use client';

/**
 * La cabecera fija cambia al despegarse del borde (5/10): fondo translúcido con desenfoque y el
 * borde inferior que aparece (`.site-header.is-stuck`, site.css). La altura no cambia: encoger
 * la cabecera movería toda la página bajo el dedo. Las revelaciones viven en `motion/`.
 */

import { useEffect } from 'react';

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
