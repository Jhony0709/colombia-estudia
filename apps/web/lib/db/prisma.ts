/**
 * Prisma client singleton
 *
 * SSOT: reference/05-database/schema.md
 *
 * This module provides a singleton Prisma client with:
 * - Global omit for answerKey (security: only grading.ts reads it explicitly)
 * - Connection pooling for serverless
 *
 * DO NOT import this directly in features or routes.
 * Use the tenant-scoped client from ./tenant.ts instead.
 */

import { Prisma, PrismaClient } from '@prisma/client';

// Extend global to store singleton in dev
declare global {
  // eslint-disable-next-line no-var
  var __prisma: ReturnType<typeof createPrismaClient> | undefined;
}

/**
 * Base Prisma client with security omits.
 *
 * answerKey is omitted globally via the omit option.
 * To read answerKey, use explicit select in grading.ts only.
 */
function createPrismaClient() {
  return new PrismaClient({
    omit: {
      assessmentVersion: {
        answerKey: true,
      },
    },
    // In tests, expected failures (e.g. the tenant-isolation test asserting P2025) would
    // otherwise be printed once per model as `prisma:error`.
    log:
      process.env.NODE_ENV === 'development'
        ? (['query', 'error', 'warn'] as Prisma.LogLevel[])
        : process.env.NODE_ENV === 'test'
          ? ([] as Prisma.LogLevel[])
          : (['error'] as Prisma.LogLevel[]),
  });
}

/**
 * Singleton Prisma client.
 *
 * In development, we store the client on globalThis to prevent
 * creating multiple instances during hot reloading.
 */
export const prisma = globalThis.__prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalThis.__prisma = prisma;
}

export type { PrismaClient };
/** El tipo de una columna `Json` al escribirla. Se reexporta para que `features/` no importe `@prisma/client` (regla `prisma-solo-en-lib-db`). */
export type JsonObject = Prisma.InputJsonObject;
/** Ídem para una lista (`string[]`, `{…}[]`) y para poner una columna `Json?` a NULL de base. */
export type JsonValue = Prisma.InputJsonValue;
export const JSON_NULL = Prisma.DbNull;
