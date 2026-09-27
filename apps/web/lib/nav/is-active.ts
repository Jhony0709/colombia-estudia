/**
 * Si un destino de navegación es el actual (27/9): la ruta exacta, un prefijo declarado en
 * `activeUnder`, o un hijo (`href/…`). Lo usan la barra superior y la de pestañas del
 * estudiante; antes vivía dentro de `StudentTopNav`.
 */

import type { NavDestination } from './staff-nav';

export function isActive(currentPath: string | null, item: NavDestination): boolean {
  if (!currentPath) return false;
  if (currentPath === item.href) return true;
  if (item.activeUnder) return item.activeUnder.some((prefix) => currentPath.startsWith(prefix));
  return currentPath.startsWith(`${item.href}/`);
}
