/**
 * Home page with role-based redirect.
 * SSOT: plan/03-identidad-y-acceso.md, reference/01-routing/routes.md
 *
 * Redirects authenticated users to their primary area based on role priority.
 * Priority follows routes.md: ADMIN > OPERATIONS > INSTRUCTOR > INCLUSION_COORDINATOR > STUDENT.
 */

import { redirect } from 'next/navigation';
import { getRequestContext } from '@/lib/authz/request-context';

export default async function HomePage() {
  const ctx = await getRequestContext();

  // Unauthenticated users go to login
  if (!ctx.person) {
    redirect('/auth/login');
  }

  // ADMIN/OPERATIONS without aal2: their staff capabilities are withheld (request-context),
  // so sending them to /admin would bounce back here (routes.md:7 forbids loops). MFA first.
  if (ctx.mfaPending) {
    redirect('/auth/mfa');
  }

  // Get active roles
  // AMBIGUO(routes.md:20): "rol principal" has no defined order; using
  // ADMIN > OPERATIONS > INSTRUCTOR > INCLUSION_COORDINATOR > STUDENT.
  const roles = ctx.person.memberships.filter((m) => !m.revokedAt).map((m) => m.role);

  // Redirect based on role priority (routes.md)
  if (roles.includes('ADMIN')) {
    redirect('/admin/institucion');
  }
  if (roles.includes('OPERATIONS')) {
    redirect('/cohortes');
  }
  if (roles.includes('INSTRUCTOR')) {
    redirect('/contenido');
  }
  if (roles.includes('INCLUSION_COORDINATOR')) {
    redirect('/admin/inclusion/reporte');
  }
  if (roles.includes('STUDENT')) {
    redirect('/aprender');
  }

  // No recognized role - show no access page
  redirect('/sin-acceso');
}
