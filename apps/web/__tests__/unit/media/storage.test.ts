/**
 * Tests for lib/media/storage.ts
 */

import { checkStorageBucket, putBytes, removeObjects } from '@/lib/media/storage';

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

// 27/11: los archivos del chat se guardan como bytes y se borran por tandas.
describe('putBytes y removeObjects', () => {
  const upload = jest.fn();
  const remove = jest.fn();

  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SECRET_KEY = 'test-key';
    upload.mockReset().mockResolvedValue({ error: null });
    remove.mockReset().mockResolvedValue({ error: null });
    (createClient as jest.Mock).mockReturnValue({
      storage: { from: jest.fn().mockReturnValue({ upload, remove }) },
    });
  });

  it('putBytes sube con su tipo y reemplaza si existe', async () => {
    await putBytes('institutions/i/chat/m.ogg', new ArrayBuffer(2), 'audio/ogg');
    expect(upload).toHaveBeenCalledWith('institutions/i/chat/m.ogg', expect.any(Blob), {
      contentType: 'audio/ogg',
      upsert: true,
    });
  });

  it('putBytes lanza si Storage falla', async () => {
    upload.mockResolvedValue({ error: { message: 'lleno' } });
    await expect(putBytes('p', new ArrayBuffer(1), 'audio/ogg')).rejects.toThrow('lleno');
  });

  it('removeObjects borra de a 100 y sin lista no llama', async () => {
    const paths = Array.from({ length: 150 }, (_, i) => `p/${i}`);
    await removeObjects(paths);
    expect(remove).toHaveBeenCalledTimes(2);
    expect(remove.mock.calls[0][0]).toHaveLength(100);
    expect(remove.mock.calls[1][0]).toHaveLength(50);

    remove.mockClear();
    await removeObjects([]);
    expect(remove).not.toHaveBeenCalled();
  });
});
