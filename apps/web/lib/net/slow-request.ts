'use client';

/**
 * Una espera de red que se ve (E1 de la decisión del estudiante, 23/9).
 *
 * El patrón único para toda acción del estudiante que espera al servidor: se pulsa, el
 * botón dice que está en ello; si tarda más de `slowAfterMs`, la pantalla lo dice («está
 * tardando más de lo normal, no cierres esta pantalla»); si falla, lo dice y ofrece
 * reintentar **sin haber perdido nada** (el texto y el archivo elegidos siguen en su sitio:
 * eso lo garantiza cada formulario, no este hook). No aborta: una petición lenta puede
 * llegar, y abortarla y repetirla es la forma de crear entregas dobles.
 *
 * `slowAfterMs` no es un token UX: es provisional hasta que la telemetría diga cuánto tarda
 * cada acción de verdad (decisión E1, confianza baja). Por eso hay **un** valor por defecto
 * en un solo sitio y cada acción manda su duración (`student.request.finished`).
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  trackStudentEvent,
  type StudentAction,
  type StudentRequest,
  type StudentScreen,
} from '@/lib/telemetry/student-events';

/** Provisional: se revisa con `student.request.finished` en la mano. */
export const SLOW_AFTER_MS = 6_000;

export type RequestPhase = 'idle' | 'busy' | 'slow' | 'failed';

export interface SlowRequest {
  phase: RequestPhase;
  /** Segundos que lleva la petición en vuelo (solo mientras `busy`/`slow`). */
  elapsedSeconds: number;
  /** Ejecuta `work`; devuelve su resultado o `undefined` si lanzó. */
  run: <T>(work: () => Promise<T>) => Promise<T | undefined>;
  /** Vuelve a `idle` (tras un error mostrado, por ejemplo al editar el formulario). */
  reset: () => void;
}

export function useSlowRequest({
  screen,
  action,
  request,
  slowAfterMs = SLOW_AFTER_MS,
}: {
  /** Dónde y qué acción es, para la telemetría. */
  screen: StudentScreen;
  action: StudentAction;
  request: StudentRequest;
  slowAfterMs?: number;
}): SlowRequest {
  const [phase, setPhase] = useState<RequestPhase>('idle');
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const startedAt = useRef<number | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopClock = useCallback(() => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    startedAt.current = null;
    setElapsedSeconds(0);
  }, []);

  useEffect(() => stopClock, [stopClock]);

  const run = useCallback(
    async <T>(work: () => Promise<T>): Promise<T | undefined> => {
      startedAt.current = Date.now();
      setPhase('busy');
      setElapsedSeconds(0);
      timer.current = setInterval(() => {
        if (startedAt.current === null) return;
        const ms = Date.now() - startedAt.current;
        setElapsedSeconds(Math.floor(ms / 1000));
        if (ms >= slowAfterMs) setPhase((p) => (p === 'busy' ? 'slow' : p));
      }, 1000);

      const began = startedAt.current;
      try {
        const result = await work();
        const ms = Date.now() - began;
        trackStudentEvent('student.request.finished', {
          screen,
          action,
          request,
          outcome: ms >= slowAfterMs ? 'slow_ok' : 'ok',
          durationMs: ms,
        });
        setPhase('idle');
        return result;
      } catch {
        trackStudentEvent('student.request.finished', {
          screen,
          action,
          request,
          outcome: 'failed',
          durationMs: Date.now() - began,
        });
        setPhase('failed');
        return undefined;
      } finally {
        stopClock();
      }
    },
    [screen, action, request, slowAfterMs, stopClock]
  );

  const reset = useCallback(() => setPhase('idle'), []);

  return { phase, elapsedSeconds, run, reset };
}
