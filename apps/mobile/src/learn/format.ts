// Fechas y dinero como los pinta la web (es-CO, hora de Bogotá).
const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** Un día suelto (`2026-12-01`) es ese día, no la medianoche UTC del anterior en Bogotá. */
export function longDate(iso: string): string {
  if (DAY.test(iso)) {
    const [y, m, d] = iso.split('-').map(Number) as [number, number, number];
    return new Date(y, m - 1, d).toLocaleDateString('es-CO', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  }
  return new Date(iso).toLocaleDateString('es-CO', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'America/Bogota',
  });
}

export const money = (amount: number) =>
  new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(amount);
