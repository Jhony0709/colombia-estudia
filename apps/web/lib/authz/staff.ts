/**
 * Staff session guard for the (staff) and (admin) route groups.
 * SSOT: plan/03-identidad-y-acceso.md "MFA para staff", reference/01-routing/routes.md:7-8
 *
 * Redirects (never throws) because it runs in layouts:
 * - no session → /auth/login
 * - no staff membership → / (routes.md:20 sends each role to its own area)
 * - ADMIN/OPERATIONS without aal2 → /auth/mfa (ctx.mfaPending)
 * The per-area capability guard is the sub-layout's job (requireCapability).
 */

import { redirect } from 'next/navigation';
import { HOME_AFTER_LOGIN } from './routes';
import { getRequestContext, STAFF_ROLES, type RequestContext } from './request-context';

export async function requireStaffSession(): Promise<RequestContext> {
  const ctx = await getRequestContext();

  if (!ctx.person) {
    redirect('/auth/login');
  }

  const isStaff = ctx.person.memberships.some((m) => !m.revokedAt && STAFF_ROLES.includes(m.role));
  if (!isStaff) {
    redirect(HOME_AFTER_LOGIN);
  }

  if (ctx.mfaPending) {
    redirect('/auth/mfa');
  }

  return ctx;
}
