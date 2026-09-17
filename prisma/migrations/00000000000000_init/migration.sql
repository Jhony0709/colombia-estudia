-- Colombia Estudia Initial Migration
-- This migration creates all tables, indexes, foreign keys, partial indexes, and RLS policies

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'OPERATIONS', 'INSTRUCTOR', 'INCLUSION_COORDINATOR', 'STUDENT', 'GUARDIAN', 'PARTNER_CONTACT');

-- CreateEnum
CREATE TYPE "ConsentChannel" AS ENUM ('PLATFORM', 'PAPER', 'EMAIL');

-- CreateEnum
CREATE TYPE "CohortStatus" AS ENUM ('PLANNED', 'OPEN', 'CLOSED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "Progression" AS ENUM ('LINEAR', 'FREE');

-- CreateEnum
CREATE TYPE "EnrollmentStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "PublishStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "AssessmentKind" AS ENUM ('DIAGNOSTIC', 'SUBJECT', 'FINAL');

-- CreateEnum
CREATE TYPE "ReviewPolicy" AS ENUM ('NONE', 'SCORE_ONLY', 'FULL_AFTER_GRADED', 'FULL_AFTER_DUE');

-- CreateEnum
CREATE TYPE "MediaKind" AS ENUM ('VIDEO', 'AUDIO', 'IMAGE', 'DOCUMENT');

-- CreateEnum
CREATE TYPE "MediaProvider" AS ENUM ('VIMEO', 'STORAGE', 'YOUTUBE', 'MUX');

-- CreateEnum
CREATE TYPE "MediaStatus" AS ENUM ('PENDING', 'READY', 'ERROR');

-- CreateEnum
CREATE TYPE "CaptionsSource" AS ENUM ('NONE', 'AUTO', 'REVIEWED');

-- CreateEnum
CREATE TYPE "ProgressStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED');

-- CreateEnum
CREATE TYPE "ProgressSource" AS ENUM ('EVIDENCE', 'IMPORTED', 'MANUAL');

-- CreateEnum
CREATE TYPE "AttemptStatus" AS ENUM ('IN_PROGRESS', 'SUBMITTED', 'EXPIRED', 'GRADED');

-- CreateEnum
CREATE TYPE "PayerType" AS ENUM ('PERSON', 'PARTNER');

-- CreateEnum
CREATE TYPE "InstallmentStatus" AS ENUM ('OPEN', 'PARTIALLY_PAID', 'PAID', 'VOID');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('TRANSFER', 'BRE_B', 'CASH', 'GATEWAY');

-- CreateEnum
CREATE TYPE "AgreementStatus" AS ENUM ('ACTIVE', 'FULFILLED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SubmissionStatus" AS ENUM ('SUBMITTED', 'RETURNED', 'APPROVED');

-- CreateEnum
CREATE TYPE "CertificateKind" AS ENUM ('MODULE', 'PROGRAM');

-- CreateTable
CREATE TABLE "Institution" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "legalName" TEXT,
    "taxId" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'America/Bogota',
    "currency" TEXT NOT NULL DEFAULT 'COP',
    "logoAssetId" TEXT,
    "brandColor" TEXT,
    "supportEmail" TEXT NOT NULL,
    "supportPhone" TEXT,
    "emailFromName" TEXT NOT NULL,
    "dataPolicyUrl" TEXT,
    "dataPolicyVersion" TEXT NOT NULL DEFAULT '1',
    "primaryDomain" TEXT,
    "settings" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "Institution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Person" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "givenName" TEXT NOT NULL,
    "familyName" TEXT NOT NULL,
    "documentType" TEXT,
    "documentNumber" TEXT,
    "birthDate" DATE,
    "email" TEXT,
    "phone" TEXT,
    "authUserId" TEXT,
    "sourceRef" TEXT,
    "readingPreferences" JSONB,
    "anonymizedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Person_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Membership" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "Membership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Guardianship" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "guardianId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "relationship" TEXT NOT NULL,
    "isFinancialResponsible" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Guardianship_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Consent" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "signedById" TEXT NOT NULL,
    "policyVersion" TEXT NOT NULL,
    "channel" "ConsentChannel" NOT NULL,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "Consent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Partner" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "taxId" TEXT,
    "contactPersonId" TEXT,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "Partner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Program" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "defaultAccessDays" INTEGER NOT NULL DEFAULT 300,
    "sourceRef" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "Program_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Module" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "sourceRef" TEXT,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "Module_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subject" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "Subject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cohort" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "partnerId" TEXT,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "CohortStatus" NOT NULL DEFAULT 'PLANNED',
    "progression" "Progression" NOT NULL DEFAULT 'LINEAR',
    "startsOn" DATE NOT NULL,
    "endsOn" DATE NOT NULL,
    "accessUntil" DATE,
    "sourceRef" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Cohort_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Enrollment" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "cohortId" TEXT NOT NULL,
    "status" "EnrollmentStatus" NOT NULL DEFAULT 'ACTIVE',
    "isMinorAtEnrollment" BOOLEAN NOT NULL,
    "enrolledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "accessUntil" DATE NOT NULL,
    "completedAt" TIMESTAMP(3),
    "withdrawnAt" TIMESTAMP(3),
    "withdrawReason" TEXT,
    "sourceRef" TEXT,

    CONSTRAINT "Enrollment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lesson" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'es-CO',
    "learningObjective" TEXT,
    "requiresSubmission" BOOLEAN NOT NULL DEFAULT false,
    "authorId" TEXT NOT NULL,
    "sourceRef" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "Lesson_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LessonVersion" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "status" "PublishStatus" NOT NULL DEFAULT 'DRAFT',
    "content" TEXT NOT NULL,
    "estimatedMinutes" INTEGER,
    "invalidatesProgress" BOOLEAN NOT NULL DEFAULT false,
    "accessibilityReport" JSONB,
    "legacyException" JSONB,
    "convertUntil" DATE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishedAt" TIMESTAMP(3),
    "publishedById" TEXT,

    CONSTRAINT "LessonVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LessonVersionAsset" (
    "lessonVersionId" TEXT NOT NULL,
    "mediaAssetId" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,

    CONSTRAINT "LessonVersionAsset_pkey" PRIMARY KEY ("lessonVersionId","mediaAssetId")
);

-- CreateTable
CREATE TABLE "Assessment" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "moduleId" TEXT,
    "subjectId" TEXT,
    "kind" "AssessmentKind" NOT NULL DEFAULT 'SUBJECT',
    "position" INTEGER NOT NULL DEFAULT 0,
    "title" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'es-CO',
    "learningObjective" TEXT,
    "authorId" TEXT NOT NULL,
    "sourceRef" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "Assessment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssessmentVersion" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "status" "PublishStatus" NOT NULL DEFAULT 'DRAFT',
    "content" JSONB NOT NULL,
    "answerKey" JSONB NOT NULL,
    "maxAttempts" INTEGER NOT NULL DEFAULT 1,
    "timeLimitMinutes" INTEGER,
    "passPercent" INTEGER,
    "reviewPolicy" "ReviewPolicy" NOT NULL DEFAULT 'SCORE_ONLY',
    "accessibilityReport" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishedAt" TIMESTAMP(3),
    "publishedById" TEXT,

    CONSTRAINT "AssessmentVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LessonAssignment" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "cohortId" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "lessonVersionId" TEXT NOT NULL,
    "availableFrom" TIMESTAMP(3) NOT NULL,
    "availableUntil" TIMESTAMP(3),
    "assignedById" TEXT NOT NULL,

    CONSTRAINT "LessonAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssessmentAssignment" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "cohortId" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "assessmentVersionId" TEXT NOT NULL,
    "availableFrom" TIMESTAMP(3) NOT NULL,
    "dueAt" TIMESTAMP(3),
    "assignedById" TEXT NOT NULL,

    CONSTRAINT "AssessmentAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MediaAsset" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "kind" "MediaKind" NOT NULL,
    "provider" "MediaProvider" NOT NULL,
    "providerRef" TEXT NOT NULL,
    "status" "MediaStatus" NOT NULL DEFAULT 'PENDING',
    "mimeType" TEXT,
    "sizeBytes" INTEGER,
    "durationSeconds" INTEGER,
    "altText" TEXT,
    "captionsSource" "CaptionsSource" NOT NULL DEFAULT 'NONE',
    "transcriptPath" TEXT,
    "textAlternativePath" TEXT,
    "legacy" BOOLEAN NOT NULL DEFAULT false,
    "uploadedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "MediaAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LessonProgress" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "lessonAssignmentId" TEXT NOT NULL,
    "lessonVersionId" TEXT NOT NULL,
    "status" "ProgressStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "source" "ProgressSource" NOT NULL DEFAULT 'EVIDENCE',
    "evidence" JSONB NOT NULL DEFAULT '{}',
    "startedAt" TIMESTAMP(3),
    "lastActivityAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "LessonProgress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Attempt" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "assessmentAssignmentId" TEXT NOT NULL,
    "assessmentVersionId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "status" "AttemptStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "source" "ProgressSource" NOT NULL DEFAULT 'EVIDENCE',
    "answers" JSONB NOT NULL DEFAULT '{}',
    "appliedAccommodation" JSONB,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deadlineAt" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3),
    "gradedAt" TIMESTAMP(3),
    "gradedById" TEXT,
    "score" DECIMAL(6,2),
    "maxScore" DECIMAL(6,2),

    CONSTRAINT "Attempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Score" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "cohortId" TEXT NOT NULL,
    "value" DECIMAL(5,2) NOT NULL,
    "sourceAttemptId" TEXT,
    "note" TEXT,
    "recordedById" TEXT,
    "publishedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Score_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LearningEvent" (
    "id" BIGSERIAL NOT NULL,
    "institutionId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "enrollmentId" TEXT,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LearningEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Accommodation" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "extraTimeFactor" DECIMAL(3,2) NOT NULL DEFAULT 1,
    "exemptFromTimer" BOOLEAN NOT NULL DEFAULT false,
    "allowedAttemptsBonus" INTEGER NOT NULL DEFAULT 0,
    "requiresCaptions" BOOLEAN NOT NULL DEFAULT false,
    "allowsAssistiveTech" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Accommodation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentPlan" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "payerType" "PayerType" NOT NULL,
    "payerPersonId" TEXT,
    "partnerId" TEXT,
    "totalAmount" DECIMAL(12,0) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Installment" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "paymentPlanId" TEXT NOT NULL,
    "agreementId" TEXT,
    "position" INTEGER NOT NULL,
    "amount" DECIMAL(12,0) NOT NULL,
    "dueOn" DATE NOT NULL,
    "status" "InstallmentStatus" NOT NULL DEFAULT 'OPEN',
    "externalInvoiceRef" TEXT,

    CONSTRAINT "Installment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "installmentId" TEXT NOT NULL,
    "amount" DECIMAL(12,0) NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "reference" TEXT,
    "gatewayRef" TEXT,
    "paidAt" TIMESTAMP(3) NOT NULL,
    "confirmedById" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "voidedById" TEXT,
    "voidedAt" TIMESTAMP(3),
    "voidReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentAgreement" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "payerPersonId" TEXT,
    "partnerId" TEXT,
    "status" "AgreementStatus" NOT NULL DEFAULT 'ACTIVE',
    "signedAt" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentAgreement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RestrictionPolicy" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "requireAgreementForNextCohort" BOOLEAN NOT NULL DEFAULT false,
    "notifyPayerOnOverdue" BOOLEAN NOT NULL DEFAULT false,
    "updatedById" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RestrictionPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LiveSession" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "cohortId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "url" TEXT NOT NULL,
    "recordingId" TEXT,
    "createdById" TEXT NOT NULL,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "LiveSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Submission" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "lessonAssignmentId" TEXT NOT NULL,
    "status" "SubmissionStatus" NOT NULL DEFAULT 'SUBMITTED',
    "text" TEXT,
    "fileAssetId" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "feedback" TEXT,

    CONSTRAINT "Submission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Certificate" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "kind" "CertificateKind" NOT NULL,
    "moduleId" TEXT,
    "code" TEXT NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "revokeReason" TEXT,

    CONSTRAINT "Certificate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportRun" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "dryRun" BOOLEAN NOT NULL DEFAULT true,
    "startedById" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "summary" JSONB,

    CONSTRAINT "ImportRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" BIGSERIAL NOT NULL,
    "institutionId" TEXT NOT NULL,
    "actorId" TEXT,
    "entity" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "href" TEXT,
    "dedupeKey" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invitation" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Invitation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: Standard indexes from Prisma schema
CREATE UNIQUE INDEX "Institution_slug_key" ON "Institution"("slug");
CREATE UNIQUE INDEX "Institution_primaryDomain_key" ON "Institution"("primaryDomain");
CREATE UNIQUE INDEX "Person_authUserId_key" ON "Person"("authUserId");
CREATE INDEX "Person_institutionId_familyName_givenName_idx" ON "Person"("institutionId", "familyName", "givenName");
CREATE UNIQUE INDEX "Person_institutionId_documentType_documentNumber_key" ON "Person"("institutionId", "documentType", "documentNumber");
CREATE UNIQUE INDEX "Person_institutionId_email_key" ON "Person"("institutionId", "email");
CREATE UNIQUE INDEX "Person_institutionId_sourceRef_key" ON "Person"("institutionId", "sourceRef");
CREATE INDEX "Membership_institutionId_role_idx" ON "Membership"("institutionId", "role");
CREATE INDEX "Membership_personId_role_revokedAt_idx" ON "Membership"("personId", "role", "revokedAt");
CREATE INDEX "Guardianship_studentId_idx" ON "Guardianship"("studentId");
CREATE UNIQUE INDEX "Guardianship_guardianId_studentId_key" ON "Guardianship"("guardianId", "studentId");
CREATE INDEX "Consent_institutionId_subjectId_revokedAt_idx" ON "Consent"("institutionId", "subjectId", "revokedAt");
CREATE UNIQUE INDEX "Partner_institutionId_name_key" ON "Partner"("institutionId", "name");
CREATE UNIQUE INDEX "Program_institutionId_code_key" ON "Program"("institutionId", "code");
CREATE UNIQUE INDEX "Program_institutionId_sourceRef_key" ON "Program"("institutionId", "sourceRef");
CREATE UNIQUE INDEX "Module_programId_position_key" ON "Module"("programId", "position");
CREATE UNIQUE INDEX "Module_institutionId_sourceRef_key" ON "Module"("institutionId", "sourceRef");
CREATE UNIQUE INDEX "Subject_institutionId_name_key" ON "Subject"("institutionId", "name");
CREATE INDEX "Cohort_programId_status_idx" ON "Cohort"("programId", "status");
CREATE UNIQUE INDEX "Cohort_institutionId_code_key" ON "Cohort"("institutionId", "code");
CREATE UNIQUE INDEX "Cohort_institutionId_sourceRef_key" ON "Cohort"("institutionId", "sourceRef");
CREATE INDEX "Enrollment_institutionId_cohortId_status_idx" ON "Enrollment"("institutionId", "cohortId", "status");
CREATE UNIQUE INDEX "Enrollment_studentId_cohortId_key" ON "Enrollment"("studentId", "cohortId");
CREATE UNIQUE INDEX "Enrollment_institutionId_sourceRef_key" ON "Enrollment"("institutionId", "sourceRef");
CREATE INDEX "Lesson_institutionId_programId_subjectId_idx" ON "Lesson"("institutionId", "programId", "subjectId");
CREATE UNIQUE INDEX "Lesson_moduleId_position_key" ON "Lesson"("moduleId", "position");
CREATE UNIQUE INDEX "Lesson_institutionId_sourceRef_key" ON "Lesson"("institutionId", "sourceRef");
CREATE INDEX "LessonVersion_institutionId_status_convertUntil_idx" ON "LessonVersion"("institutionId", "status", "convertUntil");
CREATE UNIQUE INDEX "LessonVersion_lessonId_number_key" ON "LessonVersion"("lessonId", "number");
CREATE INDEX "LessonVersionAsset_institutionId_mediaAssetId_idx" ON "LessonVersionAsset"("institutionId", "mediaAssetId");
CREATE INDEX "Assessment_institutionId_programId_idx" ON "Assessment"("institutionId", "programId");
CREATE UNIQUE INDEX "Assessment_moduleId_position_key" ON "Assessment"("moduleId", "position");
CREATE UNIQUE INDEX "Assessment_institutionId_sourceRef_key" ON "Assessment"("institutionId", "sourceRef");
CREATE UNIQUE INDEX "AssessmentVersion_assessmentId_number_key" ON "AssessmentVersion"("assessmentId", "number");
CREATE INDEX "LessonAssignment_institutionId_cohortId_idx" ON "LessonAssignment"("institutionId", "cohortId");
CREATE UNIQUE INDEX "LessonAssignment_cohortId_lessonId_key" ON "LessonAssignment"("cohortId", "lessonId");
CREATE INDEX "AssessmentAssignment_institutionId_cohortId_idx" ON "AssessmentAssignment"("institutionId", "cohortId");
CREATE UNIQUE INDEX "AssessmentAssignment_cohortId_assessmentId_key" ON "AssessmentAssignment"("cohortId", "assessmentId");
CREATE INDEX "MediaAsset_institutionId_kind_legacy_idx" ON "MediaAsset"("institutionId", "kind", "legacy");
CREATE UNIQUE INDEX "MediaAsset_institutionId_provider_providerRef_key" ON "MediaAsset"("institutionId", "provider", "providerRef");
CREATE INDEX "LessonProgress_institutionId_lessonAssignmentId_status_idx" ON "LessonProgress"("institutionId", "lessonAssignmentId", "status");
CREATE UNIQUE INDEX "LessonProgress_enrollmentId_lessonAssignmentId_key" ON "LessonProgress"("enrollmentId", "lessonAssignmentId");
CREATE INDEX "Attempt_institutionId_assessmentAssignmentId_status_idx" ON "Attempt"("institutionId", "assessmentAssignmentId", "status");
CREATE UNIQUE INDEX "Attempt_enrollmentId_assessmentAssignmentId_number_key" ON "Attempt"("enrollmentId", "assessmentAssignmentId", "number");
CREATE INDEX "Score_institutionId_cohortId_idx" ON "Score"("institutionId", "cohortId");
CREATE UNIQUE INDEX "Score_enrollmentId_subjectId_key" ON "Score"("enrollmentId", "subjectId");
CREATE INDEX "LearningEvent_studentId_occurredAt_idx" ON "LearningEvent"("studentId", "occurredAt");
CREATE INDEX "LearningEvent_institutionId_type_occurredAt_idx" ON "LearningEvent"("institutionId", "type", "occurredAt");
CREATE UNIQUE INDEX "Accommodation_enrollmentId_key" ON "Accommodation"("enrollmentId");
CREATE UNIQUE INDEX "PaymentPlan_enrollmentId_key" ON "PaymentPlan"("enrollmentId");
CREATE INDEX "PaymentPlan_institutionId_partnerId_idx" ON "PaymentPlan"("institutionId", "partnerId");
CREATE INDEX "Installment_institutionId_status_dueOn_idx" ON "Installment"("institutionId", "status", "dueOn");
CREATE UNIQUE INDEX "Installment_paymentPlanId_position_key" ON "Installment"("paymentPlanId", "position");
CREATE UNIQUE INDEX "Payment_gatewayRef_key" ON "Payment"("gatewayRef");
CREATE INDEX "Payment_institutionId_installmentId_idx" ON "Payment"("institutionId", "installmentId");
CREATE INDEX "PaymentAgreement_institutionId_enrollmentId_status_idx" ON "PaymentAgreement"("institutionId", "enrollmentId", "status");
CREATE UNIQUE INDEX "RestrictionPolicy_institutionId_key" ON "RestrictionPolicy"("institutionId");
CREATE INDEX "LiveSession_institutionId_cohortId_startsAt_idx" ON "LiveSession"("institutionId", "cohortId", "startsAt");
CREATE INDEX "Submission_institutionId_lessonAssignmentId_status_idx" ON "Submission"("institutionId", "lessonAssignmentId", "status");
CREATE INDEX "Submission_enrollmentId_idx" ON "Submission"("enrollmentId");
CREATE UNIQUE INDEX "Certificate_code_key" ON "Certificate"("code");
CREATE INDEX "Certificate_institutionId_issuedAt_idx" ON "Certificate"("institutionId", "issuedAt");
CREATE UNIQUE INDEX "Certificate_enrollmentId_kind_moduleId_key" ON "Certificate"("enrollmentId", "kind", "moduleId");
CREATE INDEX "ImportRun_institutionId_startedAt_idx" ON "ImportRun"("institutionId", "startedAt");
CREATE INDEX "AuditLog_institutionId_entity_entityId_idx" ON "AuditLog"("institutionId", "entity", "entityId");
CREATE INDEX "AuditLog_institutionId_occurredAt_idx" ON "AuditLog"("institutionId", "occurredAt");
CREATE INDEX "Notification_personId_readAt_idx" ON "Notification"("personId", "readAt");
CREATE UNIQUE INDEX "Notification_personId_dedupeKey_key" ON "Notification"("personId", "dedupeKey");
CREATE INDEX "Invitation_institutionId_personId_idx" ON "Invitation"("institutionId", "personId");
CREATE INDEX "Invitation_tokenHash_idx" ON "Invitation"("tokenHash");

-- Partial Indexes (not expressible in Prisma schema)
-- Membership: unique (personId, role) where revokedAt IS NULL - allows re-granting without losing history
CREATE UNIQUE INDEX "Membership_personId_role_active_key" ON "Membership"("personId", "role") WHERE "revokedAt" IS NULL;

-- Attempt: unique (enrollmentId, assessmentAssignmentId) where status = 'IN_PROGRESS' - only one active attempt at a time
CREATE UNIQUE INDEX "Attempt_enrollment_assignment_in_progress_key" ON "Attempt"("enrollmentId", "assessmentAssignmentId") WHERE "status" = 'IN_PROGRESS';

-- Certificate: unique (enrollmentId) where kind = 'PROGRAM' - only one program certificate per enrollment
CREATE UNIQUE INDEX "Certificate_enrollmentId_program_key" ON "Certificate"("enrollmentId") WHERE "kind" = 'PROGRAM';

-- Person: unique (institutionId, lower(email)) where email IS NOT NULL - case-insensitive email per institution
CREATE UNIQUE INDEX "person_email_ci_unique" ON "Person"("institutionId", lower(email)) WHERE email IS NOT NULL;

-- AddForeignKey
ALTER TABLE "Person" ADD CONSTRAINT "Person_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Guardianship" ADD CONSTRAINT "Guardianship_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Guardianship" ADD CONSTRAINT "Guardianship_guardianId_fkey" FOREIGN KEY ("guardianId") REFERENCES "Person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Guardianship" ADD CONSTRAINT "Guardianship_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Consent" ADD CONSTRAINT "Consent_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Consent" ADD CONSTRAINT "Consent_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Consent" ADD CONSTRAINT "Consent_signedById_fkey" FOREIGN KEY ("signedById") REFERENCES "Person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Partner" ADD CONSTRAINT "Partner_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Partner" ADD CONSTRAINT "Partner_contactPersonId_fkey" FOREIGN KEY ("contactPersonId") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Program" ADD CONSTRAINT "Program_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Module" ADD CONSTRAINT "Module_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Module" ADD CONSTRAINT "Module_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Subject" ADD CONSTRAINT "Subject_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Cohort" ADD CONSTRAINT "Cohort_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Cohort" ADD CONSTRAINT "Cohort_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Cohort" ADD CONSTRAINT "Cohort_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_cohortId_fkey" FOREIGN KEY ("cohortId") REFERENCES "Cohort"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Lesson" ADD CONSTRAINT "Lesson_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Lesson" ADD CONSTRAINT "Lesson_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Lesson" ADD CONSTRAINT "Lesson_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "Module"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Lesson" ADD CONSTRAINT "Lesson_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Lesson" ADD CONSTRAINT "Lesson_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "Person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LessonVersion" ADD CONSTRAINT "LessonVersion_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LessonVersion" ADD CONSTRAINT "LessonVersion_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LessonVersionAsset" ADD CONSTRAINT "LessonVersionAsset_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LessonVersionAsset" ADD CONSTRAINT "LessonVersionAsset_lessonVersionId_fkey" FOREIGN KEY ("lessonVersionId") REFERENCES "LessonVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LessonVersionAsset" ADD CONSTRAINT "LessonVersionAsset_mediaAssetId_fkey" FOREIGN KEY ("mediaAssetId") REFERENCES "MediaAsset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Assessment" ADD CONSTRAINT "Assessment_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Assessment" ADD CONSTRAINT "Assessment_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Assessment" ADD CONSTRAINT "Assessment_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "Module"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Assessment" ADD CONSTRAINT "Assessment_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Assessment" ADD CONSTRAINT "Assessment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "Person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AssessmentVersion" ADD CONSTRAINT "AssessmentVersion_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AssessmentVersion" ADD CONSTRAINT "AssessmentVersion_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LessonAssignment" ADD CONSTRAINT "LessonAssignment_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LessonAssignment" ADD CONSTRAINT "LessonAssignment_cohortId_fkey" FOREIGN KEY ("cohortId") REFERENCES "Cohort"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LessonAssignment" ADD CONSTRAINT "LessonAssignment_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LessonAssignment" ADD CONSTRAINT "LessonAssignment_lessonVersionId_fkey" FOREIGN KEY ("lessonVersionId") REFERENCES "LessonVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AssessmentAssignment" ADD CONSTRAINT "AssessmentAssignment_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AssessmentAssignment" ADD CONSTRAINT "AssessmentAssignment_cohortId_fkey" FOREIGN KEY ("cohortId") REFERENCES "Cohort"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AssessmentAssignment" ADD CONSTRAINT "AssessmentAssignment_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AssessmentAssignment" ADD CONSTRAINT "AssessmentAssignment_assessmentVersionId_fkey" FOREIGN KEY ("assessmentVersionId") REFERENCES "AssessmentVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MediaAsset" ADD CONSTRAINT "MediaAsset_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MediaAsset" ADD CONSTRAINT "MediaAsset_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "Person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LessonProgress" ADD CONSTRAINT "LessonProgress_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LessonProgress" ADD CONSTRAINT "LessonProgress_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LessonProgress" ADD CONSTRAINT "LessonProgress_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LessonProgress" ADD CONSTRAINT "LessonProgress_lessonAssignmentId_fkey" FOREIGN KEY ("lessonAssignmentId") REFERENCES "LessonAssignment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LessonProgress" ADD CONSTRAINT "LessonProgress_lessonVersionId_fkey" FOREIGN KEY ("lessonVersionId") REFERENCES "LessonVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Attempt" ADD CONSTRAINT "Attempt_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Attempt" ADD CONSTRAINT "Attempt_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Attempt" ADD CONSTRAINT "Attempt_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Attempt" ADD CONSTRAINT "Attempt_gradedById_fkey" FOREIGN KEY ("gradedById") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Attempt" ADD CONSTRAINT "Attempt_assessmentAssignmentId_fkey" FOREIGN KEY ("assessmentAssignmentId") REFERENCES "AssessmentAssignment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Attempt" ADD CONSTRAINT "Attempt_assessmentVersionId_fkey" FOREIGN KEY ("assessmentVersionId") REFERENCES "AssessmentVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Score" ADD CONSTRAINT "Score_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Score" ADD CONSTRAINT "Score_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Score" ADD CONSTRAINT "Score_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Score" ADD CONSTRAINT "Score_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Score" ADD CONSTRAINT "Score_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Score" ADD CONSTRAINT "Score_cohortId_fkey" FOREIGN KEY ("cohortId") REFERENCES "Cohort"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Score" ADD CONSTRAINT "Score_sourceAttemptId_fkey" FOREIGN KEY ("sourceAttemptId") REFERENCES "Attempt"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "LearningEvent" ADD CONSTRAINT "LearningEvent_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LearningEvent" ADD CONSTRAINT "LearningEvent_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Accommodation" ADD CONSTRAINT "Accommodation_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Accommodation" ADD CONSTRAINT "Accommodation_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Accommodation" ADD CONSTRAINT "Accommodation_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PaymentPlan" ADD CONSTRAINT "PaymentPlan_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PaymentPlan" ADD CONSTRAINT "PaymentPlan_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PaymentPlan" ADD CONSTRAINT "PaymentPlan_payerPersonId_fkey" FOREIGN KEY ("payerPersonId") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PaymentPlan" ADD CONSTRAINT "PaymentPlan_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Installment" ADD CONSTRAINT "Installment_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Installment" ADD CONSTRAINT "Installment_paymentPlanId_fkey" FOREIGN KEY ("paymentPlanId") REFERENCES "PaymentPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Installment" ADD CONSTRAINT "Installment_agreementId_fkey" FOREIGN KEY ("agreementId") REFERENCES "PaymentAgreement"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_installmentId_fkey" FOREIGN KEY ("installmentId") REFERENCES "Installment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PaymentAgreement" ADD CONSTRAINT "PaymentAgreement_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PaymentAgreement" ADD CONSTRAINT "PaymentAgreement_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PaymentAgreement" ADD CONSTRAINT "PaymentAgreement_payerPersonId_fkey" FOREIGN KEY ("payerPersonId") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PaymentAgreement" ADD CONSTRAINT "PaymentAgreement_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RestrictionPolicy" ADD CONSTRAINT "RestrictionPolicy_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LiveSession" ADD CONSTRAINT "LiveSession_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LiveSession" ADD CONSTRAINT "LiveSession_cohortId_fkey" FOREIGN KEY ("cohortId") REFERENCES "Cohort"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_lessonAssignmentId_fkey" FOREIGN KEY ("lessonAssignmentId") REFERENCES "LessonAssignment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_fileAssetId_fkey" FOREIGN KEY ("fileAssetId") REFERENCES "MediaAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Certificate" ADD CONSTRAINT "Certificate_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Certificate" ADD CONSTRAINT "Certificate_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Certificate" ADD CONSTRAINT "Certificate_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "Module"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ImportRun" ADD CONSTRAINT "ImportRun_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- RLS Policies
-- All tables deny access by default to anon and authenticated roles.
-- Access is only through service_role via the server-side Prisma client.

-- The policies below name the Supabase roles `anon` and `authenticated`. On plain Postgres
-- (integration tests, CI) those roles do not exist: create them, without login, if missing.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN;
  END IF;
END
$$;

ALTER TABLE "Institution" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Person" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Membership" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Guardianship" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Consent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Partner" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Program" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Module" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Subject" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Cohort" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Enrollment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Lesson" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LessonVersion" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LessonVersionAsset" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Assessment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AssessmentVersion" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LessonAssignment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AssessmentAssignment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "MediaAsset" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LessonProgress" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Attempt" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Score" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LearningEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Accommodation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PaymentPlan" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Installment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Payment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PaymentAgreement" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RestrictionPolicy" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LiveSession" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Submission" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Certificate" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ImportRun" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AuditLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Notification" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Invitation" ENABLE ROW LEVEL SECURITY;

-- Default deny policies for anon role
CREATE POLICY "deny_anon" ON "Institution" FOR ALL TO anon USING (false);
CREATE POLICY "deny_anon" ON "Person" FOR ALL TO anon USING (false);
CREATE POLICY "deny_anon" ON "Membership" FOR ALL TO anon USING (false);
CREATE POLICY "deny_anon" ON "Guardianship" FOR ALL TO anon USING (false);
CREATE POLICY "deny_anon" ON "Consent" FOR ALL TO anon USING (false);
CREATE POLICY "deny_anon" ON "Partner" FOR ALL TO anon USING (false);
CREATE POLICY "deny_anon" ON "Program" FOR ALL TO anon USING (false);
CREATE POLICY "deny_anon" ON "Module" FOR ALL TO anon USING (false);
CREATE POLICY "deny_anon" ON "Subject" FOR ALL TO anon USING (false);
CREATE POLICY "deny_anon" ON "Cohort" FOR ALL TO anon USING (false);
CREATE POLICY "deny_anon" ON "Enrollment" FOR ALL TO anon USING (false);
CREATE POLICY "deny_anon" ON "Lesson" FOR ALL TO anon USING (false);
CREATE POLICY "deny_anon" ON "LessonVersion" FOR ALL TO anon USING (false);
CREATE POLICY "deny_anon" ON "LessonVersionAsset" FOR ALL TO anon USING (false);
CREATE POLICY "deny_anon" ON "Assessment" FOR ALL TO anon USING (false);
CREATE POLICY "deny_anon" ON "AssessmentVersion" FOR ALL TO anon USING (false);
CREATE POLICY "deny_anon" ON "LessonAssignment" FOR ALL TO anon USING (false);
CREATE POLICY "deny_anon" ON "AssessmentAssignment" FOR ALL TO anon USING (false);
CREATE POLICY "deny_anon" ON "MediaAsset" FOR ALL TO anon USING (false);
CREATE POLICY "deny_anon" ON "LessonProgress" FOR ALL TO anon USING (false);
CREATE POLICY "deny_anon" ON "Attempt" FOR ALL TO anon USING (false);
CREATE POLICY "deny_anon" ON "Score" FOR ALL TO anon USING (false);
CREATE POLICY "deny_anon" ON "LearningEvent" FOR ALL TO anon USING (false);
CREATE POLICY "deny_anon" ON "Accommodation" FOR ALL TO anon USING (false);
CREATE POLICY "deny_anon" ON "PaymentPlan" FOR ALL TO anon USING (false);
CREATE POLICY "deny_anon" ON "Installment" FOR ALL TO anon USING (false);
CREATE POLICY "deny_anon" ON "Payment" FOR ALL TO anon USING (false);
CREATE POLICY "deny_anon" ON "PaymentAgreement" FOR ALL TO anon USING (false);
CREATE POLICY "deny_anon" ON "RestrictionPolicy" FOR ALL TO anon USING (false);
CREATE POLICY "deny_anon" ON "LiveSession" FOR ALL TO anon USING (false);
CREATE POLICY "deny_anon" ON "Submission" FOR ALL TO anon USING (false);
CREATE POLICY "deny_anon" ON "Certificate" FOR ALL TO anon USING (false);
CREATE POLICY "deny_anon" ON "ImportRun" FOR ALL TO anon USING (false);
CREATE POLICY "deny_anon" ON "AuditLog" FOR ALL TO anon USING (false);
CREATE POLICY "deny_anon" ON "Notification" FOR ALL TO anon USING (false);
CREATE POLICY "deny_anon" ON "Invitation" FOR ALL TO anon USING (false);

-- Default deny policies for authenticated role (direct DB access)
CREATE POLICY "deny_authenticated" ON "Institution" FOR ALL TO authenticated USING (false);
CREATE POLICY "deny_authenticated" ON "Person" FOR ALL TO authenticated USING (false);
CREATE POLICY "deny_authenticated" ON "Membership" FOR ALL TO authenticated USING (false);
CREATE POLICY "deny_authenticated" ON "Guardianship" FOR ALL TO authenticated USING (false);
CREATE POLICY "deny_authenticated" ON "Consent" FOR ALL TO authenticated USING (false);
CREATE POLICY "deny_authenticated" ON "Partner" FOR ALL TO authenticated USING (false);
CREATE POLICY "deny_authenticated" ON "Program" FOR ALL TO authenticated USING (false);
CREATE POLICY "deny_authenticated" ON "Module" FOR ALL TO authenticated USING (false);
CREATE POLICY "deny_authenticated" ON "Subject" FOR ALL TO authenticated USING (false);
CREATE POLICY "deny_authenticated" ON "Cohort" FOR ALL TO authenticated USING (false);
CREATE POLICY "deny_authenticated" ON "Enrollment" FOR ALL TO authenticated USING (false);
CREATE POLICY "deny_authenticated" ON "Lesson" FOR ALL TO authenticated USING (false);
CREATE POLICY "deny_authenticated" ON "LessonVersion" FOR ALL TO authenticated USING (false);
CREATE POLICY "deny_authenticated" ON "LessonVersionAsset" FOR ALL TO authenticated USING (false);
CREATE POLICY "deny_authenticated" ON "Assessment" FOR ALL TO authenticated USING (false);
CREATE POLICY "deny_authenticated" ON "AssessmentVersion" FOR ALL TO authenticated USING (false);
CREATE POLICY "deny_authenticated" ON "LessonAssignment" FOR ALL TO authenticated USING (false);
CREATE POLICY "deny_authenticated" ON "AssessmentAssignment" FOR ALL TO authenticated USING (false);
CREATE POLICY "deny_authenticated" ON "MediaAsset" FOR ALL TO authenticated USING (false);
CREATE POLICY "deny_authenticated" ON "LessonProgress" FOR ALL TO authenticated USING (false);
CREATE POLICY "deny_authenticated" ON "Attempt" FOR ALL TO authenticated USING (false);
CREATE POLICY "deny_authenticated" ON "Score" FOR ALL TO authenticated USING (false);
CREATE POLICY "deny_authenticated" ON "LearningEvent" FOR ALL TO authenticated USING (false);
CREATE POLICY "deny_authenticated" ON "Accommodation" FOR ALL TO authenticated USING (false);
CREATE POLICY "deny_authenticated" ON "PaymentPlan" FOR ALL TO authenticated USING (false);
CREATE POLICY "deny_authenticated" ON "Installment" FOR ALL TO authenticated USING (false);
CREATE POLICY "deny_authenticated" ON "Payment" FOR ALL TO authenticated USING (false);
CREATE POLICY "deny_authenticated" ON "PaymentAgreement" FOR ALL TO authenticated USING (false);
CREATE POLICY "deny_authenticated" ON "RestrictionPolicy" FOR ALL TO authenticated USING (false);
CREATE POLICY "deny_authenticated" ON "LiveSession" FOR ALL TO authenticated USING (false);
CREATE POLICY "deny_authenticated" ON "Submission" FOR ALL TO authenticated USING (false);
CREATE POLICY "deny_authenticated" ON "Certificate" FOR ALL TO authenticated USING (false);
CREATE POLICY "deny_authenticated" ON "ImportRun" FOR ALL TO authenticated USING (false);
CREATE POLICY "deny_authenticated" ON "AuditLog" FOR ALL TO authenticated USING (false);
CREATE POLICY "deny_authenticated" ON "Notification" FOR ALL TO authenticated USING (false);
CREATE POLICY "deny_authenticated" ON "Invitation" FOR ALL TO authenticated USING (false);
