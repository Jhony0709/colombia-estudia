/**
 * Session service: database access for the login flow.
 * SSOT: plan/03-identidad-y-acceso.md "Login", "MFA para staff"; plan/01:113-115.
 */

import 'server-only';

import { createTenantClient } from '@/lib/db/tenant';
import { MFA_REQUIRED_ROLES } from '@/lib/authz/request-context';

/**
 * Whether the Auth user belongs to this institution, and whether MFA is mandatory.
 * `null` person → the account is not a Person here (e.g. anonymized): the caller signs out.
 */
export async function findLoginPerson(
  institutionId: string,
  authUserId: string
): Promise<{ needsMfa: boolean } | null> {
  const db = createTenantClient(institutionId);
  const person = await db.person.findUnique({
    where: { authUserId },
    select: { memberships: { select: { role: true, revokedAt: true } } },
  });
  if (!person) return null;

  const needsMfa = person.memberships.some(
    (m) => !m.revokedAt && MFA_REQUIRED_ROLES.includes(m.role)
  );
  return { needsMfa };
}
