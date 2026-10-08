/**
 * Movimiento reducido elegido en la plataforma (6/10, experiencia-colombia-estudia P9).
 *
 * Mismo camino que el tema (`lib/theme/theme.ts`): cookie que el layout raíz lee para sacar
 * `data-motion="reduced"` en el `<html>` del servidor, sin un fotograma animado de más. El
 * `--reading-motion` de `preferences-provider.tsx` se escribía y nadie lo leía.
 */

export const MOTION_COOKIE = 'ce-motion';

export type MotionPreference = 'system' | 'reduced';

export function toMotionPreference(value: string | undefined | null): MotionPreference {
  return value === 'reduced' ? 'reduced' : 'system';
}

const ONE_YEAR = 60 * 60 * 24 * 365;

/** Desde el navegador: el atributo ya, la cookie para la próxima carga. */
export function applyMotionPreference(next: MotionPreference): void {
  const html = document.documentElement;
  if (next === 'reduced') html.dataset.motion = 'reduced';
  else delete html.dataset.motion;
  document.cookie = `${MOTION_COOKIE}=${next}; path=/; max-age=${ONE_YEAR}; SameSite=Lax`;
}

/** Lo que deciden juntos el sistema operativo y la plataforma, en el navegador. */
export function motionReduced(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    document.documentElement.dataset.motion === 'reduced' ||
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
  );
}
