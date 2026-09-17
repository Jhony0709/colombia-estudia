/**
 * @colombia-estudia/domain
 *
 * Pure business logic with no runtime dependencies.
 * Receives data and `now`, returns decisions.
 *
 * SSOT for:
 * - Capabilities with scope
 * - Account status derivation
 * - Attempt policy (deadline, attempts allowed)
 * - Publish validation
 * - Grading
 * - Lesson and enrollment completion
 * - Metrics
 */

export * from './dates';
export * from './types';
export * from './capabilities';
export * from './account-status';
export * from './attempt-policy';
export * from './publish-validation';
export * from './grading';
export * from './lesson-completion';
export * from './enrollment-completion';
export * from './metrics';
