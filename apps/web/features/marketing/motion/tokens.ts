/**
 * Tokens de movimiento de la portada ALBA (5/10). Una sola fuente: los primitivos de `motion/`
 * los leen en JavaScript y `site.css` los repite como variables (`--mo-*`) para lo que se hace
 * en CSS (la entrada del hero, los hover). Si cambia uno, cambian los dos.
 *
 * Calmo, intencional, progresivo, direccional: ease-out suave, sin springs ni rebotes.
 *
 * Entradas un 30 % más lentas desde el 5/10 tarde (Jhonny: «retarda un poco todas las
 * animaciones de entrada»): `reveal`, `slow`, `wave`, `settle` y los escalonados. Las
 * microinteracciones (`fast`, `base`, `accordion`) no cambian: responden a un gesto.
 */
export const motionTokens = {
  duration: {
    /** Microinteracción: hover, press, flecha. */
    fast: 0.16,
    /** Cambio de estado: un paso que se activa, el acordeón. */
    base: 0.32,
    /** Entrada de un componente. */
    reveal: 0.65,
    /** Revelado de una sección o de una foto. */
    slow: 1,
    /** Ondas decorativas. */
    wave: 1.4,
    /** Un fondo que se asienta (el paisaje del cierre). */
    settle: 1.3,
    /** Abrir o cerrar una pregunta. */
    accordion: 0.22,
  },
  easing: {
    /** Base: ease-out suave. */
    standard: [0.22, 1, 0.36, 1] as [number, number, number, number],
    /** Gráficos (fotos, ondas, línea del proceso). */
    expressive: [0.16, 1, 0.3, 1] as [number, number, number, number],
  },
  /** Desplazamientos de entrada, en px. En el teléfono, el corto. */
  distance: {
    enter: 24,
    body: 16,
    compact: 12,
  },
  /** Separación entre elementos de un grupo, en s. */
  stagger: {
    tight: 0.065,
    base: 0.09,
    loose: 0.13,
  },
  /** Porción visible para revelar (una sola vez). */
  amount: 0.2,
} as const;
