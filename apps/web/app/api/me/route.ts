/**
 * GET /api/me
 * SSOT: reference/02-api/endpoints.md:24
 *
 * Returns the current user's profile, roles, enrollments with status,
 * capabilities, and unread notification count.
 *
 * 401 if not authenticated.
 */

import { NextRequest } from 'next/server';
import { apiHandler } from '@/lib/http/api-handler';
import { getRequestContext } from '@/lib/authz/request-context';
import { APIError } from '@/lib/core/errors';
import { createTenantClient } from '@/lib/db/tenant';
import type { Capability, Scope } from '@colombia-estudia/domain';

// ─────────────────────────── Types ───────────────────────────

interface MeResponse {
  person: {
    id: string;
    givenName: string;
    familyName: string;
    email: string | null;
  };
  roles: string[];
  enrollments: {
    id: string;
    cohortId: string;
    status: string;
    accountStatus: string | null;
    accessUntil: string;
  }[];
  capabilities: Record<string, SerializedScope[]>;
  unreadNotifications: number;
}

/**
 * Serialized scope for JSON response.
 * Map<Capability, Scope[]> → { [capability]: Scope[] }
 */
type SerializedScope =
  { institution: true } | { cohortId: string } | { enrollmentId: string } | { partnerId: string };

// ─────────────────────────── Helper ───────────────────────────

function serializeCapabilities(
  capabilities: Map<Capability, Scope[]>
): Record<string, SerializedScope[]> {
  const result: Record<string, SerializedScope[]> = {};
  for (const [capability, scopes] of capabilities) {
    result[capability] = scopes as SerializedScope[];
  }
  return result;
}

// ─────────────────────────── Handler ───────────────────────────

export const GET = apiHandler()(async (_req: NextRequest): Promise<MeResponse> => {
  const ctx = await getRequestContext();

  // Not authenticated
  if (!ctx.person) {
    throw new APIError('Authentication required', 'UNAUTHENTICATED');
  }

  const db = createTenantClient(ctx.institution.id);

  // Get unread notification count
  const unreadNotifications = await db.notification.count({
    where: {
      personId: ctx.person.id,
      readAt: null,
    },
  });

  // Get unique roles from memberships
  const roles = [
    ...new Set(ctx.person.memberships.filter((m) => m.revokedAt === null).map((m) => m.role)),
  ];

  // Map enrollments with account status
  const enrollments = ctx.person.enrollments.map((e) => ({
    id: e.id,
    cohortId: e.cohortId,
    status: e.status,
    // null: no PaymentPlan yet (no cartera), not "CURRENT".
    accountStatus: ctx.accountStatusByEnrollment.get(e.id) ?? null,
    accessUntil: e.accessUntil.toISOString(),
  }));

  return {
    person: {
      id: ctx.person.id,
      givenName: ctx.person.givenName,
      familyName: ctx.person.familyName,
      email: ctx.person.email,
    },
    roles,
    enrollments,
    capabilities: serializeCapabilities(ctx.capabilities),
    unreadNotifications,
  };
});
