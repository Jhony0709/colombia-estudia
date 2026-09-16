/**
 * Tests for lib/db/health.ts
 */

import { checkDatabase } from '@/lib/db/health';

// Mock prisma
jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    $queryRaw: jest.fn(),
  },
}));

import { prisma } from '@/lib/db/prisma';

describe('checkDatabase', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns "ok" when query succeeds', async () => {
    (prisma.$queryRaw as jest.Mock).mockResolvedValue([{ '?column?': 1 }]);

    const result = await checkDatabase();

    expect(result).toBe('ok');
    expect(prisma.$queryRaw).toHaveBeenCalled();
  });

  it('returns "fail" when query throws', async () => {
    (prisma.$queryRaw as jest.Mock).mockRejectedValue(new Error('Connection failed'));

    const result = await checkDatabase();

    expect(result).toBe('fail');
  });
});
