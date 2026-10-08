'use client';

/**
 * Conteo (6/10, experiencia-colombia-estudia §2): el número sube hasta su valor en
 * `duration.normal`, una vez. El valor final está en el DOM desde el servidor para el lector
 * de pantalla; lo que cambia va `aria-hidden`. Con movimiento reducido, el valor sin más.
 */

import { useEffect, useRef, useState } from 'react';
import { animate } from 'motion';
import { motionReduced } from '@/lib/motion/preference';
import { readDuration, readEasing } from '@/lib/motion/tokens';

const format = (value: number, decimals: number) =>
  new Intl.NumberFormat('es-CO', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);

export function CountUp({
  value,
  decimals = 0,
  className,
}: {
  value: number;
  decimals?: number;
  className?: string;
}) {
  const final = format(value, decimals);
  const [shown, setShown] = useState(final);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const duration = readDuration('--duration-normal');
    // Con la pestaña oculta no hay frames: el número se quedaría a medias.
    if (motionReduced() || document.hidden || duration === 0 || value === 0) return;

    let controls: ReturnType<typeof animate> | null = null;
    const run = () => {
      controls = animate(0, value, {
        duration: duration / 1000,
        ease: readEasing('--easing-enter'),
        onUpdate: (latest) => setShown(format(latest, decimals)),
      });
    };

    const el = ref.current;
    if (!el || !('IntersectionObserver' in window)) {
      run();
      return () => controls?.stop();
    }
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((e) => e.isIntersecting)) return;
      observer.disconnect();
      run();
    });
    observer.observe(el);
    return () => {
      observer.disconnect();
      controls?.stop();
    };
  }, [value, decimals]);

  return (
    <span ref={ref} className={className}>
      <span className="sr-only">{final}</span>
      <span aria-hidden="true" className="tabular-nums">
        {shown}
      </span>
    </span>
  );
}
