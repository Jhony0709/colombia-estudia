/**
 * `/ingresar`: la puerta de entrada con sesión. Redirige al área del rol principal.
 * SSOT: reference/01-routing/routes.md
 *
 * Hasta el 19/9 esto vivía en `/`. Ahora `/` es la portada y no redirige a nadie: el botón
 * «Ingresar» de la portada, el destino por defecto tras iniciar sesión (`HOME_AFTER_LOGIN`)
 * y la marca en la navegación de la app llegan aquí.
 *
 * Es ruta protegida (no está en PUBLIC_*): sin sesión el middleware manda a
 * `/auth/login?next=/ingresar`, así que el `redirect` de abajo es red de seguridad.
 */

import { redirect } from 'next/navigation';
import { getRequestContext } from '@/lib/authz/request-context';
import { homePathForRoles } from '@/lib/authz/home';

export default async function IngresarPage() {
  const ctx = await getRequestContext();

  if (!ctx.person) {
    redirect('/auth/login');
  }

  // ADMIN/OPERATIONS without aal2: their staff capabilities are withheld (request-context),
  // so sending them to /admin would bounce back here (routes.md:7 forbids loops). MFA first.
  if (ctx.mfaPending) {
    redirect('/auth/mfa');
  }

  const roles = ctx.person.memberships.filter((m) => !m.revokedAt).map((m) => m.role);
  redirect(homePathForRoles(roles));
}
