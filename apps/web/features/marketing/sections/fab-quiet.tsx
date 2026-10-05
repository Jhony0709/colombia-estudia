'use client';

/**
 * Calla el latido del botón de WhatsApp para el resto de la sesión en cuanto la persona lo
 * toca, lo enfoca o pasa el ratón: ya lo vio (WCAG 2.2.2, poder detener lo que se mueve solo).
 */

import { useEffect } from 'react';

const KEY = 'alba.fab.quiet';

export function FabQuiet() {
  useEffect(() => {
    const fab = document.querySelector<HTMLElement>('.site-fab');
    if (!fab) return;
    const quiet = () => {
      fab.setAttribute('data-quiet', '');
      try {
        window.sessionStorage.setItem(KEY, '1');
      } catch {
        // Sin almacenamiento: se calla solo en esta página.
      }
    };
    try {
      if (window.sessionStorage.getItem(KEY) === '1') fab.setAttribute('data-quiet', '');
    } catch {
      // Ídem.
    }
    const events = ['pointerenter', 'focus', 'click'] as const;
    events.forEach((name) => fab.addEventListener(name, quiet, { once: true }));
    return () => events.forEach((name) => fab.removeEventListener(name, quiet));
  }, []);
  return null;
}
