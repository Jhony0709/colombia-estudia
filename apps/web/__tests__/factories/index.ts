/**
 * Test factories for all Prisma models
 *
 * Uses @faker-js/faker to generate realistic test data.
 * Each factory creates minimal valid data for its model.
 *
 * Usage:
 * ```ts
 * const institution = await factories.institution.create(prisma);
 * const person = await factories.person.create(prisma, { institutionId: institution.id });
 * ```
 */

import { faker } from '@faker-js/faker/locale/es_MX';
import type { Prisma } from '@prisma/client';
import type { prisma } from '@/lib/db/prisma';

// Use the actual type of our prisma client (with omit)
type PrismaClientType = typeof prisma;

// Set consistent seed for reproducible tests
faker.seed(12345);

/**
 * Generate a unique cuid-like id for testing
 */
function cuid(): string {
  return faker.string.alphanumeric(25);
}

// Type helpers for create data
type InstitutionCreate = Prisma.InstitutionUncheckedCreateInput;
type PersonCreate = Prisma.PersonUncheckedCreateInput;
type MembershipCreate = Prisma.MembershipUncheckedCreateInput;
type GuardianshipCreate = Prisma.GuardianshipUncheckedCreateInput;
type ConsentCreate = Prisma.ConsentUncheckedCreateInput;
type PartnerCreate = Prisma.PartnerUncheckedCreateInput;
type ProgramCreate = Prisma.ProgramUncheckedCreateInput;
type ModuleCreate = Prisma.ModuleUncheckedCreateInput;
type SubjectCreate = Prisma.SubjectUncheckedCreateInput;
type CohortCreate = Prisma.CohortUncheckedCreateInput;
type EnrollmentCreate = Prisma.EnrollmentUncheckedCreateInput;
type LessonCreate = Prisma.LessonUncheckedCreateInput;
type LessonVersionCreate = Prisma.LessonVersionUncheckedCreateInput;
type MediaAssetCreate = Prisma.MediaAssetUncheckedCreateInput;
type LessonVersionAssetCreate = Prisma.LessonVersionAssetUncheckedCreateInput;
type AssessmentCreate = Prisma.AssessmentUncheckedCreateInput;
type AssessmentVersionCreate = Prisma.AssessmentVersionUncheckedCreateInput;
type LessonAssignmentCreate = Prisma.LessonAssignmentUncheckedCreateInput;
type AssessmentAssignmentCreate = Prisma.AssessmentAssignmentUncheckedCreateInput;
type LessonProgressCreate = Prisma.LessonProgressUncheckedCreateInput;
type AttemptCreate = Prisma.AttemptUncheckedCreateInput;
type ScoreCreate = Prisma.ScoreUncheckedCreateInput;
type LearningEventCreate = Prisma.LearningEventUncheckedCreateInput;
type AccommodationCreate = Prisma.AccommodationUncheckedCreateInput;
type PaymentPlanCreate = Prisma.PaymentPlanUncheckedCreateInput;
type InstallmentCreate = Prisma.InstallmentUncheckedCreateInput;
type PaymentCreate = Prisma.PaymentUncheckedCreateInput;
type PaymentAgreementCreate = Prisma.PaymentAgreementUncheckedCreateInput;
type RestrictionPolicyCreate = Prisma.RestrictionPolicyUncheckedCreateInput;
type LiveSessionCreate = Prisma.LiveSessionUncheckedCreateInput;
type SubmissionCreate = Prisma.SubmissionUncheckedCreateInput;
type CertificateCreate = Prisma.CertificateUncheckedCreateInput;
type ImportRunCreate = Prisma.ImportRunUncheckedCreateInput;
type AuditLogCreate = Prisma.AuditLogUncheckedCreateInput;
type NotificationCreate = Prisma.NotificationUncheckedCreateInput;
type InvitationCreate = Prisma.InvitationUncheckedCreateInput;

/**
 * Factory for Institution
 */
export const institutionFactory = {
  build: (overrides: Partial<InstitutionCreate> = {}): InstitutionCreate => ({
    id: cuid(),
    slug: faker.helpers.slugify(faker.company.name()).toLowerCase(),
    name: faker.company.name(),
    supportEmail: faker.internet.email(),
    emailFromName: faker.company.name(),
    ...overrides,
  }),
  create: async (prisma: PrismaClientType, overrides: Partial<InstitutionCreate> = {}) => {
    return prisma.institution.create({ data: institutionFactory.build(overrides) });
  },
};

/**
 * Factory for Person
 */
export const personFactory = {
  build: (institutionId: string, overrides: Partial<PersonCreate> = {}): PersonCreate => ({
    id: cuid(),
    institutionId,
    givenName: faker.person.firstName(),
    familyName: faker.person.lastName(),
    email: faker.internet.email().toLowerCase(),
    ...overrides,
  }),
  create: async (
    prisma: PrismaClientType,
    institutionId: string,
    overrides: Partial<PersonCreate> = {}
  ) => {
    return prisma.person.create({ data: personFactory.build(institutionId, overrides) });
  },
};

/**
 * Factory for Membership
 */
export const membershipFactory = {
  build: (
    institutionId: string,
    personId: string,
    overrides: Partial<MembershipCreate> = {}
  ): MembershipCreate => ({
    id: cuid(),
    institutionId,
    personId,
    role: 'STUDENT',
    ...overrides,
  }),
  create: async (
    prisma: PrismaClientType,
    institutionId: string,
    personId: string,
    overrides: Partial<MembershipCreate> = {}
  ) => {
    return prisma.membership.create({
      data: membershipFactory.build(institutionId, personId, overrides),
    });
  },
};

/**
 * Factory for Guardianship
 */
export const guardianshipFactory = {
  build: (
    institutionId: string,
    guardianId: string,
    studentId: string,
    overrides: Partial<GuardianshipCreate> = {}
  ): GuardianshipCreate => ({
    id: cuid(),
    institutionId,
    guardianId,
    studentId,
    relationship: 'Padre',
    ...overrides,
  }),
  create: async (
    prisma: PrismaClientType,
    institutionId: string,
    guardianId: string,
    studentId: string,
    overrides: Partial<GuardianshipCreate> = {}
  ) => {
    return prisma.guardianship.create({
      data: guardianshipFactory.build(institutionId, guardianId, studentId, overrides),
    });
  },
};

/**
 * Factory for Consent
 */
export const consentFactory = {
  build: (
    institutionId: string,
    subjectId: string,
    signedById: string,
    overrides: Partial<ConsentCreate> = {}
  ): ConsentCreate => ({
    id: cuid(),
    institutionId,
    subjectId,
    signedById,
    policyVersion: '1',
    channel: 'PLATFORM',
    ...overrides,
  }),
  create: async (
    prisma: PrismaClientType,
    institutionId: string,
    subjectId: string,
    signedById: string,
    overrides: Partial<ConsentCreate> = {}
  ) => {
    return prisma.consent.create({
      data: consentFactory.build(institutionId, subjectId, signedById, overrides),
    });
  },
};

/**
 * Factory for Partner
 */
export const partnerFactory = {
  build: (institutionId: string, overrides: Partial<PartnerCreate> = {}): PartnerCreate => ({
    id: cuid(),
    institutionId,
    name: faker.company.name(),
    ...overrides,
  }),
  create: async (
    prisma: PrismaClientType,
    institutionId: string,
    overrides: Partial<PartnerCreate> = {}
  ) => {
    return prisma.partner.create({ data: partnerFactory.build(institutionId, overrides) });
  },
};

/**
 * Factory for Program
 */
export const programFactory = {
  build: (institutionId: string, overrides: Partial<ProgramCreate> = {}): ProgramCreate => ({
    id: cuid(),
    institutionId,
    code: faker.string.alphanumeric(6).toUpperCase(),
    name: faker.commerce.productName(),
    ...overrides,
  }),
  create: async (
    prisma: PrismaClientType,
    institutionId: string,
    overrides: Partial<ProgramCreate> = {}
  ) => {
    return prisma.program.create({ data: programFactory.build(institutionId, overrides) });
  },
};

/**
 * Factory for Module
 */
export const moduleFactory = {
  build: (
    institutionId: string,
    programId: string,
    position: number,
    overrides: Partial<ModuleCreate> = {}
  ): ModuleCreate => ({
    id: cuid(),
    institutionId,
    programId,
    position,
    name: `Módulo ${position}`,
    ...overrides,
  }),
  create: async (
    prisma: PrismaClientType,
    institutionId: string,
    programId: string,
    position: number,
    overrides: Partial<ModuleCreate> = {}
  ) => {
    return prisma.module.create({
      data: moduleFactory.build(institutionId, programId, position, overrides),
    });
  },
};

/**
 * Factory for Subject
 */
export const subjectFactory = {
  build: (institutionId: string, overrides: Partial<SubjectCreate> = {}): SubjectCreate => ({
    id: cuid(),
    institutionId,
    // @@unique([institutionId, name]): faker has ~20 departments, so add a suffix.
    name: `${faker.commerce.department()} ${faker.string.alphanumeric(6)}`,
    ...overrides,
  }),
  create: async (
    prisma: PrismaClientType,
    institutionId: string,
    overrides: Partial<SubjectCreate> = {}
  ) => {
    return prisma.subject.create({ data: subjectFactory.build(institutionId, overrides) });
  },
};

/**
 * Factory for Cohort
 */
export const cohortFactory = {
  build: (
    institutionId: string,
    programId: string,
    overrides: Partial<CohortCreate> = {}
  ): CohortCreate => ({
    id: cuid(),
    institutionId,
    programId,
    // @@unique([institutionId, code]): a 1..4 suffix collided as soon as a test created 5 cohorts.
    code: `${new Date().getFullYear()}-${faker.string.alphanumeric(6).toUpperCase()}`,
    name: `Cohorte ${faker.number.int({ min: 1, max: 100 })}`,
    startsOn: faker.date.future(),
    endsOn: faker.date.future({ years: 1 }),
    ...overrides,
  }),
  create: async (
    prisma: PrismaClientType,
    institutionId: string,
    programId: string,
    overrides: Partial<CohortCreate> = {}
  ) => {
    return prisma.cohort.create({ data: cohortFactory.build(institutionId, programId, overrides) });
  },
};

/**
 * Factory for Enrollment
 */
export const enrollmentFactory = {
  build: (
    institutionId: string,
    studentId: string,
    cohortId: string,
    overrides: Partial<EnrollmentCreate> = {}
  ): EnrollmentCreate => ({
    id: cuid(),
    institutionId,
    studentId,
    cohortId,
    isMinorAtEnrollment: faker.datatype.boolean(),
    accessUntil: faker.date.future({ years: 1 }),
    ...overrides,
  }),
  create: async (
    prisma: PrismaClientType,
    institutionId: string,
    studentId: string,
    cohortId: string,
    overrides: Partial<EnrollmentCreate> = {}
  ) => {
    return prisma.enrollment.create({
      data: enrollmentFactory.build(institutionId, studentId, cohortId, overrides),
    });
  },
};

/**
 * Factory for Lesson
 */
export const lessonFactory = {
  build: (
    institutionId: string,
    programId: string,
    moduleId: string,
    subjectId: string,
    authorId: string,
    position: number,
    overrides: Partial<LessonCreate> = {}
  ): LessonCreate => ({
    id: cuid(),
    institutionId,
    programId,
    moduleId,
    subjectId,
    authorId,
    position,
    title: faker.lorem.sentence(),
    ...overrides,
  }),
  create: async (
    prisma: PrismaClientType,
    institutionId: string,
    programId: string,
    moduleId: string,
    subjectId: string,
    authorId: string,
    position: number,
    overrides: Partial<LessonCreate> = {}
  ) => {
    return prisma.lesson.create({
      data: lessonFactory.build(
        institutionId,
        programId,
        moduleId,
        subjectId,
        authorId,
        position,
        overrides
      ),
    });
  },
};

/**
 * Factory for LessonVersion
 */
export const lessonVersionFactory = {
  build: (
    institutionId: string,
    lessonId: string,
    number: number,
    overrides: Partial<LessonVersionCreate> = {}
  ): LessonVersionCreate => ({
    id: cuid(),
    institutionId,
    lessonId,
    number,
    content: faker.lorem.paragraphs(3),
    ...overrides,
  }),
  create: async (
    prisma: PrismaClientType,
    institutionId: string,
    lessonId: string,
    number: number,
    overrides: Partial<LessonVersionCreate> = {}
  ) => {
    return prisma.lessonVersion.create({
      data: lessonVersionFactory.build(institutionId, lessonId, number, overrides),
    });
  },
};

/**
 * Factory for MediaAsset
 */
export const mediaAssetFactory = {
  build: (
    institutionId: string,
    uploadedById: string,
    overrides: Partial<MediaAssetCreate> = {}
  ): MediaAssetCreate => ({
    id: cuid(),
    institutionId,
    uploadedById,
    kind: 'VIDEO',
    provider: 'VIMEO',
    providerRef: faker.string.alphanumeric(10),
    ...overrides,
  }),
  create: async (
    prisma: PrismaClientType,
    institutionId: string,
    uploadedById: string,
    overrides: Partial<MediaAssetCreate> = {}
  ) => {
    return prisma.mediaAsset.create({
      data: mediaAssetFactory.build(institutionId, uploadedById, overrides),
    });
  },
};

/**
 * Factory for LessonVersionAsset
 */
export const lessonVersionAssetFactory = {
  build: (
    institutionId: string,
    lessonVersionId: string,
    mediaAssetId: string
  ): LessonVersionAssetCreate => ({
    institutionId,
    lessonVersionId,
    mediaAssetId,
  }),
  create: async (
    prisma: PrismaClientType,
    institutionId: string,
    lessonVersionId: string,
    mediaAssetId: string
  ) => {
    return prisma.lessonVersionAsset.create({
      data: lessonVersionAssetFactory.build(institutionId, lessonVersionId, mediaAssetId),
    });
  },
};

/**
 * Factory for Assessment
 */
export const assessmentFactory = {
  build: (
    institutionId: string,
    programId: string,
    authorId: string,
    overrides: Partial<AssessmentCreate> = {}
  ): AssessmentCreate => ({
    id: cuid(),
    institutionId,
    programId,
    authorId,
    title: faker.lorem.sentence(),
    ...overrides,
  }),
  create: async (
    prisma: PrismaClientType,
    institutionId: string,
    programId: string,
    authorId: string,
    overrides: Partial<AssessmentCreate> = {}
  ) => {
    return prisma.assessment.create({
      data: assessmentFactory.build(institutionId, programId, authorId, overrides),
    });
  },
};

/**
 * Factory for AssessmentVersion
 */
export const assessmentVersionFactory = {
  build: (
    institutionId: string,
    assessmentId: string,
    number: number,
    overrides: Partial<AssessmentVersionCreate> = {}
  ): AssessmentVersionCreate => ({
    id: cuid(),
    institutionId,
    assessmentId,
    number,
    content: { questions: [] },
    answerKey: { answers: {} },
    ...overrides,
  }),
  create: async (
    prisma: PrismaClientType,
    institutionId: string,
    assessmentId: string,
    number: number,
    overrides: Partial<AssessmentVersionCreate> = {}
  ) => {
    return prisma.assessmentVersion.create({
      data: assessmentVersionFactory.build(institutionId, assessmentId, number, overrides),
    });
  },
};

/**
 * Factory for LessonAssignment
 */
export const lessonAssignmentFactory = {
  build: (
    institutionId: string,
    cohortId: string,
    lessonId: string,
    lessonVersionId: string,
    assignedById: string,
    overrides: Partial<LessonAssignmentCreate> = {}
  ): LessonAssignmentCreate => ({
    id: cuid(),
    institutionId,
    cohortId,
    lessonId,
    lessonVersionId,
    assignedById,
    availableFrom: new Date(),
    ...overrides,
  }),
  create: async (
    prisma: PrismaClientType,
    institutionId: string,
    cohortId: string,
    lessonId: string,
    lessonVersionId: string,
    assignedById: string,
    overrides: Partial<LessonAssignmentCreate> = {}
  ) => {
    return prisma.lessonAssignment.create({
      data: lessonAssignmentFactory.build(
        institutionId,
        cohortId,
        lessonId,
        lessonVersionId,
        assignedById,
        overrides
      ),
    });
  },
};

/**
 * Factory for AssessmentAssignment
 */
export const assessmentAssignmentFactory = {
  build: (
    institutionId: string,
    cohortId: string,
    assessmentId: string,
    assessmentVersionId: string,
    assignedById: string,
    overrides: Partial<AssessmentAssignmentCreate> = {}
  ): AssessmentAssignmentCreate => ({
    id: cuid(),
    institutionId,
    cohortId,
    assessmentId,
    assessmentVersionId,
    assignedById,
    availableFrom: new Date(),
    ...overrides,
  }),
  create: async (
    prisma: PrismaClientType,
    institutionId: string,
    cohortId: string,
    assessmentId: string,
    assessmentVersionId: string,
    assignedById: string,
    overrides: Partial<AssessmentAssignmentCreate> = {}
  ) => {
    return prisma.assessmentAssignment.create({
      data: assessmentAssignmentFactory.build(
        institutionId,
        cohortId,
        assessmentId,
        assessmentVersionId,
        assignedById,
        overrides
      ),
    });
  },
};

/**
 * Factory for LessonProgress
 */
export const lessonProgressFactory = {
  build: (
    institutionId: string,
    enrollmentId: string,
    studentId: string,
    lessonAssignmentId: string,
    lessonVersionId: string,
    overrides: Partial<LessonProgressCreate> = {}
  ): LessonProgressCreate => ({
    id: cuid(),
    institutionId,
    enrollmentId,
    studentId,
    lessonAssignmentId,
    lessonVersionId,
    ...overrides,
  }),
  create: async (
    prisma: PrismaClientType,
    institutionId: string,
    enrollmentId: string,
    studentId: string,
    lessonAssignmentId: string,
    lessonVersionId: string,
    overrides: Partial<LessonProgressCreate> = {}
  ) => {
    return prisma.lessonProgress.create({
      data: lessonProgressFactory.build(
        institutionId,
        enrollmentId,
        studentId,
        lessonAssignmentId,
        lessonVersionId,
        overrides
      ),
    });
  },
};

/**
 * Factory for Attempt
 */
export const attemptFactory = {
  build: (
    institutionId: string,
    enrollmentId: string,
    studentId: string,
    assessmentAssignmentId: string,
    assessmentVersionId: string,
    number: number,
    overrides: Partial<AttemptCreate> = {}
  ): AttemptCreate => ({
    id: cuid(),
    institutionId,
    enrollmentId,
    studentId,
    assessmentAssignmentId,
    assessmentVersionId,
    number,
    ...overrides,
  }),
  create: async (
    prisma: PrismaClientType,
    institutionId: string,
    enrollmentId: string,
    studentId: string,
    assessmentAssignmentId: string,
    assessmentVersionId: string,
    number: number,
    overrides: Partial<AttemptCreate> = {}
  ) => {
    return prisma.attempt.create({
      data: attemptFactory.build(
        institutionId,
        enrollmentId,
        studentId,
        assessmentAssignmentId,
        assessmentVersionId,
        number,
        overrides
      ),
    });
  },
};

/**
 * Factory for Score
 */
export const scoreFactory = {
  build: (
    institutionId: string,
    enrollmentId: string,
    studentId: string,
    subjectId: string,
    cohortId: string,
    overrides: Partial<ScoreCreate> = {}
  ): ScoreCreate => ({
    id: cuid(),
    institutionId,
    enrollmentId,
    studentId,
    subjectId,
    cohortId,
    value: faker.number.float({ min: 0, max: 100, fractionDigits: 2 }),
    ...overrides,
  }),
  create: async (
    prisma: PrismaClientType,
    institutionId: string,
    enrollmentId: string,
    studentId: string,
    subjectId: string,
    cohortId: string,
    overrides: Partial<ScoreCreate> = {}
  ) => {
    return prisma.score.create({
      data: scoreFactory.build(
        institutionId,
        enrollmentId,
        studentId,
        subjectId,
        cohortId,
        overrides
      ),
    });
  },
};

/**
 * Factory for LearningEvent
 */
export const learningEventFactory = {
  build: (
    institutionId: string,
    studentId: string,
    overrides: Partial<LearningEventCreate> = {}
  ): LearningEventCreate => ({
    institutionId,
    studentId,
    type: 'lesson.started',
    payload: {},
    ...overrides,
  }),
  create: async (
    prisma: PrismaClientType,
    institutionId: string,
    studentId: string,
    overrides: Partial<LearningEventCreate> = {}
  ) => {
    return prisma.learningEvent.create({
      data: learningEventFactory.build(institutionId, studentId, overrides),
    });
  },
};

/**
 * Factory for Accommodation
 */
export const accommodationFactory = {
  build: (
    institutionId: string,
    studentId: string,
    enrollmentId: string,
    createdById: string,
    overrides: Partial<AccommodationCreate> = {}
  ): AccommodationCreate => ({
    id: cuid(),
    institutionId,
    studentId,
    enrollmentId,
    createdById,
    ...overrides,
  }),
  create: async (
    prisma: PrismaClientType,
    institutionId: string,
    studentId: string,
    enrollmentId: string,
    createdById: string,
    overrides: Partial<AccommodationCreate> = {}
  ) => {
    return prisma.accommodation.create({
      data: accommodationFactory.build(
        institutionId,
        studentId,
        enrollmentId,
        createdById,
        overrides
      ),
    });
  },
};

/**
 * Factory for PaymentPlan
 */
export const paymentPlanFactory = {
  build: (
    institutionId: string,
    enrollmentId: string,
    overrides: Partial<PaymentPlanCreate> = {}
  ): PaymentPlanCreate => ({
    id: cuid(),
    institutionId,
    enrollmentId,
    payerType: 'PERSON',
    totalAmount: faker.number.int({ min: 100000, max: 5000000 }),
    ...overrides,
  }),
  create: async (
    prisma: PrismaClientType,
    institutionId: string,
    enrollmentId: string,
    overrides: Partial<PaymentPlanCreate> = {}
  ) => {
    return prisma.paymentPlan.create({
      data: paymentPlanFactory.build(institutionId, enrollmentId, overrides),
    });
  },
};

/**
 * Factory for Installment
 */
export const installmentFactory = {
  build: (
    institutionId: string,
    paymentPlanId: string,
    position: number,
    overrides: Partial<InstallmentCreate> = {}
  ): InstallmentCreate => ({
    id: cuid(),
    institutionId,
    paymentPlanId,
    position,
    amount: faker.number.int({ min: 50000, max: 1000000 }),
    dueOn: faker.date.future(),
    ...overrides,
  }),
  create: async (
    prisma: PrismaClientType,
    institutionId: string,
    paymentPlanId: string,
    position: number,
    overrides: Partial<InstallmentCreate> = {}
  ) => {
    return prisma.installment.create({
      data: installmentFactory.build(institutionId, paymentPlanId, position, overrides),
    });
  },
};

/**
 * Factory for Payment
 */
export const paymentFactory = {
  build: (
    institutionId: string,
    installmentId: string,
    overrides: Partial<PaymentCreate> = {}
  ): PaymentCreate => ({
    id: cuid(),
    institutionId,
    installmentId,
    amount: faker.number.int({ min: 10000, max: 500000 }),
    method: 'TRANSFER',
    paidAt: new Date(),
    ...overrides,
  }),
  create: async (
    prisma: PrismaClientType,
    institutionId: string,
    installmentId: string,
    overrides: Partial<PaymentCreate> = {}
  ) => {
    return prisma.payment.create({
      data: paymentFactory.build(institutionId, installmentId, overrides),
    });
  },
};

/**
 * Factory for PaymentAgreement
 */
export const paymentAgreementFactory = {
  build: (
    institutionId: string,
    enrollmentId: string,
    overrides: Partial<PaymentAgreementCreate> = {}
  ): PaymentAgreementCreate => ({
    id: cuid(),
    institutionId,
    enrollmentId,
    signedAt: new Date(),
    ...overrides,
  }),
  create: async (
    prisma: PrismaClientType,
    institutionId: string,
    enrollmentId: string,
    overrides: Partial<PaymentAgreementCreate> = {}
  ) => {
    return prisma.paymentAgreement.create({
      data: paymentAgreementFactory.build(institutionId, enrollmentId, overrides),
    });
  },
};

/**
 * Factory for RestrictionPolicy
 */
export const restrictionPolicyFactory = {
  build: (
    institutionId: string,
    updatedById: string,
    overrides: Partial<RestrictionPolicyCreate> = {}
  ): RestrictionPolicyCreate => ({
    id: cuid(),
    institutionId,
    updatedById,
    ...overrides,
  }),
  create: async (
    prisma: PrismaClientType,
    institutionId: string,
    updatedById: string,
    overrides: Partial<RestrictionPolicyCreate> = {}
  ) => {
    return prisma.restrictionPolicy.create({
      data: restrictionPolicyFactory.build(institutionId, updatedById, overrides),
    });
  },
};

/**
 * Factory for LiveSession
 */
export const liveSessionFactory = {
  build: (
    institutionId: string,
    cohortId: string,
    createdById: string,
    overrides: Partial<LiveSessionCreate> = {}
  ): LiveSessionCreate => ({
    id: cuid(),
    institutionId,
    cohortId,
    createdById,
    title: faker.lorem.sentence(),
    startsAt: faker.date.future(),
    endsAt: faker.date.future(),
    url: faker.internet.url(),
    ...overrides,
  }),
  create: async (
    prisma: PrismaClientType,
    institutionId: string,
    cohortId: string,
    createdById: string,
    overrides: Partial<LiveSessionCreate> = {}
  ) => {
    return prisma.liveSession.create({
      data: liveSessionFactory.build(institutionId, cohortId, createdById, overrides),
    });
  },
};

/**
 * Factory for Submission
 */
export const submissionFactory = {
  build: (
    institutionId: string,
    enrollmentId: string,
    lessonAssignmentId: string,
    overrides: Partial<SubmissionCreate> = {}
  ): SubmissionCreate => ({
    id: cuid(),
    institutionId,
    enrollmentId,
    lessonAssignmentId,
    text: faker.lorem.paragraph(),
    ...overrides,
  }),
  create: async (
    prisma: PrismaClientType,
    institutionId: string,
    enrollmentId: string,
    lessonAssignmentId: string,
    overrides: Partial<SubmissionCreate> = {}
  ) => {
    return prisma.submission.create({
      data: submissionFactory.build(institutionId, enrollmentId, lessonAssignmentId, overrides),
    });
  },
};

/**
 * Factory for Certificate
 */
export const certificateFactory = {
  build: (
    institutionId: string,
    enrollmentId: string,
    overrides: Partial<CertificateCreate> = {}
  ): CertificateCreate => ({
    id: cuid(),
    institutionId,
    enrollmentId,
    kind: 'MODULE',
    code: faker.string.alphanumeric(12).toUpperCase(),
    ...overrides,
  }),
  create: async (
    prisma: PrismaClientType,
    institutionId: string,
    enrollmentId: string,
    overrides: Partial<CertificateCreate> = {}
  ) => {
    return prisma.certificate.create({
      data: certificateFactory.build(institutionId, enrollmentId, overrides),
    });
  },
};

/**
 * Factory for ImportRun
 */
export const importRunFactory = {
  build: (
    institutionId: string,
    startedById: string,
    overrides: Partial<ImportRunCreate> = {}
  ): ImportRunCreate => ({
    id: cuid(),
    institutionId,
    startedById,
    source: 'learndash',
    ...overrides,
  }),
  create: async (
    prisma: PrismaClientType,
    institutionId: string,
    startedById: string,
    overrides: Partial<ImportRunCreate> = {}
  ) => {
    return prisma.importRun.create({
      data: importRunFactory.build(institutionId, startedById, overrides),
    });
  },
};

/**
 * Factory for AuditLog
 */
export const auditLogFactory = {
  build: (institutionId: string, overrides: Partial<AuditLogCreate> = {}): AuditLogCreate => ({
    institutionId,
    entity: 'person',
    entityId: cuid(),
    action: 'created',
    ...overrides,
  }),
  create: async (
    prisma: PrismaClientType,
    institutionId: string,
    overrides: Partial<AuditLogCreate> = {}
  ) => {
    return prisma.auditLog.create({ data: auditLogFactory.build(institutionId, overrides) });
  },
};

/**
 * Factory for Notification
 */
export const notificationFactory = {
  build: (
    institutionId: string,
    personId: string,
    overrides: Partial<NotificationCreate> = {}
  ): NotificationCreate => ({
    id: cuid(),
    institutionId,
    personId,
    type: 'enrollment.welcome',
    title: faker.lorem.sentence(),
    body: faker.lorem.paragraph(),
    ...overrides,
  }),
  create: async (
    prisma: PrismaClientType,
    institutionId: string,
    personId: string,
    overrides: Partial<NotificationCreate> = {}
  ) => {
    return prisma.notification.create({
      data: notificationFactory.build(institutionId, personId, overrides),
    });
  },
};

/**
 * Factory for Invitation
 */
export const invitationFactory = {
  build: (
    institutionId: string,
    personId: string,
    createdById: string,
    overrides: Partial<InvitationCreate> = {}
  ): InvitationCreate => ({
    id: cuid(),
    institutionId,
    personId,
    createdById,
    tokenHash: faker.string.alphanumeric(64),
    expiresAt: faker.date.future({ years: 0.1 }),
    ...overrides,
  }),
  create: async (
    prisma: PrismaClientType,
    institutionId: string,
    personId: string,
    createdById: string,
    overrides: Partial<InvitationCreate> = {}
  ) => {
    return prisma.invitation.create({
      data: invitationFactory.build(institutionId, personId, createdById, overrides),
    });
  },
};

/**
 * All factories grouped for easy access
 */
export const factories = {
  institution: institutionFactory,
  person: personFactory,
  membership: membershipFactory,
  guardianship: guardianshipFactory,
  consent: consentFactory,
  partner: partnerFactory,
  program: programFactory,
  module: moduleFactory,
  subject: subjectFactory,
  cohort: cohortFactory,
  enrollment: enrollmentFactory,
  lesson: lessonFactory,
  lessonVersion: lessonVersionFactory,
  mediaAsset: mediaAssetFactory,
  lessonVersionAsset: lessonVersionAssetFactory,
  assessment: assessmentFactory,
  assessmentVersion: assessmentVersionFactory,
  lessonAssignment: lessonAssignmentFactory,
  assessmentAssignment: assessmentAssignmentFactory,
  lessonProgress: lessonProgressFactory,
  attempt: attemptFactory,
  score: scoreFactory,
  learningEvent: learningEventFactory,
  accommodation: accommodationFactory,
  paymentPlan: paymentPlanFactory,
  installment: installmentFactory,
  payment: paymentFactory,
  paymentAgreement: paymentAgreementFactory,
  restrictionPolicy: restrictionPolicyFactory,
  liveSession: liveSessionFactory,
  submission: submissionFactory,
  certificate: certificateFactory,
  importRun: importRunFactory,
  auditLog: auditLogFactory,
  notification: notificationFactory,
  invitation: invitationFactory,
};
