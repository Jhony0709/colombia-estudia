/** @jest-environment node */
/**
 * PUT y DELETE /api/push/devices (27/11): el teléfono de quien pregunta, para el push.
 */

import { NextRequest } from 'next/server';

const mockRegister = jest.fn();
const mockRemove = jest.fn();

jest.mock('server-only', () => ({}));
jest.mock('@/lib/authz/request-context', () => ({ getRequestContext: jest.fn() }));
jest.mock('@/features/notifications/server/push.service', () => ({
  registerDevice: (...args: unknown[]) => mockRegister(...args),
  removeDevice: (...args: unknown[]) => mockRemove(...args),
}));

import { getRequestContext } from '@/lib/authz/request-context';
import { resetRateLimits } from '@/lib/http/rate-limit';
import { DELETE, PUT } from '@/app/api/push/devices/route';

const mockContext = getRequestContext as jest.Mock;
const TOKEN = 'ExponentPushToken[abc]';
const request = (method: string, body: unknown) =>
  new NextRequest(new URL('/api/push/devices', 'http://localhost'), {
    method,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

beforeEach(() => {
  resetRateLimits();
  jest.clearAllMocks();
  mockContext.mockResolvedValue({ institution: { id: 'inst-1' }, person: { id: 'p-1' } });
});

describe('/api/push/devices', () => {
  it('registers the phone under whoever asks', async () => {
    mockRegister.mockResolvedValue({ registered: true });
    // Un `personId` en el cuerpo no cuenta: manda el del contexto.
    const res = await PUT(request('PUT', { token: TOKEN, platform: 'ios', personId: 'p-9' }));
    expect(res.status).toBe(200);
    expect(mockRegister).toHaveBeenCalledWith({
      institutionId: 'inst-1',
      personId: 'p-1',
      token: TOKEN,
      platform: 'IOS',
    });
  });

  it('rejects what is not an Expo token', async () => {
    const res = await PUT(request('PUT', { token: 'abc', platform: 'android' }));
    expect(res.status).toBe(400);
    expect(mockRegister).not.toHaveBeenCalled();
  });

  it('removes it on sign-out', async () => {
    mockRemove.mockResolvedValue({ removed: true });
    const res = await DELETE(request('DELETE', { token: TOKEN }));
    expect(res.status).toBe(200);
    expect(mockRemove).toHaveBeenCalledWith({
      institutionId: 'inst-1',
      personId: 'p-1',
      token: TOKEN,
    });
  });

  it('answers 401 without a session', async () => {
    mockContext.mockResolvedValue({ institution: { id: 'inst-1' }, person: null });
    const res = await PUT(request('PUT', { token: TOKEN, platform: 'ios' }));
    expect(res.status).toBe(401);
  });
});
