/**
 * Database health check.
 */

import { prisma } from './prisma';

export async function checkDatabase(): Promise<'ok' | 'fail'> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return 'ok';
  } catch {
    return 'fail';
  }
}
