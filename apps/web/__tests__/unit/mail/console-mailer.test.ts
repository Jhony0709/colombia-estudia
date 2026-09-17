/** @jest-environment node */
/**
 * Tests for ConsoleMailer.
 * SSOT: docs/estado.md §9c
 */

import { Writable } from 'stream';

// Capture pino output
let logOutput: string[] = [];

jest.mock('@/lib/observability/logger', () => {
  const pino = require('pino');
  const stream = new Writable({
    write(chunk, _encoding, callback) {
      logOutput.push(chunk.toString());
      callback();
    },
  });
  return {
    logger: pino({ level: 'info' }, stream),
  };
});

import { ConsoleMailer } from '@/lib/mail/console-mailer';

describe('ConsoleMailer', () => {
  const mailer = new ConsoleMailer();

  beforeEach(() => {
    logOutput = [];
  });

  it('logs email with subject, to, and hrefs', async () => {
    await mailer.send({
      to: 'user@test.com',
      subject: 'Test Subject',
      html: '<p>Click <a href="https://example.com/link1">here</a> or <a href="https://example.com/link2">there</a></p>',
      text: 'Click here or there',
    });

    expect(logOutput.length).toBe(1);
    const logged = JSON.parse(logOutput[0]!) as Record<string, unknown>;

    expect(logged.to).toBe('user@test.com');
    expect(logged.subject).toBe('Test Subject');
    expect(logged.hrefs).toEqual(['https://example.com/link1', 'https://example.com/link2']);
    expect(logged.msg).toBe('[ConsoleMailer] Email sent');
  });

  it('returns a unique id', async () => {
    const result1 = await mailer.send({
      to: 'user@test.com',
      subject: 'Test',
      html: '<p>Hi</p>',
      text: 'Hi',
    });

    const result2 = await mailer.send({
      to: 'user@test.com',
      subject: 'Test',
      html: '<p>Hi</p>',
      text: 'Hi',
    });

    expect(result1.id).toMatch(/^console-\d+-\d+$/);
    expect(result2.id).toMatch(/^console-\d+-\d+$/);
    expect(result1.id).not.toBe(result2.id);
  });

  it('handles HTML without links', async () => {
    await mailer.send({
      to: 'user@test.com',
      subject: 'No Links',
      html: '<p>Just text</p>',
      text: 'Just text',
    });

    const logged = JSON.parse(logOutput[0]!) as Record<string, unknown>;
    expect(logged.hrefs).toEqual([]);
  });
});
