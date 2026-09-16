/** @jest-environment node */
/**
 * Tests for ResendMailer.
 * SSOT: docs/estado.md §9c
 */

// Mock server-only to allow testing
jest.mock('server-only', () => ({}));

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Need to import after mocking
import { ResendMailer } from '@/lib/mail/resend-mailer';

describe('ResendMailer', () => {
  const mailer = new ResendMailer(
    'test-api-key',
    'example.com',
    'Test Institution',
    'support@example.com'
  );

  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('calls fetch with correct headers and body', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'msg_123' }),
    });

    await mailer.send({
      to: 'user@test.com',
      subject: 'Test Subject',
      html: '<p>Hello</p>',
      text: 'Hello',
    });

    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.resend.com/emails',
      expect.objectContaining({
        method: 'POST',
        headers: {
          Authorization: 'Bearer test-api-key',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'Test Institution <no-reply@example.com>',
          reply_to: 'support@example.com',
          to: 'user@test.com',
          subject: 'Test Subject',
          html: '<p>Hello</p>',
          text: 'Hello',
        }),
      })
    );
  });

  it('returns id from response', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'msg_456' }),
    });

    const result = await mailer.send({
      to: 'user@test.com',
      subject: 'Test',
      html: '<p>Hi</p>',
      text: 'Hi',
    });

    expect(result.id).toBe('msg_456');
  });

  it('throws on API error', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 400,
      text: async () => 'Invalid email',
    });

    await expect(
      mailer.send({
        to: 'invalid',
        subject: 'Test',
        html: '<p>Hi</p>',
        text: 'Hi',
      })
    ).rejects.toThrow('Resend error 400: Invalid email');
  });
});
