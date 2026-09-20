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

/**
 * Escribir un log no puede tumbar el proceso.
 *
 * `pino` con `transport` escribe a través de un **hilo trabajador** (`thread-stream`). Si ese
 * hilo muere —y en `next dev` muere en cada recarga en caliente que reevalúa este módulo— la
 * siguiente llamada a `logger.info` lanza `Error: the worker has exited`, de forma **síncrona**
 * y desde dentro del manejador. Ahí no la recoge nadie: sale como `uncaughtException` y se
 * lleva por delante el servidor de desarrollo. El rastro apunta a `api-handler.ts:174`, que es
 * solo el primer sitio que tocó el flujo ya muerto.
 *
 * Que una línea de registro pueda cancelar una petición es un fallo en sí mismo, en desarrollo
 * y en producción: ninguna respuesta de esta aplicación depende de que el log se escriba. Así
 * que el error se contiene aquí, en un único sitio, y no en los ocho puntos donde se registra.
 *
 * No se traga en silencio para siempre: el primero se escribe en `stderr` a pelo. Un logger
 * mudo que además oculta que está mudo es peor que el fallo original.
 */
const LEVELS = ['fatal', 'error', 'warn', 'info', 'debug', 'trace'] as const;

type LevelMethod = (...args: unknown[]) => void;

function containWriteErrors(base: pino.Logger): pino.Logger {
  let reported = false;
  const target = base as unknown as Record<string, LevelMethod>;

  for (const level of LEVELS) {
    const original = target[level]?.bind(base);
    if (!original) continue;

    target[level] = (...args: unknown[]) => {
      try {
        original(...args);
      } catch (err) {
        if (reported) return;
        reported = true;
        process.stderr.write(
          `[logger] el registro dejó de escribir y se seguirá ignorando: ${String(err)}\n`
        );
      }
    };
  }

  return base;
}

export const logger = containWriteErrors(createLogger());

export type Logger = typeof logger;
