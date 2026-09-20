/** @jest-environment node */
/**
 * Tests for PII masking.
 * SSOT: plan/06-cohortes-y-personas.md:33, docs/estado.md §12a
 */

import { maskEmail } from '@/lib/pii/mask';

describe('maskEmail', () => {
  it('keeps the first letter and the domain', () => {
    expect(maskEmail('ana.maria@colegio.edu.co')).toBe('a••••••••@colegio.edu.co');
  });

  it('masks a single-letter local part without revealing its length as zero', () => {
    expect(maskEmail('a@b.co')).toBe('a•@b.co');
  });

  it('shows a dash when there is no email at all', () => {
    expect(maskEmail(null)).toBe('—');
    expect(maskEmail(undefined)).toBe('—');
    expect(maskEmail('')).toBe('—');
  });

  it('never returns anything recognisable for a malformed value', () => {
    expect(maskEmail('sin-arroba')).toBe('•••');
    expect(maskEmail('@solo-dominio.co')).toBe('•••');
  });
});
