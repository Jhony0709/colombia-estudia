'use client';

/**
 * Le pasa el nonce de la CSP a las librerías que inyectan `<style>` por su cuenta (25/9).
 * SSOT: middleware.ts (`buildCsp`: `style-src 'self' 'nonce-…'`, sin `'unsafe-inline'`).
 *
 * El bloqueo de scroll de Radix (`react-remove-scroll` → `react-style-singleton`) añade al
 * abrir un diálogo una hoja `.with-scroll-bars-hidden { … }` en un `<style>` propio. Sin
 * nonce, la CSP la rechaza: en staging salía «Applying inline style violates … style-src»
 * con el hash exacto de esa hoja, y el fondo del diálogo seguía haciendo scroll. Esas
 * librerías leen el nonce de `get-nonce`, así que basta con dárselo una vez, antes de que
 * se abra el primer diálogo: este componente vive en el layout raíz y no pinta nada.
 *
 * Se llama en el render y no en un efecto a propósito: el `<style>` se inyecta en un
 * `useLayoutEffect`/`useEffect` del diálogo, y un efecto del layout raíz correría DESPUÉS
 * de los de sus hijos.
 */

import { setNonce } from 'get-nonce';

let applied: string | null = null;

export function StyleNonce({ nonce }: { nonce: string | null }) {
  if (nonce && applied !== nonce) {
    setNonce(nonce);
    applied = nonce;
  }
  return null;
}
