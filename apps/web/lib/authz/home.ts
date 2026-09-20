/**
 * El área de cada rol, en orden de prioridad.
 * SSOT: reference/01-routing/routes.md (`/ingresar`).
 *
 * AMBIGUO(routes.md:20): "rol principal" no tiene orden definido; se usa
 * ADMIN > OPERATIONS > INSTRUCTOR > INCLUSION_COORDINATOR > STUDENT.
 *
 * Puro, sin Next: se prueba solo.
 */

const HOME_BY_ROLE: ReadonlyArray<[role: string, path: string]> = [
  ['ADMIN', '/admin/institucion'],
  ['OPERATIONS', '/cohortes'],
  ['INSTRUCTOR', '/contenido'],
  ['INCLUSION_COORDINATOR', '/admin/inclusion/reporte'],
  ['STUDENT', '/aprender'],
  // El contacto del aliado no es un rol de la institución en sentido estricto, pero sí una
  // membresía, y su área es `/aliado` (routes.md:45). Añadido el 19/9.
  ['PARTNER_CONTACT', '/aliado'],
];

/** Sin ningún rol reconocido: `/sin-acceso` (routes.md:7). */
export function homePathForRoles(roles: readonly string[]): string {
  for (const [role, path] of HOME_BY_ROLE) {
    if (roles.includes(role)) return path;
  }
  return '/sin-acceso';
}
