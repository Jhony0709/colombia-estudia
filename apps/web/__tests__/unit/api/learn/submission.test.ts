/** @jest-environment node */
/**
 * POST /api/learn/lessons/[assignmentId]/submission (28/11): un tema con más de 20 enunciados
 * se tiene que poder entregar.
 */

import { NextRequest } from 'next/server';

const mockSubmit = jest.fn();

jest.mock('server-only', () => ({}));
jest.mock('@/lib/authz/request-context', () => ({ getRequestContext: jest.fn() }));
jest.mock('@/features/learn/server/submission.service', () => ({
  submitLesson: (...args: unknown[]) => mockSubmit(...args),
}));

import { getRequestContext } from '@/lib/authz/request-context';
import { POST } from '@/app/api/learn/lessons/[assignmentId]/submission/route';

const mockContext = getRequestContext as jest.Mock;
const request = (body: unknown) =>
  new NextRequest(new URL('/api/learn/lessons/la-1/submission', 'http://localhost'), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
const params = { params: Promise.resolve({ assignmentId: 'la-1' }) };
const answers = (n: number) => Array.from({ length: n }, (_, i) => `respuesta ${i + 1}`);

beforeEach(() => {
  jest.clearAllMocks();
  mockContext.mockResolvedValue({
    institution: { id: 'inst-1' },
    person: { id: 'p-1' },
    capabilities: new Map([['lesson.progress.own', [{ type: 'own' }]]]),
  });
  mockSubmit.mockResolvedValue({ id: 's-1' });
});

describe('POST /api/learn/lessons/[assignmentId]/submission', () => {
  it('accepts the 23 answers of a long activity', async () => {
    const res = await POST(request({ answers: answers(23) }), params);
    expect(res.status).toBe(200);
    expect(mockSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ assignmentId: 'la-1', answers: answers(23) })
    );
  });

  it('still refuses more answers than an activity can have', async () => {
    const res = await POST(request({ answers: answers(101) }), params);
    expect(res.status).toBe(400);
    expect(mockSubmit).not.toHaveBeenCalled();
  });
});
