/**
 * La guardia del área del acudiente (Fase C, 23/9).
 * SSOT: reference/01-routing/routes.md (`/familia`), capabilities.ts `progress.read.ward`.
 *
 * Como `student.ts`: decide **el área**, no un permiso. Entra quien tiene alguna matrícula
 * de pupilo que mirar (`progress.read.ward`) o la membresía `GUARDIAN` aunque el pupilo aún
 * no esté matriculado: `/familia` tiene un mensaje para ese caso.
 */

import 'server-only';

import { redirect } from 'next/navigation';
import type { Membership } from '@colombia-estudia/domain';
import { getRequestContext, type RequestContext } from './request-context';
import { HOME_AFTER_LOGIN } from './routes';

const GUARDIAN_ROLES: readonly Membership['role'][] = ['GUARDIAN'];

export async function requireGuardianSession(): Promise<RequestContext> {
  const ctx = await getRequestContext();
  if (!ctx.person) redirect('/auth/login');

  const isGuardian = ctx.person.memberships.some(
    (m) => !m.revokedAt && GUARDIAN_ROLES.includes(m.role)
  );
  const hasWard = (ctx.capabilities.get('progress.read.ward')?.length ?? 0) > 0;
  if (!isGuardian && !hasWard) redirect(HOME_AFTER_LOGIN);

  return ctx;
}
