/**
 * Request context resolution.
 * SSOT: plan/03-identidad-y-acceso.md "Contexto de request"
 *
 * Resolves institution (hardcoded tenant for now), person, and capabilities from the session.
 * Uses React.cache for request-level memoization.
 *
 * MFA awareness (§9b): When a staff member (ADMIN/OPERATIONS) has aal1 but needs aal2,
 * their staff memberships are excluded from capability resolution. This ensures both
 * pages and API endpoints consistently require MFA for staff operations.
 */

import { cache } from 'react';
import { headers } from 'next/headers';
import { createTenantClient } from '../db/tenant';
import { createServerSupabaseClient, getSupabaseUser } from '../auth/supabase-server';
import { resolveInstitutionBySlug, type CachedInstitution } from './institution-cache';
import { COLOMBIA_ESTUDIA } from './tenant';
import {
  resolveCapabilities,
  deriveAccountStatus,
  type Capability,
  type Scope,
  type EnrollmentWithPayerType,
  type Membership,
  type Guardianship,
  type WardEnrollment,
  type PartnerContact,
  type AccountStatus,
} from '@colombia-estudia/domain';

// ─────────────────────────── Constants ───────────────────────────

/** Roles that require MFA (aal2) for their capabilities to be granted (plan/03 "MFA para staff"). */
export const MFA_REQUIRED_ROLES: readonly Membership['role'][] = ['ADMIN', 'OPERATIONS'] as const;

/** Roles whose main area is not /aprender (plan/01:40-46 route group (staff), plus (admin)). */
export const STAFF_ROLES: readonly Membership['role'][] = [
  'ADMIN',
  'OPERATIONS',
  'INSTRUCTOR',
  'INCLUSION_COORDINATOR',
] as const;

// ─────────────────────────── Types ───────────────────────────

/**
 * Resolved person with all relations needed for capability resolution.
 */
export interface ResolvedPerson {
  id: string;
  givenName: string;
  familyName: string;
  email: string | null;
  authUserId: string;
  memberships: Membership[];
  enrollments: EnrollmentWithPayerType[];
  guardianships: Guardianship[];
  partnerContacts: PartnerContact[];
}

/**
 * Authenticator Assurance Level from Supabase MFA.
 * - aal1: Password or magic link only
 * - aal2: Second factor verified (TOTP)
 */
export type AAL = 'aal1' | 'aal2';

/**
 * The full request context available to handlers and components.
 */
export interface RequestContext {
  institution: CachedInstitution;
  person: ResolvedPerson | null;
  capabilities: Map<Capability, Scope[]>;
  accountStatusByEnrollment: Map<string, AccountStatus>;
  /**
   * Current authenticator assurance level. null if anonymous.
   */
  aal: AAL | null;
  /**
   * True if the person has an active ADMIN/OPERATIONS membership but hasn't
   * completed MFA (aal2). When true, staff capabilities are NOT granted.
   */
  mfaPending: boolean;
  requestId: string;
}

// ─────────────────────────── Context Resolution ───────────────────────────

/**
 * Get the request context for the current request.
 *
 * Uses React.cache to ensure this is computed only once per request.
 * Called by layouts, pages, and route handlers.
 */
export const getRequestContext = cache(async (): Promise<RequestContext> => {
  const headerStore = await headers();
  const requestId = headerStore.get('x-request-id') ?? 'unknown';

  // Hardcoded tenant for the first scope (lib/authz/tenant.ts). A missing row is a
  // deployment error (run packages/scripts institution:create), not a 404.
  const institution = await resolveInstitutionBySlug(COLOMBIA_ESTUDIA);
  if (!institution) {
    throw new Error(
      `Institution "${COLOMBIA_ESTUDIA}" not found: run institution:create against this database`
    );
  }

  // Get authenticated user from Supabase
  const user = await getSupabaseUser();

  if (!user) {
    // Anonymous user
    return {
      institution,
      person: null,
      capabilities: new Map(),
      accountStatusByEnrollment: new Map(),
      aal: null,
      mfaPending: false,
      requestId,
    };
  }

  // Get MFA assurance level (one call, cached with everything else)
  const supabase = await createServerSupabaseClient();
  const { data: mfaData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  const aal: AAL = mfaData?.currentLevel === 'aal2' ? 'aal2' : 'aal1';

  // Find Person in this institution by authUserId
  const db = createTenantClient(institution.id);
  const person = await db.person.findUnique({
    where: { authUserId: user.id },
    select: {
      id: true,
      givenName: true,
      familyName: true,
      email: true,
      authUserId: true,
      memberships: {
        select: {
          personId: true,
          institutionId: true,
          role: true,
          revokedAt: true,
        },
      },
      enrollments: {
        select: {
          id: true,
          studentId: true,
          cohortId: true,
          status: true,
          isMinorAtEnrollment: true,
          accessUntil: true,
          paymentPlan: {
            select: {
              payerType: true,
              installments: {
                select: {
                  id: true,
                  position: true,
                  amount: true,
                  dueOn: true,
                  status: true,
                  agreementId: true,
                  payments: {
                    select: {
                      installmentId: true,
                      amount: true,
                      confirmedAt: true,
                      voidedAt: true,
                    },
                  },
                },
              },
            },
          },
          paymentAgreements: {
            select: { id: true, enrollmentId: true, status: true },
          },
          accommodation: {
            select: {
              enrollmentId: true,
              extraTimeFactor: true,
              exemptFromTimer: true,
              allowedAttemptsBonus: true,
            },
          },
        },
      },
      guardianOf: {
        select: {
          guardianId: true,
          studentId: true,
          isFinancialResponsible: true,
          // Las matrículas del pupilo (Fase C): son las que el acudiente puede mirar.
          student: {
            select: {
              enrollments: {
                select: {
                  id: true,
                  cohortId: true,
                  paymentPlan: { select: { payerType: true } },
                },
              },
            },
          },
        },
      },
      partnerContacts: {
        select: {
          id: true,
        },
      },
    },
  });

  if (!person) {
    // User has Supabase account but no Person in this institution
    // Treat as anonymous (they may have account in another institution)
    return {
      institution,
      person: null,
      capabilities: new Map(),
      accountStatusByEnrollment: new Map(),
      aal,
      mfaPending: false,
      requestId,
    };
  }

  // Get restriction policy for the institution
  const restrictionPolicy = await db.restrictionPolicy.findUnique({
    where: { institutionId: institution.id },
    select: {
      institutionId: true,
      requireAgreementForNextCohort: true,
      notifyPayerOnOverdue: true,
    },
  });

  const now = new Date();

  // Map enrollments to EnrollmentWithPayerType
  const enrollmentsWithPayer: EnrollmentWithPayerType[] = person.enrollments.map((e) => ({
    id: e.id,
    studentId: e.studentId,
    cohortId: e.cohortId,
    status: e.status as 'ACTIVE' | 'COMPLETED' | 'WITHDRAWN',
    isMinorAtEnrollment: e.isMinorAtEnrollment,
    accessUntil: e.accessUntil,
    payerType: e.paymentPlan?.payerType ?? null,
  }));

  // Derive account status for each enrollment with a payment plan.
  // deriveAccountStatus derives PAID from confirmed payments and IN_AGREEMENT from ACTIVE
  // agreements (account-status.ts:106-171): passing empty arrays here (first version of
  // this file) made every past-due installment OVERDUE and every agreement invisible.
  const accountStatusByEnrollment = new Map<string, AccountStatus>();
  for (const enrollment of person.enrollments) {
    if (!enrollment.paymentPlan) continue;
    const installments = enrollment.paymentPlan.installments.map((i) => ({
      id: i.id,
      position: i.position,
      amount: Number(i.amount),
      dueOn: i.dueOn,
      status: i.status,
      agreementId: i.agreementId,
    }));
    const payments = enrollment.paymentPlan.installments.flatMap((i) =>
      i.payments.map((p) => ({
        installmentId: p.installmentId,
        amount: Number(p.amount),
        confirmedAt: p.confirmedAt,
        voidedAt: p.voidedAt,
      }))
    );
    const status = deriveAccountStatus({
      payerType: enrollment.paymentPlan.payerType,
      installments,
      payments,
      agreements: enrollment.paymentAgreements,
      now,
    });
    accountStatusByEnrollment.set(enrollment.id, status);
  }

  // Determine if MFA is pending for staff capabilities.
  // A person with active ADMIN/OPERATIONS membership but aal1 has mfaPending=true,
  // and their staff memberships are excluded from capability resolution.
  const typedMemberships = person.memberships.map((m) => ({
    ...m,
    role: m.role as Membership['role'],
  }));

  const hasStaffMembership = typedMemberships.some(
    (m) => !m.revokedAt && MFA_REQUIRED_ROLES.includes(m.role)
  );
  const mfaPending = hasStaffMembership && aal !== 'aal2';

  // When MFA is pending, exclude ADMIN/OPERATIONS memberships from capability resolution.
  // This ensures staff capabilities (institution.manage, etc.) require aal2.
  const membershipsForCapabilities = mfaPending
    ? typedMemberships.filter((m) => !MFA_REQUIRED_ROLES.includes(m.role))
    : typedMemberships;

  // Las matrículas de los pupilos, una fila por matrícula (Fase C, 23/9).
  const wardEnrollments: WardEnrollment[] = person.guardianOf.flatMap((g) =>
    g.student.enrollments.map((e) => ({
      enrollmentId: e.id,
      cohortId: e.cohortId,
      payerType: e.paymentPlan?.payerType ?? null,
      isFinancialResponsible: g.isFinancialResponsible,
    }))
  );

  // Resolve capabilities
  const capabilities = resolveCapabilities({
    memberships: membershipsForCapabilities,
    enrollments: enrollmentsWithPayer,
    guardianships: person.guardianOf.map((g) => ({
      guardianId: g.guardianId,
      studentId: g.studentId,
    })),
    wardEnrollments,
    partnerContactOf: person.partnerContacts.map((partner) => ({
      personId: person.id,
      partnerId: partner.id,
    })),
    accountStatusByEnrollment,
    restrictionPolicy,
    now,
  });

  // Build resolved person
  const resolvedPerson: ResolvedPerson = {
    id: person.id,
    givenName: person.givenName,
    familyName: person.familyName,
    email: person.email,
    authUserId: person.authUserId!,
    memberships: person.memberships.map((m) => ({
      ...m,
      role: m.role as Membership['role'],
    })),
    enrollments: enrollmentsWithPayer,
    guardianships: person.guardianOf.map((g) => ({
      guardianId: g.guardianId,
      studentId: g.studentId,
    })),
    // Map Partner[] (where person is contactPerson) to PartnerContact[]
    partnerContacts: person.partnerContacts.map((partner) => ({
      personId: person.id,
      partnerId: partner.id,
    })),
  };

  return {
    institution,
    person: resolvedPerson,
    capabilities,
    accountStatusByEnrollment,
    aal,
    mfaPending,
    requestId,
  };
});
