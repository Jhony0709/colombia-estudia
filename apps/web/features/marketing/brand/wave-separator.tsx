import { cn } from '@/lib/utils';
import { AnimatedWave } from '../motion/AnimatedWave';

/**
 * Separador entre secciones (5/10): una onda en vez de una línea recta, para que la portada se
 * lea como un camino y no como bloques sueltos. Reutilizable: `from` es el color de la sección de
 * arriba, `to` el de la de abajo, y `variant` cambia la dirección para que dos seguidos no se
 * repitan. `accent` añade la estela de color de la marca detrás de la onda.
 *
 * `cut`: en vez de pintar la sección de abajo, recorta la de arriba sobre fondo transparente,
 * para cuando lo de abajo es una foto (el CTA final): la onda se dibuja con `from` por encima.
 *
 * SVG estirado (`preserveAspectRatio="none"`) con los colores de la piel (`--site-*`) como
 * atributos: sin estilos en línea (CSP). Decorativo.
 *
 * Movimiento: al entrar, la onda se descubre a lo ancho desde `origin` (alternar izquierda y
 * derecha entre secciones); con `cut`, en vez de eso sube la estela de color (`AnimatedWave`).
 */
type SiteSurface = 'white' | 'canvas' | 'tint' | 'navy';

const SURFACE_VAR: Record<SiteSurface, string> = {
  white: 'var(--site-bg)',
  canvas: 'var(--site-canvas)',
  tint: 'var(--site-tint)',
  navy: 'var(--site-navy)',
};

const SURFACE_BG: Record<SiteSurface, string> = {
  white: 'bg-[var(--site-bg)]',
  canvas: 'bg-[var(--site-canvas)]',
  tint: 'bg-[var(--site-tint)]',
  navy: 'bg-[var(--site-navy)]',
};

// Cada variante: la onda principal (la superficie de abajo) y su estela, un poco más alta. La
// principal baja hasta 124, 4 por debajo del cuadro: el borde inferior nunca se antialiasa
// contra el fondo del separador (era la raya gris de un píxel entre secciones).
const SHAPES = {
  // Sube hacia la derecha.
  rise: {
    main: 'M0 124V92C260 112 520 110 780 80C1040 50 1240 30 1440 26V124Z',
    trail: 'M0 120V74C280 98 540 94 800 62C1060 32 1250 14 1440 10V124Z',
  },
  // Baja hacia la derecha.
  fall: {
    main: 'M0 124V30C210 34 410 54 660 84C910 112 1180 112 1440 96V124Z',
    trail: 'M0 120V14C220 18 420 36 680 66C930 96 1190 98 1440 78V124Z',
  },
  // Una loma suave.
  swell: {
    main: 'M0 124V84C240 46 520 26 780 40C1040 54 1240 86 1440 70V124Z',
    trail: 'M0 120V66C250 26 530 8 800 22C1060 36 1250 68 1440 50V124Z',
  },
} as const;

export function WaveSeparator({
  from,
  to,
  variant = 'rise',
  accent = 'none',
  tall = false,
  cut = false,
  origin = 'left',
  className,
}: {
  from: SiteSurface;
  /** Ignorado con `cut`. */
  to?: SiteSurface;
  variant?: keyof typeof SHAPES;
  accent?: 'none' | 'blue' | 'sun';
  tall?: boolean;
  cut?: boolean;
  /** Desde dónde se descubre al entrar. */
  origin?: 'left' | 'right';
  className?: string;
}) {
  const shape = SHAPES[variant];
  const trail =
    accent === 'sun' ? 'var(--site-yellow)' : accent === 'blue' ? 'var(--site-blue-light)' : null;
  // Con `cut`, la parte de arriba de la misma curva: de `M0 124V…V124Z` a `M0 0V…V0Z`.
  const top = shape.main.replace(/^M0 124V/, 'M0 0V').replace(/V124Z$/, 'V0Z');
  return (
    <div
      aria-hidden="true"
      className={cn(
        'site-separator',
        tall && 'site-separator--tall',
        !cut && SURFACE_BG[from],
        className
      )}
    >
      <AnimatedWave mode={cut ? 'rise' : 'separator'} origin={origin} className="absolute inset-0">
        <svg
          viewBox="0 0 1440 120"
          preserveAspectRatio="none"
          focusable="false"
          className="alba-wave h-full w-full overflow-visible"
        >
          {cut ? (
            <>
              {trail && (
                <g transform="translate(0 12)">
                  <path d={top} fill={trail} className="alba-wave__trail" />
                </g>
              )}
              <path d={top} fill={SURFACE_VAR[from]} />
            </>
          ) : (
            <>
              {trail && <path d={shape.trail} fill={trail} className="alba-wave__trail" />}
              <path d={shape.main} fill={SURFACE_VAR[to ?? 'white']} />
            </>
          )}
        </svg>
      </AnimatedWave>
    </div>
  );
}
