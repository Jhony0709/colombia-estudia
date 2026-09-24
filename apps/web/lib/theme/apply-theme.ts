/**
 * Aplicar el tema desde el navegador (22/9): la clase en `<html>` y la cookie.
 *
 * Sacado de `ThemeToggle` para que el menú del estudiante (`StudentTopNav`) elija el tema
 * sin duplicar la regla. El cambio se aplica a mano sobre `<html>` ANTES de que el servidor
 * se entere; la cookie es lo que hace que la próxima carga ya venga bien.
 */

import { THEME_COOKIE, themeClass, type Theme } from './theme';

/** Un año. El tema no es una sesión: quien lo elige no quiere volver a elegirlo en marzo. */
const ONE_YEAR = 60 * 60 * 24 * 365;

export function applyTheme(next: Theme): void {
  const html = document.documentElement;
  html.classList.remove('dark', 'theme-system');
  const className = themeClass(next);
  if (className) html.classList.add(className);

  // `SameSite=Lax` y sin `Secure` para que siga funcionando en `http://localhost`. No lleva
  // nada de nadie: es el nombre de un tema.
  document.cookie = `${THEME_COOKIE}=${next}; path=/; max-age=${ONE_YEAR}; SameSite=Lax`;
}

export const THEME_OPTIONS: ReadonlyArray<{ value: Theme; label: string }> = [
  { value: 'light', label: 'Tema claro' },
  { value: 'dark', label: 'Tema oscuro' },
  { value: 'system', label: 'El tema de mi equipo' },
];
