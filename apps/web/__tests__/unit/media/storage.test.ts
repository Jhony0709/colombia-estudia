/**
 * Tests for lib/media/storage.ts
 */

import { checkStorageBucket } from '@/lib/media/storage';

// Mock supabase
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    storage: {
      from: jest.fn(() => ({
        list: jest.fn(),
      })),
    },
  })),
}));

import { createClient } from '@supabase/supabase-js';

describe('checkStorageBucket', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('returns "fail" when env vars are missing', async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_SECRET_KEY;

    const result = await checkStorageBucket();

    expect(result).toBe('fail');
  });

  it('returns "ok" when storage list succeeds', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SECRET_KEY = 'test-key';

    const mockList = jest.fn().mockResolvedValue({ data: [], error: null });
    const mockFrom = jest.fn().mockReturnValue({ list: mockList });
    (createClient as jest.Mock).mockReturnValue({
      storage: { from: mockFrom },
    });

    const result = await checkStorageBucket();

    expect(result).toBe('ok');
    expect(mockFrom).toHaveBeenCalledWith('media');
    expect(mockList).toHaveBeenCalledWith('', { limit: 1 });
  });

  it('returns "fail" when storage list returns error', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SECRET_KEY = 'test-key';

    const mockList = jest.fn().mockResolvedValue({ data: null, error: new Error('Not found') });
    const mockFrom = jest.fn().mockReturnValue({ list: mockList });
    (createClient as jest.Mock).mockReturnValue({
      storage: { from: mockFrom },
    });

    const result = await checkStorageBucket();

    expect(result).toBe('fail');
  });

  it('returns "fail" when storage throws', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SECRET_KEY = 'test-key';

    const mockList = jest.fn().mockRejectedValue(new Error('Network error'));
    const mockFrom = jest.fn().mockReturnValue({ list: mockList });
    (createClient as jest.Mock).mockReturnValue({
      storage: { from: mockFrom },
    });

    const result = await checkStorageBucket();

    expect(result).toBe('fail');
  });
});
