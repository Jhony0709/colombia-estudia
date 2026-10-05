'use client';

/**
 * El «Siguiente» de un tema de lectura que todavía no se puede dejar (5/10): deshabilitado,
 * con lo que falta escrito en el propio botón —la cuenta atrás o «Lee hasta el final»—.
 *
 * Cuenta lo mismo que el servidor: segundos con la pestaña visible, tomando el mayor entre lo
 * guardado y lo de esta visita (`mergeEvidence`). El reloj lo lleva `evidence-recorder.tsx`;
 * aquí solo se escucha. Cuando todo está cumplido, el recorder manda la evidencia y el
 * `router.refresh()` pinta el «Siguiente» de verdad en lugar de este.
 */

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ArrowDown, Clock3 } from 'lucide-react';
import { Button } from '@/components/atoms/button';
import { READING_EVENT, type ReadingDetail } from './evidence-recorder';

const clock = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

export function ReadingCountdown({
  requiredSeconds,
  savedSeconds,
  savedScrolled,
}: {
  requiredSeconds: number;
  savedSeconds: number;
  savedScrolled: boolean;
}) {
  const t = useTranslations('learn.lesson');
  const [reading, setReading] = useState<ReadingDetail>({ seconds: 0, scrolledToEnd: false });

  useEffect(() => {
    const onReading = (event: Event) => setReading((event as CustomEvent<ReadingDetail>).detail);
    window.addEventListener(READING_EVENT, onReading);
    return () => window.removeEventListener(READING_EVENT, onReading);
  }, []);

  const remaining = Math.max(0, requiredSeconds - Math.max(savedSeconds, reading.seconds));
  const scrolled = savedScrolled || reading.scrolledToEnd;

  if (remaining > 0) {
    return (
      <Button disabled>
        <Clock3 aria-hidden className="size-4 shrink-0" />
        <span className="tabular-nums">{t('nextIn', { time: clock(remaining) })}</span>
      </Button>
    );
  }

  if (!scrolled) {
    return (
      <Button disabled>
        {t('readToEnd')}
        <ArrowDown aria-hidden className="size-4 shrink-0" />
      </Button>
    );
  }

  // Cumplido: falta la respuesta del servidor (un instante, o el siguiente intento sin red).
  return <Button loading>{t('nextSaving')}</Button>;
}
