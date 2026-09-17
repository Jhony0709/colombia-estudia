-- Partial indexes for conditional uniqueness (not expressible in Prisma schema)
-- Source of truth: apply manually if not in migration
-- SSOT: reference/05-database/schema.md

-- Membership: unique (personId, role) where revokedAt IS NULL - allows re-granting without losing history
CREATE UNIQUE INDEX IF NOT EXISTS "Membership_personId_role_active_key" ON "Membership"("personId", "role") WHERE "revokedAt" IS NULL;

-- Attempt: unique (enrollmentId, assessmentAssignmentId) where status = 'IN_PROGRESS' - only one active attempt at a time
CREATE UNIQUE INDEX IF NOT EXISTS "Attempt_enrollment_assignment_in_progress_key" ON "Attempt"("enrollmentId", "assessmentAssignmentId") WHERE "status" = 'IN_PROGRESS';

-- Certificate: unique (enrollmentId) where kind = 'PROGRAM' - only one program certificate per enrollment
CREATE UNIQUE INDEX IF NOT EXISTS "Certificate_enrollmentId_program_key" ON "Certificate"("enrollmentId") WHERE "kind" = 'PROGRAM';

-- Person: unique (institutionId, lower(email)) where email IS NOT NULL - case-insensitive email per institution
CREATE UNIQUE INDEX IF NOT EXISTS "person_email_ci_unique" ON "Person"("institutionId", lower(email)) WHERE email IS NOT NULL;
