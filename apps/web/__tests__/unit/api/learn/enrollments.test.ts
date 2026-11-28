/** @jest-environment node */
/**
 * GET /api/learn/enrollments (27/11): las matrículas de quien pregunta, para la app móvil.
 */

import { NextRequest } from 'next/server';

const mockList = jest.fn();

jest.mock('server-only', () => ({}));
jest.mock('@/lib/authz/request-context', () => ({ getRequestContext: jest.fn() }));
jest.mock('@/features/learn/server/cohort.service', () => ({
  listMyEnrollments: (...args: unknown[]) => mockList(...args),
}));

import { getRequestContext } from '@/lib/authz/request-context';
import { GET } from '@/app/api/learn/enrollments/route';

const mockContext = getRequestContext as jest.Mock;
const student = (capabilities: Map<string, unknown[]>) => ({
  institution: { id: 'inst-1' },
  person: { id: 'p-1' },
  capabilities,
});
const request = () => new NextRequest(new URL('/api/learn/enrollments', 'http://localhost'));

beforeEach(() => jest.clearAllMocks());

describe('GET /api/learn/enrollments', () => {
  it('lists the enrollments of whoever asks, and only theirs', async () => {
    mockContext.mockResolvedValue(student(new Map([['lesson.read', [{ enrollmentId: 'e-1' }]]])));
    mockList.mockResolvedValue([{ enrollmentId: 'e-1' }]);
    const res = await GET(request());
    expect(res.status).toBe(200);
    expect((await res.json()).data).toEqual({ enrollments: [{ enrollmentId: 'e-1' }] });
    expect(mockList).toHaveBeenCalledWith({ institutionId: 'inst-1', personId: 'p-1' });
  });

  it('answers 403 without lesson.read', async () => {
    mockContext.mockResolvedValue(student(new Map()));
    expect((await GET(request())).status).toBe(403);
    expect(mockList).not.toHaveBeenCalled();
  });
});
