/**
 * Prisma error predicates.
 *
 * `@prisma/client` may only be imported from `lib/db/**` (`prisma-solo-en-lib-db` in
 * .dependency-cruiser.js), so the driver-specific knowledge lives here and the services
 * ask a plain question instead of importing Prisma themselves.
 */

import { Prisma } from '@prisma/client';

/** P2002: a unique constraint rejected the write. */
export function isUniqueViolation(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';
}
