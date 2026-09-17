/**
 * Capabilities with scope resolution.
 * SSOT: reference/04-business-logic/acceso-y-cartera.md §1
 *
 * Pure function. Receives enrollment data and returns capabilities with their scope.
 * Tests must cover all 15 cases from the access table.
 */

import { bogotaDate, dateOnly } from './dates';
import type {
  AccountStatus,
  Enrollment,
  Guardianship,
  Membership,
  PartnerContact,
  PayerType,
  RestrictionPolicy,
} from './types';

// ─────────────────────────── Types ───────────────────────────

/**
 * The 15 capabilities from acceso-y-cartera.md §1 table.
 */
export type Capability =
  | 'lesson.read'
  | 'lesson.progress.own'
  | 'lesson.author'
  | 'lesson.publish'
  | 'assessment.take'
  | 'assessment.grade'
  | 'progress.read.cohort'
  | 'progress.override'
  | 'score.read.own'
  | 'accommodation.manage'
  | 'billing.manage'
  | 'billing.read.own'
  | 'people.manage'
  | 'cohort.manage'
  | 'institution.manage';

/**
 * Scope of a capability.
 * - institution: covers everything in the institution
 * - cohortId: covers that cohort and enrollments in it
 * - enrollmentId: covers only that specific enrollment
 * - partnerId: covers only that partner
 */
export type Scope =
  { institution: true } | { cohortId: string } | { enrollmentId: string } | { partnerId: string };

/**
 * Resource scope for authorization checks.
 * SSOT: acceso-y-cartera.md:16
 */
export type ResourceScope = {
  cohortId?: string;
  enrollmentId?: string;
  partnerId?: string;
};

// ─────────────────────────── Input Types ───────────────────────────

/**
 * Enrollment plus who pays. `payerType` is null when the enrollment has no PaymentPlan yet
 * (schema: Enrollment.paymentPlan is optional): no plan → no cartera → no billing.read.own.
 */
export interface EnrollmentWithPayerType extends Enrollment {
  payerType: PayerType | null;
}

/**
 * Input for resolveCapabilities.
 * Signature exactly as in acceso-y-cartera.md:18-21.
 */
export interface ResolveCapabilitiesInput {
  memberships: Membership[];
  enrollments: EnrollmentWithPayerType[];
  guardianships: Guardianship[];
  partnerContactOf: PartnerContact[];
  accountStatusByEnrollment: Map<string, AccountStatus>;
  restrictionPolicy: RestrictionPolicy | null;
  now: Date;
}

// ─────────────────────────── Helper Functions ───────────────────────────

function addCapability(map: Map<Capability, Scope[]>, capability: Capability, scope: Scope): void {
  const existing = map.get(capability);
  if (existing) {
    existing.push(scope);
  } else {
    map.set(capability, [scope]);
  }
}

/**
 * Check if access has expired.
 * SSOT: acceso-y-cartera.md:155-156 "accessUntil < now"
 *
 * Access is valid for the entire day of accessUntil in Bogota.
 */
function isAccessExpired(enrollment: Enrollment, now: Date): boolean {
  return dateOnly(enrollment.accessUntil) < bogotaDate(now);
}

// ─────────────────────────── Main Function ───────────────────────────

/**
 * Resolve all capabilities for a person based on their memberships, enrollments,
 * guardianships, and partner contacts.
 *
 * Rules from acceso-y-cartera.md §1-8:
 * - ADMIN has 11 capabilities (not lesson.progress.own, assessment.take, score.read.own, billing.read.own)
 * - OPERATIONS has people.manage, cohort.manage, billing.manage, progress.override, progress.read.cohort
 * - INSTRUCTOR has lesson.read, lesson.author, assessment.grade, progress.read.cohort
 *   // AMBIGUO(acceso-y-cartera.md:33): lesson.publish not included (no "publication permission" mentioned)
 *   // AMBIGUO(acceso-y-cartera.md:35-36): scope is institution, not cohort
 * - INCLUSION_COORDINATOR has accommodation.manage only (no billing)
 * - STUDENT ACTIVE has lesson.read (cohort), lesson.progress.own, assessment.take, score.read.own (enrollment)
 * - GUARDIAN has no academic capabilities (decision 7)
 * - §2: Minor with OVERDUE still has lesson.read, assessment.take, score.read.own
 * - §8: Expired access loses lesson.read, assessment.take; keeps score.read.own
 * - WITHDRAWN/COMPLETED: no lesson.progress.own
 *   // AMBIGUO(acceso-y-cartera.md:§8): COMPLETED only gets score.read.own
 */
export function resolveCapabilities(input: ResolveCapabilitiesInput): Map<Capability, Scope[]> {
  const {
    memberships,
    enrollments,
    guardianships,
    partnerContactOf,
    // accountStatusByEnrollment and restrictionPolicy are accepted but do not alter capabilities
    // Test: OVERDUE does not change any capability for minor or adult
    now,
  } = input;

  const capabilities = new Map<Capability, Scope[]>();

  // Process active memberships (revokedAt === null)
  for (const membership of memberships) {
    if (membership.revokedAt !== null) continue;

    const institutionScope: Scope = { institution: true };

    switch (membership.role) {
      case 'ADMIN':
        // ADMIN has 11 capabilities - NOT lesson.progress.own, assessment.take, score.read.own, billing.read.own
        addCapability(capabilities, 'lesson.read', institutionScope);
        addCapability(capabilities, 'lesson.author', institutionScope);
        addCapability(capabilities, 'lesson.publish', institutionScope);
        addCapability(capabilities, 'assessment.grade', institutionScope);
        addCapability(capabilities, 'progress.read.cohort', institutionScope);
        addCapability(capabilities, 'progress.override', institutionScope);
        addCapability(capabilities, 'accommodation.manage', institutionScope);
        addCapability(capabilities, 'billing.manage', institutionScope);
        addCapability(capabilities, 'people.manage', institutionScope);
        addCapability(capabilities, 'cohort.manage', institutionScope);
        addCapability(capabilities, 'institution.manage', institutionScope);
        break;

      case 'OPERATIONS':
        addCapability(capabilities, 'people.manage', institutionScope);
        addCapability(capabilities, 'cohort.manage', institutionScope);
        addCapability(capabilities, 'billing.manage', institutionScope);
        addCapability(capabilities, 'progress.override', institutionScope);
        addCapability(capabilities, 'progress.read.cohort', institutionScope);
        break;

      case 'INSTRUCTOR':
        // AMBIGUO(acceso-y-cartera.md:33): lesson.publish not included - no "publication permission" exists
        // AMBIGUO(acceso-y-cartera.md:35-36): scope is institution, not specific cohort
        addCapability(capabilities, 'lesson.read', institutionScope);
        addCapability(capabilities, 'lesson.author', institutionScope);
        addCapability(capabilities, 'assessment.grade', institutionScope);
        addCapability(capabilities, 'progress.read.cohort', institutionScope);
        break;

      case 'INCLUSION_COORDINATOR':
        // Only accommodation.manage, nothing about billing
        addCapability(capabilities, 'accommodation.manage', institutionScope);
        break;

      case 'GUARDIAN':
        // Decision 7: Guardian gets NO academic capabilities
        break;

      case 'STUDENT':
        // Handled via enrollments, not membership role
        break;

      case 'PARTNER_CONTACT':
        // Handled via partnerContactOf
        break;
    }
  }

  // Process enrollments for students
  for (const enrollment of enrollments) {
    const cohortScope: Scope = { cohortId: enrollment.cohortId };
    const enrollmentScope: Scope = { enrollmentId: enrollment.id };

    // Check if access is expired (§8)
    const accessExpired = isAccessExpired(enrollment, now);

    // score.read.own survives everything - even expired access and COMPLETED/WITHDRAWN
    addCapability(capabilities, 'score.read.own', enrollmentScope);

    if (enrollment.status === 'WITHDRAWN') {
      // WITHDRAWN: only score.read.own (already added above)
      // AMBIGUO(acceso-y-cartera.md:§8): el retiro no menciona score.read.own; se conserva
      // por coherencia con :38 ("sobrevive al vencimiento del acceso").
      continue;
    }

    if (enrollment.status === 'COMPLETED') {
      // AMBIGUO(acceso-y-cartera.md:§8): COMPLETED only gets score.read.own
      continue;
    }

    // ACTIVE status from here on

    if (accessExpired) {
      // §8: Expired access loses lesson.read and assessment.take, keeps score.read.own
      continue;
    }

    // Active enrollment with valid access
    addCapability(capabilities, 'lesson.read', cohortScope);
    addCapability(capabilities, 'lesson.progress.own', enrollmentScope);
    addCapability(capabilities, 'assessment.take', enrollmentScope);

    // billing.read.own based on payerType
    if (enrollment.payerType === 'PERSON') {
      if (enrollment.isMinorAtEnrollment) {
        // AMBIGUO(acceso-y-cartera.md:§5, decision 7): Minor with payerType PERSON has no billing.read.own
        // The guardian handles billing, not the minor
      } else {
        addCapability(capabilities, 'billing.read.own', enrollmentScope);
      }
    }
    // If payerType === 'PARTNER', student does NOT have billing.read.own (the partner contact does)
    // If payerType === null (no PaymentPlan yet), there is no cartera to read.
  }

  // Process guardianships - Decision 7: Guardian gets no academic capabilities
  // Guardianships are tracked but don't grant capabilities in MVP
  void guardianships;

  // Process partner contacts
  for (const contact of partnerContactOf) {
    const partnerScope: Scope = { partnerId: contact.partnerId };
    addCapability(capabilities, 'billing.read.own', partnerScope);
    addCapability(capabilities, 'progress.read.cohort', partnerScope);
  }

  return capabilities;
}

// ─────────────────────────── Scope Checking ───────────────────────────

/**
 * Check if granted scopes allow access to a resource.
 *
 * Rules:
 * - { institution: true } covers everything in that institution
 * - { cohortId } covers that cohort and enrollments where enrollment.cohortId matches
 * - { enrollmentId } covers only that exact enrollment
 * - { partnerId } covers only that exact partner
 *
 * @param granted - Scopes the user has for a capability
 * @param resource - The resource scope being accessed
 * @returns true if any granted scope covers the resource
 */
export function scopeAllows(granted: Scope[], resource: ResourceScope): boolean {
  for (const scope of granted) {
    // Institution scope covers everything
    if ('institution' in scope && scope.institution === true) {
      return true;
    }

    // Cohort scope
    if ('cohortId' in scope) {
      if (resource.cohortId !== undefined && resource.cohortId === scope.cohortId) {
        return true;
      }
      // Cohort scope also covers enrollments in that cohort
      if (resource.enrollmentId !== undefined && resource.cohortId === scope.cohortId) {
        return true;
      }
    }

    // Enrollment scope - exact match only
    if ('enrollmentId' in scope) {
      if (resource.enrollmentId !== undefined && resource.enrollmentId === scope.enrollmentId) {
        return true;
      }
    }

    // Partner scope - exact match only
    if ('partnerId' in scope) {
      if (resource.partnerId !== undefined && resource.partnerId === scope.partnerId) {
        return true;
      }
    }
  }

  return false;
}
