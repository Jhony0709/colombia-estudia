/**
 * Type definitions for semantic design tokens.
 * SSOT: reference/03-ui/tokens.md
 *
 * These are the NAMES from the contract. Values are in values/*.ts
 */

export interface SurfaceTokens {
  canvas: string;
  base: string;
  sunken: string;
  raised: string;
  note: string;
}

export interface TextTokens {
  default: string;
  muted: string;
  subtle: string;
  onAccent: string;
  link: string;
}

export interface AccentTokens {
  base: string;
  hover: string;
  active: string;
}

export interface StatusTokens {
  base: string;
  muted: string;
  onBase: string;
}

export interface BorderTokens {
  default: string;
  muted: string;
}

export interface SemanticColorTokens {
  surface: SurfaceTokens;
  text: TextTokens;
  accent: AccentTokens;
  border: BorderTokens;
  status: {
    success: StatusTokens;
    warning: StatusTokens;
    error: StatusTokens;
    info: StatusTokens;
    locked: StatusTokens;
    legacy: StatusTokens;
  };
  focus: {
    ring: string;
  };
  /**
   * Colores de marca, sin semántica de estado. `yellow` y `red` son decorativos (logo,
   * subrayado de títulos, formas de la web pública) y quedan fuera del contrato; `yellow`
   * es además el fondo del CTA de la web pública, y por eso `onYellow` sí está en el contrato.
   */
  brand: {
    yellow: string;
    onYellow: string;
    red: string;
  };
}

export interface TypographyScale {
  size: string;
  lineHeight: string;
  weight: number;
  letterSpacing?: string;
}

export interface TypographyTokens {
  display: TypographyScale;
  heading: TypographyScale;
  subheading: TypographyScale;
  body: TypographyScale;
  data: TypographyScale;
  caption: TypographyScale;
  overline: TypographyScale;
}

export interface SpaceTokens {
  1: string;
  2: string;
  3: string;
  4: string;
  6: string;
  8: string;
  12: string;
}

export interface RadiusTokens {
  control: string;
  card: string;
  sheet: string;
  pill: string;
}

export interface SizeTokens {
  /** El objetivo presionable mínimo. 44 px, y no se negocia donde hay un dedo. */
  touchMin: string;
  /** Lo ancho que puede ser un párrafo antes de que cueste volver al principio de la línea. */
  readingWidth: string;
  /** La columna de navegación lateral del área de staff. */
  sidenavWidth: string;
  /** Lo ancho que llega a ser el contenido de una pantalla, sin contar la navegación. */
  contentMax: string;
}

/**
 * Densidad: lo mismo, más apretado o más suelto, sin componentes distintos.
 *
 * Existe porque una pantalla de operaciones —una tabla de doscientas personas en un portátil
 * con ratón— y el player de un estudiante en un celular no quieren el mismo alto de fila, y
 * hasta hoy la única salida era inventar variantes de cada componente.
 *
 * **El límite no es estético.** `compact` baja de `touchMin` y por eso solo se permite donde
 * el puntero es un ratón: pantallas de staff en escritorio. Nunca en el player, el intento,
 * la cartera ni nada que se use con el dedo, y nunca por debajo de 24 px, que es el mínimo
 * de WCAG 2.2 SC 2.5.8 en nivel AA. La regla está en
 * `reference/03-ui/layout-y-componentes.md` §6.
 */
export interface DensityTokens {
  /** Alto de un control: botón, campo, fila de menú. */
  controlHeight: string;
  /** Alto de una fila de datos. */
  rowHeight: string;
  /** Separación entre controles relacionados. */
  gap: string;
}

export interface DensityScale {
  /** Solo escritorio con ratón. Baja de `touchMin` a propósito. */
  compact: DensityTokens;
  /** Lo que se usa si nadie dice lo contrario. Respeta `touchMin`. */
  default: DensityTokens;
  /** Formularios largos, primer uso, pantallas de una sola tarea. */
  comfortable: DensityTokens;
}

/**
 * La sombra dice «esto flota», no «esto es importante».
 *
 * Eran `0..3`. Un número no dice cuándo usarlo, así que quien escribe una pantalla elige el
 * que le parece y acaba habiendo cuatro alturas sin significado. Ahora solo hay las tres que
 * corresponden a una diferencia real: nada, algo que flota sobre la página, y algo que la
 * tapa. Agrupar es trabajo del borde (`reference/03-ui/layout-y-componentes.md` §3).
 */
export interface ElevationTokens {
  /** Campos, filas, la barra lateral: está en el flujo y no se despega de nada. */
  none: string;
  /**
   * Una tarjeta en reposo sobre el lienzo.
   *
   * **La tarjeta sigue agrupando por el borde**, y esto no es un matiz: en oscuro una sombra
   * no se ve, así que si la agrupación dependiera de ella, la tarjeta dejaría de agrupar en
   * cuanto alguien cambia de tema. Esta sombra es un refuerzo que en claro despega el blanco
   * del lienzo y en oscuro simplemente no se nota. Quitarla no rompe nada; quitar el borde sí.
   */
  resting: string;
  /** Menú, popover, tooltip: flota sobre la página pero no la bloquea. */
  floating: string;
  /** Diálogo y hoja: se apodera de la pantalla. */
  modal: string;
}

export interface DurationTokens {
  instant: string;
  fast: string;
  normal: string;
  slow: string;
}

export interface EasingTokens {
  standard: string;
  enter: string;
  exit: string;
}

export interface MotionTokens {
  duration: DurationTokens;
  easing: EasingTokens;
}

export interface ReadingPreferences {
  fontScale: '1' | '1.15' | '1.3';
  lineHeight: '1.5' | '1.75' | '2';
  width: '68ch' | '56ch';
  contrast: 'normal' | 'high';
  motion: 'system' | 'reduced';
  transcriptAlwaysVisible: boolean;
}

export interface DesignTokens {
  colors: SemanticColorTokens;
  typography: TypographyTokens;
  space: SpaceTokens;
  radius: RadiusTokens;
  size: SizeTokens;
  density: DensityScale;
  elevation: ElevationTokens;
  motion: MotionTokens;
}
