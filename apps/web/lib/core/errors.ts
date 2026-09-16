/**
 * API Error handling.
 * SSOT: reference/02-api/errors.md
 */

export const API_ERROR_CODES = [
  'VALIDATION_ERROR',
  'INVALID_CONTENT',
  'UNAUTHENTICATED',
  'INSUFFICIENT_CAPABILITY',
  'CONSENT_REQUIRED',
  'NOT_FOUND',
  'CONFLICT',
  'ATTEMPT_EXPIRED',
  'ACCESS_EXPIRED',
  'LESSON_LOCKED',
  'RATE_LIMITED',
  'FORBIDDEN_ORIGIN',
  'INTERNAL',
] as const;

export type APIErrorCode = (typeof API_ERROR_CODES)[number];

const STATUS_MAP: Record<APIErrorCode, number> = {
  VALIDATION_ERROR: 400,
  INVALID_CONTENT: 400,
  UNAUTHENTICATED: 401,
  INSUFFICIENT_CAPABILITY: 403,
  CONSENT_REQUIRED: 403,
  FORBIDDEN_ORIGIN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  ATTEMPT_EXPIRED: 410,
  ACCESS_EXPIRED: 410,
  LESSON_LOCKED: 423,
  RATE_LIMITED: 429,
  INTERNAL: 500,
};

/**
 * Standard API error.
 * Message is for the developer (in English).
 * The UI maps `code` to user-facing text via next-intl.
 */
export class APIError extends Error {
  readonly status: number;
  readonly code: APIErrorCode;
  readonly details?: unknown;

  constructor(message: string, code: APIErrorCode, details?: unknown) {
    super(message);
    this.name = 'APIError';
    this.code = code;
    this.status = STATUS_MAP[code];
    this.details = details;
  }
}

export function isAPIError(error: unknown): error is APIError {
  return error instanceof APIError;
}
