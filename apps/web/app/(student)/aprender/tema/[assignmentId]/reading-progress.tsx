'use client';

/**
 * Avance de lectura (27/9): una línea fina pegada al borde superior que se llena a medida que
 * el texto del tema pasa por la pantalla. Dice «cuánto queda» sin mirar la barra de scroll,
 * que en el teléfono no existe.
 *
 * Mide el `<article>` del tema, no la página: la ruta plegada, la actividad y el pie no son
 * lectura. Empieza en 0 cuando el artículo asoma por arriba y llega a 100 cuando su final
 * entra en pantalla; si el artículo cabe entero, no hay nada que medir y no se pinta.
 *
 * Es el mismo `ProgressBar` (SVG, atributo `width`) de la ruta y de `/aprender`: la CSP no
 * admite `style` en línea, así que un `div` con `width: 37%` no es opción. Sin transición a
 * propósito: sigue al scroll; una animación detrás del dedo se siente como retraso.
 */

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ProgressBar } from '@/components/atoms/progress-bar';

export function ReadingProgress() {
  const t = useTranslations('learn.lesson');
  const [percent, setPercent] = useState<number | null>(null);

  useEffect(() => {
    const article = document.querySelector('article');
    if (!article) return;

    let frame = 0;
    const measure = () => {
      frame = 0;
      const rect = article.getBoundingClientRect();
      const viewport = window.innerHeight;
      // Distancia que el lector recorre entre «el artículo empieza arriba» y «su final está
      // abajo». Si es cero o negativa, cabe entero.
      const distance = rect.height - viewport;
      if (distance <= 0) {
        setPercent(null);
        return;
      }
      const scrolled = -rect.top;
      setPercent(Math.max(0, Math.min(100, (scrolled / distance) * 100)));
    };
    const schedule = () => {
      if (frame === 0) frame = window.requestAnimationFrame(measure);
    };

    measure();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    return () => {
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      if (frame !== 0) window.cancelAnimationFrame(frame);
    };
  }, []);

  if (percent === null) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-20">
      <ProgressBar percent={percent} label={t('readingProgress')} className="h-1 rounded-none" />
    </div>
  );
}
