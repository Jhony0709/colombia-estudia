/**
 * Type test for Prisma omit configuration
 *
 * This file verifies at compile time that answerKey is omitted from
 * AssessmentVersion queries by default.
 *
 * NOTE: With @swc/jest, TypeScript types are not checked at runtime.
 * The type verification happens during `pnpm type-check`, which includes
 * __tests__ in tsconfig.json.
 *
 * If type-check complains that @ts-expect-error is unused, the omit is broken.
 */

import { prisma } from '@/lib/db/prisma';

describe('Prisma omit configuration', () => {
  it('should have answerKey omitted from AssessmentVersion by default (verified by type-check)', () => {
    // This test exists to document the security requirement.
    // The actual type verification happens at compile time.
    // See the _typeAssertions function below.
    expect(true).toBe(true);
  });
});

/**
 * Type-level assertion that answerKey is NOT present in the default result type.
 *
 * If this function compiles, it proves that:
 * 1. prisma.assessmentVersion.findFirst() returns a type WITHOUT answerKey
 * 2. The omit configuration in prisma.ts is working
 *
 * This is verified by `pnpm type-check`.
 */
async function _typeAssertions() {
  const version = await prisma.assessmentVersion.findFirst();
  if (version) {
    const _id: string = version.id;
    const _content: unknown = version.content;
    // @ts-expect-error answerKey está omitido por defecto (prisma.ts)
    const _leak = version.answerKey;
  }
}

// Ensure the function is never called (it's just for type checking)
void _typeAssertions;
