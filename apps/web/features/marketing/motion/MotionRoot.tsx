'use client';

/**
 * La raíz del movimiento de la portada (5/10). Hasta que hidrata, todo se ve: el HTML del
 * servidor no oculta nada (sin JavaScript, la portada está entera). Al hidratar:
 *
 * 1. lo que ya está en pantalla se marca como revelado, sin animar (nada parpadea);
 * 2. se pone `data-mo-ready` en `.site`, y desde ahí el CSS oculta lo que espera su turno;
 * 3. cada primitivo (`Reveal`, `Stagger`, `MaskReveal`…) lo anima al entrar en pantalla.
 *
 * Los dos primeros pasos van en la misma tarea: entre ellos no hay un pintado. Con movimiento
 * reducido no se hace nada: no hay `data-mo-ready` y nada se oculta.
 */

import { useEffect } from 'react';
import { markIn, prefersReducedMotion } from './env';

export function MotionRoot() {
  useEffect(() => {
    const root = document.querySelector<HTMLElement>('.site');
    if (!root || prefersReducedMotion()) return;
    const height = window.innerHeight;
    root.querySelectorAll('[data-mo]').forEach((el) => {
      const rect = el.getBoundingClientRect();
      if (rect.top < height && rect.bottom > 0) markIn(el);
    });
    root.setAttribute('data-mo-ready', '');
  }, []);
  return null;
}
