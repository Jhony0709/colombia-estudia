/**
 * Structured logging with pino.
 * SSOT: plan/02-fundaciones.md §7
 *
 * Fixed fields: requestId, institutionId, personId (hashed), route, durationMs, status.
 * Redact: PII fields at 1-3 levels.
 */

import pino from 'pino';
import pretty from 'pino-pretty';
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
};

/**
 * Build a logger with the shared options. `destination` exists for tests: pino decides at
 * construction whether to write through `process.stdout.write` or straight to fd 1
 * (SonicBoom), so tests cannot capture the singleton by patching stdout — that broke as
 * soon as Jest moved the suite to worker processes.
 */
export function createLogger(destination?: pino.DestinationStream) {
  if (destination) return pino(options, destination);
  // En desarrollo, `pino-pretty` como flujo **en el mismo proceso** (27/9), no como
  // `transport`: el transport abre un hilo trabajador (`thread-stream`) que `next dev` mata
  // en cada recarga en caliente, y a partir de ahí cada `logger.info` emitía «the worker has
  // exited». Sin hilo no hay nada que morir. En producción no hay pretty y no hay hilo.
  return isDev ? pino(options, pretty({ colorize: true })) : pino(options);
}

/**
 * Escribir un log no puede tumbar el proceso.
 *
 * Historia: con `pino-pretty` como `transport`, el hilo trabajador (`thread-stream`) moría en
 * cada recarga en caliente de `next dev` y la siguiente escritura fallaba con «the worker has
 * exited». El primer arreglo envolvió cada nivel en `try/catch`, y **no bastó** (27/9): el
 * error no se lanza, `thread-stream` lo **emite** como evento `error` en un `setImmediate`
 * (`thread-stream/index.js`, `function error`), y un flujo sin oyente de `error` lo convierte
 * en `uncaughtException`. El rastro apuntaba a este `try` porque el `Error` se crea en la
 * escritura, aunque explote después. Por eso ahora (1) en desarrollo no hay hilo —ver
 * `createLogger`— y (2) el flujo de destino lleva un oyente de `error`, para que, si alguna
 * vez vuelve a haber un transport, un log que no se puede escribir no cancele una petición.
 *
 * No se traga en silencio para siempre: el primero se escribe en `stderr` a pelo. Un logger
 * mudo que además oculta que está mudo es peor que el fallo original.
 */
const LEVELS = ['fatal', 'error', 'warn', 'info', 'debug', 'trace'] as const;

type LevelMethod = (...args: unknown[]) => void;

function containWriteErrors(base: pino.Logger): pino.Logger {
  let reported = false;
  const target = base as unknown as Record<string, LevelMethod>;

  const stream = (base as unknown as Record<symbol, unknown>)[pino.symbols.streamSym] as
    { on?: (event: 'error', listener: (err: unknown) => void) => unknown } | undefined;
  stream?.on?.('error', (err) => {
    if (reported) return;
    reported = true;
    process.stderr.write(
      `[logger] el registro dejó de escribir y se seguirá ignorando: ${String(err)}\n`
    );
  });

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
