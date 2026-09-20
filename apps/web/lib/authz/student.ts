/**
 * La guardia del área del estudiante (19/9).
 * SSOT: reference/01-routing/routes.md:31, capabilities.ts §8.
 *
 * No es una capacidad: es **quién es**. Un estudiante sin matrícula no tiene ninguna
 * capacidad (todas cuelgan de la matrícula), y con `requireCapability` el área lo mandaba a
 * `/ingresar`, que lo mandaba a `/aprender`, que lo mandaba a `/ingresar` —un bucle—. El
 * mensaje «todavía no estás matriculado» existe en `/aprender` justo para él, así que la
 * puerta la abre la membresía `STUDENT` (o cualquier matrícula, que da `score.read.own`
 * aunque esté retirada o vencida) y las pantallas dicen lo demás.
 */

import 'server-only';

import { redirect } from 'next/navigation';
import { getRequestContext, type RequestContext } from './request-context';
import type { Membership } from '@colombia-estudia/domain';
import { HOME_AFTER_LOGIN } from './routes';

/**
 * Igual que `STAFF_ROLES` en `staff.ts`: esto decide **el área**, no un permiso. La regla
 * `no-restricted-syntax` prohíbe `role ===` para que los permisos salgan de las capacidades;
 * qué layout te toca no es un permiso, y por eso se mira la membresía con `includes`.
 */
const STUDENT_ROLES: readonly Membership['role'][] = ['STUDENT'];

export async function requireStudentSession(): Promise<RequestContext> {
  const ctx = await getRequestContext();
  if (!ctx.person) redirect('/auth/login');

  const isStudent = ctx.person.memberships.some(
    (m) => !m.revokedAt && STUDENT_ROLES.includes(m.role)
  );
  const hasEnrollment = (ctx.capabilities.get('score.read.own')?.length ?? 0) > 0;
  if (!isStudent && !hasEnrollment) redirect(HOME_AFTER_LOGIN);

  return ctx;
}
