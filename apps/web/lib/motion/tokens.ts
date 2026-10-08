/**
 * Los tokens de motion leídos en el navegador (6/10), para lo que se anima con JS (tecleo,
 * conteo). Una sola fuente: las variables CSS del plugin de design-tokens.
 */

/** `--duration-normal` → 300. Vacía o ilegible → 0: sin token no se anima. */
export function readDuration(name: `--duration-${string}`): number {
  if (typeof window === 'undefined') return 0;
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const value = Number.parseFloat(raw);
  if (!Number.isFinite(value)) return 0;
  return raw.endsWith('ms') ? value : raw.endsWith('s') ? value * 1000 : 0;
}

/** `--easing-enter` → `[0, 0, 0.2, 1]`, para `animate` de motion. Ilegible → lineal. */
export function readEasing(name: `--easing-${string}`): [number, number, number, number] {
  if (typeof window === 'undefined') return [0, 0, 1, 1];
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name);
  const parts = raw
    .match(/cubic-bezier\(([^)]+)\)/)?.[1]
    ?.split(',')
    .map(Number);
  return parts && parts.length === 4 && parts.every(Number.isFinite)
    ? [parts[0]!, parts[1]!, parts[2]!, parts[3]!]
    : [0, 0, 1, 1];
}

/** `--motion-distance-sm` → px (los `rem` se pasan con el tamaño de la raíz). Ilegible → 0. */
export function readLength(name: `--motion-${string}`): number {
  if (typeof window === 'undefined') return 0;
  const root = getComputedStyle(document.documentElement);
  const raw = root.getPropertyValue(name).trim();
  const value = Number.parseFloat(raw);
  if (!Number.isFinite(value)) return 0;
  if (raw.endsWith('rem')) return value * Number.parseFloat(root.fontSize);
  return raw.endsWith('px') ? value : 0;
}
