/**
 * Domain types - minimal interfaces for pure business logic.
 *
 * These types mirror the Prisma schema but only include fields used by domain functions.
 * The mapping from Prisma types happens in apps/web.
 *
 * SSOT: prisma/schema.prisma
 */

// ─────────────────────────── Roles ───────────────────────────

/**
 * User roles in the system.
 * Schema: prisma/schema.prisma:155-163
 */
export type Role =
  | 'ADMIN'
  | 'OPERATIONS'
  | 'INSTRUCTOR'
  | 'INCLUSION_COORDINATOR'
  | 'STUDENT'
  | 'GUARDIAN'
  | 'PARTNER_CONTACT';

// ─────────────────────────── Membership ───────────────────────────

/**
 * A person's role in an institution.
 * Schema: prisma/schema.prisma:167-179
 */
export interface Membership {
  personId: string;
  institutionId: string;
  role: Role;
  revokedAt: Date | null;
}

// ─────────────────────────── Enrollment ───────────────────────────

export type EnrollmentStatus = 'ACTIVE' | 'COMPLETED' | 'WITHDRAWN';

/**
 * A student's enrollment in a cohort.
 * Schema: prisma/schema.prisma:362-391
 */
export interface Enrollment {
  id: string;
  studentId: string;
  cohortId: string;
  status: EnrollmentStatus;
  isMinorAtEnrollment: boolean;
  accessUntil: Date; // NOT nullable per schema:370
}

// ─────────────────────────── Guardianship ───────────────────────────

/**
 * Guardian-student relationship for minors.
 * Schema: prisma/schema.prisma:183-197
 */
export interface Guardianship {
  guardianId: string;
  studentId: string;
}

// ─────────────────────────── Partner Contact ───────────────────────────

/**
 * A person who is a contact for a partner organization.
 */
export interface PartnerContact {
  personId: string;
  partnerId: string;
}

// ─────────────────────────── Account & Billing ───────────────────────────

export type AccountStatus = 'PARTNER_PAID' | 'CURRENT' | 'IN_AGREEMENT' | 'OVERDUE';
export type InstallmentStatus = 'OPEN' | 'PARTIALLY_PAID' | 'PAID' | 'VOID';
export type AgreementStatus = 'ACTIVE' | 'FULFILLED' | 'CANCELLED';
export type PayerType = 'PERSON' | 'PARTNER';

/**
 * A payment installment (cuota).
 * Schema: prisma/schema.prisma:869-888
 */
export interface Installment {
  id: string;
  position: number;
  amount: number; // COP integer, no decimals
  dueOn: Date;
  status: InstallmentStatus;
  agreementId: string | null;
}

/**
 * A payment record.
 * Schema: prisma/schema.prisma:899-920
 *
 * Status is derived: confirmedAt !== null && voidedAt === null => confirmed
 */
export interface Payment {
  installmentId: string;
  amount: number;
  confirmedAt: Date | null;
  voidedAt: Date | null;
}

/**
 * A payment agreement (acuerdo de pago).
 * Schema: prisma/schema.prisma:930-949
 */
export interface PaymentAgreement {
  id: string;
  enrollmentId: string;
  status: AgreementStatus;
}

/**
 * Payment plan for an enrollment.
 * Schema: prisma/schema.prisma:837-855
 */
export interface PaymentPlan {
  enrollmentId: string;
  payerType: PayerType;
}

/**
 * Restriction policy for an institution.
 * Schema: prisma/schema.prisma:954-963
 */
export interface RestrictionPolicy {
  institutionId: string;
  requireAgreementForNextCohort: boolean;
  notifyPayerOnOverdue: boolean;
}

// ─────────────────────────── Accommodation ───────────────────────────

/**
 * Reasonable accommodations for a student's enrollment (PIAR).
 * Schema: prisma/schema.prisma:806-824
 */
export interface Accommodation {
  enrollmentId: string;
  extraTimeFactor: number; // default 1, schema uses Decimal(3,2)
  exemptFromTimer: boolean;
  allowedAttemptsBonus: number;
}

// ─────────────────────────── Assessment ───────────────────────────

/**
 * Assessment version with attempt rules.
 * Schema: prisma/schema.prisma:533-558
 */
export interface AssessmentVersion {
  id: string;
  timeLimitMinutes: number | null;
  maxAttempts: number;
}

/**
 * Assessment assignment to a cohort.
 * Schema: prisma/schema.prisma:584-603
 */
export interface AssessmentAssignment {
  id: string;
  dueAt: Date | null;
}
