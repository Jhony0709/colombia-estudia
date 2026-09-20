/**
 * State machine for content versions (LessonVersion, AssessmentVersion).
 * SSOT: prisma/schema.prisma:396 (enum PublishStatus),
 * reference/04-business-logic/contenido-y-evaluaciones.md
 *
 * Answers two questions that were previously answered in four services and one screen:
 * which statuses can still be edited, and which transitions exist. A version is the
 * immutable unit: publishing freezes it, so the table lives here and not next to any one
 * endpoint. Capabilities stay at the route, declared literally in `apiHandler`.
 */

// ─────────────────────────── Types ───────────────────────────

export type PublishStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';

export type ContentTransition = 'publish' | 'archive';

export interface TransitionRule {
  /** Statuses the transition can start from. */
  readonly from: readonly PublishStatus[];
  readonly to: PublishStatus;
}

export interface TransitionRefusal {
  readonly allowed: false;
  /** Machine-readable reason, for the caller to map to an APIError code. */
  readonly reason: 'WRONG_STATUS';
  readonly from: PublishStatus;
  readonly expected: readonly PublishStatus[];
}

export type TransitionCheck =
  { readonly allowed: true; readonly to: PublishStatus } | TransitionRefusal;

// ─────────────────────────── Table ───────────────────────────

export const PUBLISH_STATUSES: readonly PublishStatus[] = ['DRAFT', 'PUBLISHED', 'ARCHIVED'];

/**
 * Editing a published or archived version is never allowed: a new draft version is created
 * instead, so that what a student is reading cannot change under them.
 */
export const EDITABLE_STATUSES: readonly PublishStatus[] = ['DRAFT'];

export const CONTENT_VERSION_TRANSITIONS: Readonly<Record<ContentTransition, TransitionRule>> = {
  publish: { from: ['DRAFT'], to: 'PUBLISHED' },
  archive: { from: ['PUBLISHED'], to: 'ARCHIVED' },
};

// ─────────────────────────── Functions ───────────────────────────

/**
 * Narrows a database value to `PublishStatus`.
 *
 * An unknown value falls back to `DRAFT`, which is the restrictive end of the machine:
 * a draft is editable but not readable by students. Prisma's enum makes the fallback
 * unreachable in practice; it exists so callers never hold a widened `string`.
 */
export function toPublishStatus(value: string): PublishStatus {
  return value === 'PUBLISHED' ? 'PUBLISHED' : value === 'ARCHIVED' ? 'ARCHIVED' : 'DRAFT';
}

/** Whether a version in this status still accepts edits. */
export function isVersionEditable(status: PublishStatus): boolean {
  return EDITABLE_STATUSES.includes(status);
}

/** Whether a version in this status is the one students read. */
export function isVersionLive(status: PublishStatus): boolean {
  return status === 'PUBLISHED';
}

/**
 * Whether `action` may run on a version currently in `from`.
 *
 * Only answers the state question. The capability is enforced by `apiHandler`, and the
 * content rules (accessibility, answer keys) by `publish-validation`.
 */
export function canTransition(action: ContentTransition, from: PublishStatus): TransitionCheck {
  const rule = CONTENT_VERSION_TRANSITIONS[action];
  if (!rule.from.includes(from)) {
    return { allowed: false, reason: 'WRONG_STATUS', from, expected: rule.from };
  }
  return { allowed: true, to: rule.to };
}
