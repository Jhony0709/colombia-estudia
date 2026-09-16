/**
 * Catalogs for literal types used in the database.
 * SSOT: reference/05-database/schema.md §"Catálogos"
 *
 * Add a literal = PR that touches the catalog and schema.md, no migration needed.
 */

// ─────────────────────────────────────────────────────────────────────────────
// LearningEvent types
// ─────────────────────────────────────────────────────────────────────────────

export const LEARNING_EVENT_TYPES = [
  'lesson.opened',
  'lesson.video.progress',
  'lesson.transcript.read',
  'lesson.scrolled_to_end',
  'lesson.completed',
  'attempt.started',
  'attempt.answer.saved',
  'attempt.submitted',
  'attempt.graded',
  'assessment.blocked_view',
  'accessible.requested',
  'problem.reported',
] as const;

export type LearningEventType = (typeof LEARNING_EVENT_TYPES)[number];

// ─────────────────────────────────────────────────────────────────────────────
// AuditLog entity/action pairs
// ─────────────────────────────────────────────────────────────────────────────

export const AUDIT_LOG_ENTITIES = [
  'institution',
  'enrollment',
  'certificate',
  'submission',
  'live_session',
  'assignment',
  'lesson_version',
  'accommodation',
  'payment',
  'agreement',
  'policy',
  'membership',
  'person',
  'progress',
  'import',
  'job',
  'invitation',
] as const;

export type AuditLogEntity = (typeof AUDIT_LOG_ENTITIES)[number];

export const AUDIT_LOG_ACTIONS = {
  institution: ['created', 'updated'],
  enrollment: ['created', 'withdrawn', 'extended', 'completed'],
  certificate: ['issued', 'revoked'],
  submission: ['approved', 'returned'],
  live_session: ['created', 'updated'],
  assignment: ['version_changed'],
  lesson_version: ['published', 'legacy_exception'],
  accommodation: ['created', 'updated'],
  payment: ['confirmed', 'voided'],
  agreement: ['signed', 'fulfilled', 'cancelled'],
  policy: ['updated'],
  membership: ['granted', 'revoked'],
  person: ['pii_read', 'anonymized'],
  progress: ['override'],
  import: ['run'],
  job: ['daily'],
  invitation: ['sent', 'accepted'],
} as const;

export type AuditLogAction<E extends AuditLogEntity> = (typeof AUDIT_LOG_ACTIONS)[E][number];

export type AuditLogEntityAction = {
  [E in AuditLogEntity]: `${E}.${AuditLogAction<E>}`;
}[AuditLogEntity];

// ─────────────────────────────────────────────────────────────────────────────
// Notification types
// ─────────────────────────────────────────────────────────────────────────────

export const NOTIFICATION_TYPES = [
  'overdue_reminder',
  'agreement_overdue',
  'attempt_graded',
  'lesson_reopened',
  'accessible_ready',
  'convert_until_soon',
  'problem_reported',
  'submission_reviewed',
  'submission_received',
  'live_session_soon',
  'certificate_issued',
  'payment_confirmed',
  'reinvite_requested',
] as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

// ─────────────────────────────────────────────────────────────────────────────
// Question types for assessments
// ─────────────────────────────────────────────────────────────────────────────

export const QUESTION_TYPES = [
  'single_choice',
  'multiple_choice',
  'true_false',
  'short_text',
] as const;

export type QuestionType = (typeof QUESTION_TYPES)[number];

// ─────────────────────────────────────────────────────────────────────────────
// Capabilities (SSOT: packages/domain/src/capabilities.ts)
// ─────────────────────────────────────────────────────────────────────────────

export const CAPABILITIES = [
  'lesson.read',
  'lesson.progress.own',
  'lesson.author',
  'lesson.publish',
  'assessment.take',
  'assessment.grade',
  'progress.read.cohort',
  'progress.override',
  'score.read.own',
  'accommodation.manage',
  'billing.manage',
  'billing.read.own',
  'people.manage',
  'cohort.manage',
  'institution.manage',
] as const;

export type Capability = (typeof CAPABILITIES)[number];
