import { cn } from '@/lib/utils';

/**
 * Ondas de la marca ALBA (5/10): las del isotipo, en capas. Decorativas (`aria-hidden`).
 *
 * Un solo SVG estirado al ancho (`preserveAspectRatio="none"`): la altura la pone quien lo usa.
 * Cada capa lleva `alba-wave__layer--n` para animarla después sin tocar el marcado; hoy solo
 * suben al cargar el hero (site.css) y nada con movimiento reducido.
 *
 * - `hero`: cierra el hero subiendo hacia la derecha, bajo la foto (amarillo, azul claro, azul
 *   y la blanca delante, que es ya la sección siguiente).
 * - `side`: la que cruza la esquina inferior de una foto (`Volver a estudiar`).
 * - `story`: dos trazos que cruzan el óvalo de «Historias», sobre navy.
 */
const LAYERS = {
  hero: {
    viewBox: '0 0 1440 220',
    paths: [
      ['var(--site-yellow)', 'M720 220C930 150 1170 96 1440 62V220Z'],
      ['var(--site-blue-light)', 'M0 196C300 190 560 160 820 118C1060 80 1260 66 1440 72V220H0Z'],
      ['var(--site-blue)', 'M0 208C320 204 600 182 860 144C1100 110 1280 100 1440 106V220H0Z'],
      ['var(--site-bg)', 'M0 220V212C360 212 640 198 900 170C1140 144 1300 138 1440 144V220Z'],
    ],
  },
  side: {
    viewBox: '0 0 600 160',
    paths: [
      ['var(--site-blue-light)', 'M0 70C120 40 260 50 380 96C460 126 540 136 600 128V160H0Z'],
      ['var(--site-blue)', 'M0 104C140 76 280 86 400 122C480 146 550 152 600 148V160H0Z'],
      ['var(--site-bg)', 'M0 140C150 120 300 126 430 148C500 158 560 160 600 158V160H0Z'],
    ],
  },
  // Trazos, no rellenos (5/10): sobre navy, dos cintas que cruzan el óvalo por abajo.
  story: {
    viewBox: '0 0 600 200',
    strokes: [
      ['var(--site-blue)', 'M-10 150C160 92 340 84 610 120', 14],
      ['var(--site-yellow)', 'M-10 176C170 122 350 116 610 150', 6],
    ],
  },
} as const;

export type AlbaWaveVariant = keyof typeof LAYERS;

export function AlbaWave({ variant, className }: { variant: AlbaWaveVariant; className?: string }) {
  const layer = LAYERS[variant];
  const paths = 'paths' in layer ? layer.paths : [];
  const strokes = 'strokes' in layer ? layer.strokes : [];
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox={layer.viewBox}
      preserveAspectRatio="none"
      className={cn('alba-wave w-full', className)}
    >
      {paths.map(([fill, d], i) => (
        <path key={i} d={d} fill={fill} className={`alba-wave__layer alba-wave__layer--${i + 1}`} />
      ))}
      {strokes.map(([stroke, d, width], i) => (
        <path
          key={i}
          d={d}
          fill="none"
          stroke={stroke}
          strokeWidth={width}
          strokeLinecap="round"
          // Longitud normalizada: `AnimatedWave mode="draw"` lo dibuja con `stroke-dashoffset` 1 → 0.
          pathLength={1}
          strokeDasharray="1"
          className={`alba-wave__stroke alba-wave__stroke--${i + 1}`}
        />
      ))}
    </svg>
  );
}
