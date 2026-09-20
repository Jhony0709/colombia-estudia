/**
 * La preferencia de tema: clara por defecto, oscura si se elige.
 * SSOT: reference/03-ui/tokens.md, decisión de Jhonny del 18/9.
 *
 * **Va en una cookie y no en `localStorage`**, y esto no es una preferencia de estilo.
 * El layout raíz ya es `force-dynamic` (`app/layout.tsx:25`), así que puede leer la cookie
 * y escribir la clase en el `<html>` que sale del servidor: el navegador recibe el HTML ya
 * en el tema correcto y no hay ni un fotograma del tema equivocado.
 *
 * La alternativa habitual —un `<script>` en línea que lee `localStorage` antes de pintar—
 * aquí es peor por dos motivos: el middleware manda una CSP con `nonce` y `strict-dynamic`,
 * así que ese script necesitaría el nonce de cada petición; y sigue siendo un script que
 * corre antes de React para evitar un parpadeo que la cookie evita sin correr nada.
 *
 * `system` existe porque quien tiene el equipo en oscuro por una razón —fotofobia, migraña,
 * trabajar de noche— no debería tener que decírselo a cada aplicación por separado. Lo que
 * cambia respecto a antes es cuál es el valor de partida: era el del sistema, ahora es claro.
 */

export const THEME_COOKIE = 'ce-theme';

export const THEMES = ['light', 'dark', 'system'] as const;

export type Theme = (typeof THEMES)[number];

export const DEFAULT_THEME: Theme = 'light';

/** Un valor que viene de la cookie es texto de fuera: o es uno de los tres, o es el de partida. */
export function toTheme(value: string | undefined | null): Theme {
  return THEMES.includes(value as Theme) ? (value as Theme) : DEFAULT_THEME;
}

/**
 * La clase que va en `<html>`.
 *
 * `light` no pone clase porque el tema claro ES `:root` en el plugin de tokens. `system`
 * pone `theme-system`, que es lo único que activa la consulta de medios del plugin: sin esa
 * clase, el oscuro del sistema operativo no manda sobre la aplicación.
 */
export function themeClass(theme: Theme): string {
  if (theme === 'dark') return 'dark';
  if (theme === 'system') return 'theme-system';
  return '';
}

/**
 * Lo que se le dice al navegador para que los controles que él pinta —los `select`, la barra
 * de desplazamiento, el calendario de un `date`— vayan con el resto. Sin esto, un `select`
 * nativo sale blanco sobre una pantalla oscura.
 */
export function themeColorScheme(theme: Theme): 'light' | 'dark' | 'light dark' {
  if (theme === 'dark') return 'dark';
  if (theme === 'system') return 'light dark';
  return 'light';
}
