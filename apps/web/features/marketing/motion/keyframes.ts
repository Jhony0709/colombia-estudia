/**
 * Las entradas con nombre (5/10): cada primitivo elige una y no inventa la suya.
 */
import { isCompact } from './env';
import { motionTokens } from './tokens';

export type RevealVariant =
  | 'fade'
  | 'fade-up'
  | 'slide-left'
  | 'slide-right'
  | 'mask'
  /** Solo escala, de 1.04 a 1: un fondo que se asienta (el paisaje del cierre). */
  | 'settle'
  /** Solo escala, de .96 a 1: el sol del cierre. */
  | 'grow';
export type MaskFrom = 'bottom' | 'top' | 'left' | 'right';

/** `fade-up` sube; `slide-left` entra moviéndose hacia la izquierda (desde la derecha). */
export function revealKeyframes(variant: RevealVariant, distance?: number) {
  const d = isCompact()
    ? Math.min(distance ?? motionTokens.distance.enter, motionTokens.distance.compact)
    : (distance ?? motionTokens.distance.enter);
  switch (variant) {
    case 'fade':
      return { opacity: [0, 1] };
    case 'fade-up':
      return { opacity: [0, 1], y: [d, 0] };
    case 'slide-left':
      return { opacity: [0, 1], x: [d, 0] };
    case 'slide-right':
      return { opacity: [0, 1], x: [-d, 0] };
    case 'mask':
      return { clipPath: maskFrames('bottom') };
    case 'settle':
      return { scale: [1.04, 1] };
    case 'grow':
      return { scale: [0.96, 1] };
  }
}

/**
 * La foto se descubre desde un borde. `round` mantiene las esquinas redondeadas del hueco
 * durante el recorte; al terminar, el recorte queda abierto del todo.
 */
export function maskFrames(from: MaskFrom, round = '0px') {
  const closed = {
    bottom: 'inset(100% 0% 0% 0%',
    top: 'inset(0% 0% 100% 0%',
    left: 'inset(0% 100% 0% 0%',
    right: 'inset(0% 0% 0% 100%',
  }[from];
  return [`${closed} round ${round})`, `inset(0% 0% 0% 0% round ${round})`];
}

type Frames = Partial<
  Record<'opacity' | 'x' | 'y' | 'scale' | 'clipPath', ReadonlyArray<number | string>>
>;

/**
 * Pone el primer fotograma en línea (CSSOM: la CSP lo permite) antes de quitar la ocultación
 * del CSS, para que durante el retardo de un escalonado no se vea el estado final un instante.
 */
export function applyFirstFrame(el: HTMLElement | SVGElement, frames: Frames) {
  const first = <T>(v: ReadonlyArray<T> | undefined) => (v ? v[0] : undefined);
  const opacity = first(frames.opacity);
  if (opacity !== undefined) el.style.opacity = String(opacity);
  const x = first(frames.x);
  const y = first(frames.y);
  const scale = first(frames.scale);
  const parts = [
    x !== undefined ? `translateX(${x}px)` : '',
    y !== undefined ? `translateY(${y}px)` : '',
    scale !== undefined ? `scale(${scale})` : '',
  ].filter(Boolean);
  if (parts.length) el.style.transform = parts.join(' ');
  const clip = first(frames.clipPath);
  if (clip !== undefined) el.style.clipPath = String(clip);
}

/**
 * Al terminar, devuelve el elemento al CSS: sin estilos en línea que tapen después un hover
 * (`translateY(-4px)` de una tarjeta) o un recorte de la máscara de la foto.
 */
export function release(el: HTMLElement | SVGElement) {
  el.style.opacity = '';
  el.style.transform = '';
  el.style.clipPath = '';
}
