import localFont from 'next/font/local';

/**
 * Familia única del producto: Atkinson Hyperlegible Next.
 *
 * Por qué esta y no Lexend (decisión 17/9, ver PRODUCT_DECISIONS.md):
 * Lexend no trae la feature OpenType `tnum` y sus dígitos son proporcionales
 * (el `0` mide 607 unidades y el `1` mide 500 sobre un em de 1000), así que
 * `font-variant-numeric: tabular-nums` —que `.type-data` aplica en
 * packages/design-tokens/src/tailwind-plugin.ts— se habría convertido en una
 * instrucción muerta: notas, cuotas y el cronómetro habrían perdido la alineación.
 * Atkinson sí trae `tnum` y sustituye los diez dígitos por un juego de 632
 * unidades constante en los tres pesos que usamos (400/600/700).
 *
 * El fichero es el variable de Google Fonts recortado dos veces:
 *   - eje `wght` limitado a 400–700 (los únicos pesos de los roles tipográficos),
 *   - subset al rango `latin`, que cubre el español completo.
 * Resultado: 20,1 KB woff2. Ver README.md de esta carpeta para regenerarlo.
 *
 * `display: 'swap'` para no bloquear el primer pintado, y `adjustFontFallback`
 * ajusta las métricas de la fuente de respaldo para que el intercambio no
 * desplace el layout (presupuesto LCP < 2,5 s en 4G lento, plan/10:18).
 *
 * No hay cursiva: Google Fonts no publica un variable italic de esta familia y
 * un segundo fichero duplicaría el peso. Mientras el contenido del curso no se
 * renderice (Fase 3), el navegador sintetiza la oblicua. Registrado como pendiente.
 */
export const atkinson = localFont({
  src: './atkinson-hyperlegible-next-var.woff2',
  weight: '400 700',
  style: 'normal',
  display: 'swap',
  variable: '--font-sans',
  adjustFontFallback: 'Arial',
  preload: true,
  fallback: ['system-ui', '-apple-system', '"Segoe UI"', 'Roboto', 'sans-serif'],
});
