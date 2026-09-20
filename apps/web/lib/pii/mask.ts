/**
 * PII masking for list views.
 * SSOT: plan/06-cohortes-y-personas.md:33 ("Lista sin PII sensible… correo enmascarado").
 *
 * Masking is for the screen, not for security: the full value is one audited click away
 * (`AuditLog person.pii_read`). What it buys is that a list on a laptop in an open office,
 * or a screenshot pasted into a chat, does not leak everyone's address at once.
 */

/** `ana.maria@colegio.edu.co` → `a•••••••@colegio.edu.co`. */
export function maskEmail(email: string | null | undefined): string {
  if (!email) return '—';

  const at = email.lastIndexOf('@');
  if (at <= 0) return '•••';

  const local = email.slice(0, at);
  const domain = email.slice(at);
  const first = local[0] ?? '';

  return `${first}${'•'.repeat(Math.max(local.length - 1, 1))}${domain}`;
}
