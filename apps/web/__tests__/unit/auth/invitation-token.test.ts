/** @jest-environment node */
/**
 * Tests for invitation token generation and verification.
 * SSOT: docs/estado.md §9c
 */

import { generateInvitationToken, hashToken, verifyTokenHash } from '@/lib/auth/invitation-token';

describe('generateInvitationToken', () => {
  it('generates token of 43 characters (base64url of 32 bytes)', () => {
    const { token } = generateInvitationToken();

    // 32 bytes = 256 bits = 43 base64url characters (with padding stripped)
    expect(token).toHaveLength(43);
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('generates hash as sha256 hex of 64 characters', () => {
    const { hash } = generateInvitationToken();

    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[a-f0-9]+$/);
  });

  it('generates expiresAt 7 days in the future', () => {
    const before = Date.now();
    const { expiresAt } = generateInvitationToken();
    const after = Date.now();

    const sevenDays = 7 * 24 * 60 * 60 * 1000;
    const expectedMin = before + sevenDays;
    const expectedMax = after + sevenDays;

    expect(expiresAt.getTime()).toBeGreaterThanOrEqual(expectedMin);
    expect(expiresAt.getTime()).toBeLessThanOrEqual(expectedMax);
  });

  it('generates unique tokens on each call', () => {
    const tokens = new Set<string>();
    for (let i = 0; i < 100; i++) {
      tokens.add(generateInvitationToken().token);
    }
    expect(tokens.size).toBe(100);
  });
});

describe('hashToken', () => {
  it('produces the same hash for the same token', () => {
    const token = 'test-token-123';
    const hash1 = hashToken(token);
    const hash2 = hashToken(token);

    expect(hash1).toBe(hash2);
  });

  it('produces different hashes for different tokens', () => {
    const hash1 = hashToken('token-a');
    const hash2 = hashToken('token-b');

    expect(hash1).not.toBe(hash2);
  });

  it('produces a 64 character hex string', () => {
    const hash = hashToken('any-token');

    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[a-f0-9]+$/);
  });
});

describe('verifyTokenHash', () => {
  it('returns true for correct token', () => {
    const { token, hash } = generateInvitationToken();

    expect(verifyTokenHash(token, hash)).toBe(true);
  });

  it('returns false for incorrect token', () => {
    const { hash } = generateInvitationToken();
    const wrongToken = 'wrong-token';

    expect(verifyTokenHash(wrongToken, hash)).toBe(false);
  });

  it('returns false for hash of different length', () => {
    const { token } = generateInvitationToken();
    const shortHash = 'abc123';

    expect(verifyTokenHash(token, shortHash)).toBe(false);
  });

  it('returns false for empty token', () => {
    const { hash } = generateInvitationToken();

    expect(verifyTokenHash('', hash)).toBe(false);
  });

  it('verifies the hash matches the generated token', () => {
    const { token, hash } = generateInvitationToken();

    // Manually compute the hash to verify
    const computedHash = hashToken(token);
    expect(computedHash).toBe(hash);
    expect(verifyTokenHash(token, hash)).toBe(true);
  });
});
