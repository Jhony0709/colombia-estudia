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
  // 23/9 (docs/ux/decision-ux-2309.md, «Aterrizaje de ADMIN»): a la pantalla de situación,
  // no a la configuración. Primero fue `/cohortes` (ola 2); con la ola 3 existe `/inicio`:
  // lo que requiere atención, con enlace a cada sitio. Quien opera cohortes aterriza ahí
  // también; el instructor sigue en el constructor, que es su centro (decisión §9.5).
  ['ADMIN', '/inicio'],
  ['OPERATIONS', '/inicio'],
  ['INSTRUCTOR', '/contenido'],
  ['INCLUSION_COORDINATOR', '/admin/inclusion/reporte'],
  ['STUDENT', '/aprender'],
  // El acudiente (Fase C, 23/9): después del estudiante, porque quien estudia y además es
  // acudiente entra a estudiar y llega a `/familia` desde su menú.
  ['GUARDIAN', '/familia'],
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
