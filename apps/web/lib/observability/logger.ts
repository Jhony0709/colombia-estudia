/**
 * Structured logging with pino.
 * SSOT: plan/02-fundaciones.md §7
 *
 * Fixed fields: requestId, institutionId, personId (hashed), route, durationMs, status.
 * Redact: PII fields at 1-3 levels.
 */

import pino from 'pino';
import { createHash } from 'crypto';

const isDev = process.env.NODE_ENV === 'development';

/**
 * Hash a person ID to 12 hex characters.
 * Never log the raw ID.
 */
export function hashPersonId(personId: string): string {
  return createHash('sha256').update(personId).digest('hex').slice(0, 12);
}

// PII fields to redact at multiple nesting levels
const PII_FIELDS = [
  'email',
  'documentNumber',
  'givenName',
  'familyName',
  'phone',
  'birthDate',
  'password',
  'token',
  'answerKey',
  'authorization',
  'cookie',
];

// Build redact paths for 1, 2, and 3 levels of nesting
const redactPaths: string[] = [];
for (const field of PII_FIELDS) {
  redactPaths.push(field); // Level 1
  redactPaths.push(`*.${field}`); // Level 2
  redactPaths.push(`*.*.${field}`); // Level 3
}
// Also redact request headers
redactPaths.push('req.headers.authorization');
redactPaths.push('req.headers.cookie');
redactPaths.push('req.headers.*');

const options: pino.LoggerOptions = {
  level: process.env.LOG_LEVEL ?? (isDev ? 'debug' : 'info'),
  redact: {
    paths: redactPaths,
    remove: true,
  },
  transport: isDev ? { target: 'pino-pretty', options: { colorize: true } } : undefined,
};

/**
 * Build a logger with the shared options. `destination` exists for tests: pino decides at
 * construction whether to write through `process.stdout.write` or straight to fd 1
 * (SonicBoom), so tests cannot capture the singleton by patching stdout — that broke as
 * soon as Jest moved the suite to worker processes.
 */
export function createLogger(destination?: pino.DestinationStream) {
  return destination ? pino(options, destination) : pino(options);
}

export const logger = createLogger();

export type Logger = typeof logger;
