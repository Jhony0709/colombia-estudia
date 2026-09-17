/**
 * Invitation token generation and verification.
 * SSOT: plan/03-identidad-y-acceso.md §9c
 *
 * AMBIGUO: Token propio con crypto.randomBytes(32) en vez de
 * supabase.auth.admin.generateLink. Motivo: control sobre expiración,
 * flujo de UI propio, y Invitation.tokenHash ya existe en el schema.
 */

import { createHash, randomBytes, timingSafeEqual } from 'crypto';

const TOKEN_BYTES = 32; // 256 bits
const EXPIRY_DAYS = 7;

/**
 * Generate a new invitation token with its hash and expiration date.
 *
 * @returns Object with:
 *  - token: base64url encoded token (sent to user via email)
 *  - hash: sha256 hex hash (stored in database)
 *  - expiresAt: 7 days from now
 */
export function generateInvitationToken(): {
  token: string;
  hash: string;
  expiresAt: Date;
} {
  const buffer = randomBytes(TOKEN_BYTES);
  const token = buffer.toString('base64url');
  const hash = createHash('sha256').update(token).digest('hex');
  const expiresAt = new Date(Date.now() + EXPIRY_DAYS * 24 * 60 * 60 * 1000);
  return { token, hash, expiresAt };
}

/**
 * Hash a token using SHA-256.
 */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * Verify a token against an expected hash using timing-safe comparison.
 *
 * @returns true if the token matches the expected hash
 */
export function verifyTokenHash(token: string, expectedHash: string): boolean {
  const actualHash = hashToken(token);
  const a = Buffer.from(actualHash, 'hex');
  const b = Buffer.from(expectedHash, 'hex');

  // Length check (timing-safe comparison requires equal lengths)
  if (a.length !== b.length) {
    return false;
  }

  return timingSafeEqual(a, b);
}
