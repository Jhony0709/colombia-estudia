import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { pulse } from './api';

export const PULSE_MS = 5_000;

/** Como `/mensajes`: cada 5 s, solo en primer plano; `onChange` cuando la huella cambia. */
export function usePulse(id: string | undefined, onChange: () => void) {
  const changed = useRef(onChange);
  useEffect(() => {
    changed.current = onChange;
  });

  useEffect(() => {
    let last: string | null = null;
    let timer: ReturnType<typeof setInterval> | null = null;
    const tick = () =>
      pulse(id)
        .then((stamp) => {
          if (last !== null && stamp !== last) changed.current();
          last = stamp;
        })
        .catch(() => undefined);
    const start = () => {
      if (timer) return;
      void tick();
      timer = setInterval(tick, PULSE_MS);
    };
    const stop = () => {
      if (timer) clearInterval(timer);
      timer = null;
    };
    if (AppState.currentState === 'active') start();
    const subscription = AppState.addEventListener('change', (now) => {
      if (now === 'active') {
        changed.current();
        start();
      } else stop();
    });
    return () => {
      stop();
      subscription.remove();
    };
  }, [id]);
}
