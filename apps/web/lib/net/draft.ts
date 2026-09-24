'use client';

/**
 * Borrador local de un texto que la persona está escribiendo (E1, 23/9): se guarda en
 * `localStorage` al escribir y se recupera al volver, para que una recarga, un cierre del
 * navegador o una petición que nunca contestó no se lleven lo escrito. Un archivo elegido
 * no se puede guardar así: se conserva en memoria mientras la pantalla siga abierta, y la
 * pantalla lo dice.
 *
 * Claves por persona no hacen falta: el navegador del celular es de una persona, y el
 * borrador se borra al confirmar el envío. Sin datos sensibles: es el texto de una actividad.
 */

import { useCallback, useEffect, useState } from 'react';

const PREFIX = 'ce.draft.';

export function useDraft(key: string, initial: string) {
  const storageKey = `${PREFIX}${key}`;
  const [text, setText] = useState(initial);
  const [restored, setRestored] = useState(false);

  // Al montar: si hay borrador y difiere de lo que trajo el servidor, se usa y se avisa.
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(storageKey);
      if (saved !== null && saved !== initial && saved.trim() !== '') {
        setText(saved);
        setRestored(true);
      }
    } catch {
      // Sin almacenamiento (modo privado, cuota): se escribe igual, sin borrador.
    }
    // Solo al montar: `initial` cambia con el refresh del servidor y no debe pisar lo escrito.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  const update = useCallback(
    (next: string) => {
      setText(next);
      setRestored(false);
      try {
        if (next.trim() === '') window.localStorage.removeItem(storageKey);
        else window.localStorage.setItem(storageKey, next);
      } catch {
        // Ídem.
      }
    },
    [storageKey]
  );

  const clear = useCallback(() => {
    setRestored(false);
    try {
      window.localStorage.removeItem(storageKey);
    } catch {
      // Ídem.
    }
  }, [storageKey]);

  return { text, setText: update, clear, restored };
}
