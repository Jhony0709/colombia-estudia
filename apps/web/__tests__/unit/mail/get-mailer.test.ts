/** @jest-environment node */
/**
 * Tests for getMailer factory.
 * SSOT: docs/estado.md §9c
 */

// Mock server-only to allow testing
jest.mock('server-only', () => ({}));

// Helper to set NODE_ENV (read-only in Node types)
function setNodeEnv(value: string) {
  Object.defineProperty(process.env, 'NODE_ENV', {
    value,
    writable: true,
    configurable: true,
  });
}

describe('getMailer', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('throws in production without RESEND_API_KEY', async () => {
    setNodeEnv('production');
    process.env.RESEND_API_KEY = '';
    process.env.EMAIL_DOMAIN = 'example.com';

    const { getMailer } = await import('@/lib/mail');

    expect(() => getMailer({ emailFromName: 'Test', supportEmail: 'test@test.com' })).toThrow(
      'RESEND_API_KEY and EMAIL_DOMAIN are required in production'
    );
  });

  it('throws in production without EMAIL_DOMAIN', async () => {
    setNodeEnv('production');
    process.env.RESEND_API_KEY = 'test-key';
    process.env.EMAIL_DOMAIN = '';

    const { getMailer } = await import('@/lib/mail');

    expect(() => getMailer({ emailFromName: 'Test', supportEmail: 'test@test.com' })).toThrow(
      'RESEND_API_KEY and EMAIL_DOMAIN are required in production'
    );
  });

  it('returns ConsoleMailer in development without keys', async () => {
    setNodeEnv('development');
    process.env.RESEND_API_KEY = '';
    process.env.EMAIL_DOMAIN = '';

    const { getMailer } = await import('@/lib/mail');
    const { ConsoleMailer } = await import('@/lib/mail/console-mailer');

    const mailer = getMailer({
      emailFromName: 'Test',
      supportEmail: 'test@test.com',
    });

    expect(mailer).toBeInstanceOf(ConsoleMailer);
  });

  it('returns ResendMailer when keys are present', async () => {
    setNodeEnv('development');
    process.env.RESEND_API_KEY = 'test-key';
    process.env.EMAIL_DOMAIN = 'example.com';

    const { getMailer } = await import('@/lib/mail');
    const { ResendMailer } = await import('@/lib/mail/resend-mailer');

    const mailer = getMailer({
      emailFromName: 'Test',
      supportEmail: 'test@test.com',
    });

    expect(mailer).toBeInstanceOf(ResendMailer);
  });
});
