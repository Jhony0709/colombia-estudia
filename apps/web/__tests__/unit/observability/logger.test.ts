/**
 * Tests for lib/observability/logger.ts
 */

import { Writable } from 'node:stream';
import { hashPersonId, createLogger, type Logger } from '@/lib/observability/logger';

describe('hashPersonId', () => {
  it('returns 12 character hex string', () => {
    const hash = hashPersonId('person-123');
    expect(hash).toHaveLength(12);
    expect(/^[a-f0-9]+$/.test(hash)).toBe(true);
  });

  it('returns consistent hash for same input', () => {
    const hash1 = hashPersonId('person-123');
    const hash2 = hashPersonId('person-123');
    expect(hash1).toBe(hash2);
  });

  it('returns different hash for different input', () => {
    const hash1 = hashPersonId('person-123');
    const hash2 = hashPersonId('person-456');
    expect(hash1).not.toBe(hash2);
  });
});

describe('logger redaction', () => {
  it('redacts email at level 1', () => {
    const output = captureLog((logger) => {
      logger.info({ email: 'test@example.com', safe: 'value' });
    });
    expect(output).not.toContain('test@example.com');
    expect(output).toContain('value');
  });

  it('redacts nested email at level 2', () => {
    const output = captureLog((logger) => {
      logger.info({ user: { email: 'test@example.com' }, safe: 'value' });
    });
    expect(output).not.toContain('test@example.com');
  });

  it('redacts password', () => {
    const output = captureLog((logger) => {
      logger.info({ password: 'secret123' });
    });
    expect(output).not.toContain('secret123');
  });

  it('redacts answerKey', () => {
    const output = captureLog((logger) => {
      logger.info({ answerKey: { q1: 'a' } });
    });
    expect(output).not.toContain('q1');
  });

  it('redacts birthDate', () => {
    const output = captureLog((logger) => {
      logger.info({ birthDate: '2000-01-01' });
    });
    expect(output).not.toContain('2000-01-01');
  });
});

// Capture pino output through an explicit destination stream: patching process.stdout.write
// only works while Jest runs in band (pino picks SonicBoom on fd 1 otherwise).
function captureLog(fn: (logger: Logger) => void): string {
  const chunks: string[] = [];
  const destination = new Writable({
    write(chunk, _encoding, callback) {
      chunks.push(chunk.toString());
      callback();
    },
  });
  fn(createLogger(destination));
  return chunks.join('');
}
