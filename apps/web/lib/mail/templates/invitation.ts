/**
 * Invitation email template.
 * SSOT: plan/03-identidad-y-acceso.md §"Invitación"
 *
 * Button color: #1E40AF (accent.base from design-tokens)
 */

interface InvitationEmailData {
  givenName: string;
  institutionName: string;
  inviteUrl: string;
  expiresAt: Date;
}

/**
 * Escape HTML special characters to prevent XSS.
 */
function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => {
    switch (c) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;';
      case "'":
        return '&#39;';
      default:
        return c;
    }
  });
}

/**
 * Format date in Spanish (Colombia).
 */
function formatDate(d: Date): string {
  return d.toLocaleDateString('es-CO', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

/**
 * Render invitation email with neutral copy.
 * Returns subject, html, and text versions.
 */
export function renderInvitationEmail(data: InvitationEmailData): {
  subject: string;
  html: string;
  text: string;
} {
  const safeName = escapeHtml(data.givenName);
  const safeInstitution = escapeHtml(data.institutionName);
  const expiresFormatted = formatDate(data.expiresAt);

  const subject = `${data.givenName}, tienes una invitación de ${data.institutionName}`;

  // accent.base from design-tokens: #1E40AF
  const html = `<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="font-family:system-ui,-apple-system,sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#0F172A;">
  <h1 style="font-size:24px;margin-bottom:16px;">Hola, ${safeName}</h1>
  <p style="font-size:16px;line-height:1.5;margin-bottom:24px;">
    Tienes una invitación de <strong>${safeInstitution}</strong>.
  </p>
  <p style="margin:24px 0;">
    <a href="${data.inviteUrl}" style="display:inline-block;background:#1E40AF;color:#FFFFFF;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:500;">
      Activar mi cuenta
    </a>
  </p>
  <p style="font-size:14px;color:#475569;">
    Este enlace vence el ${expiresFormatted}. Si no solicitaste esta invitación, ignora este correo.
  </p>
</body>
</html>`;

  const text = `Hola, ${data.givenName}

Tienes una invitación de ${data.institutionName}.

Activa tu cuenta aquí: ${data.inviteUrl}

Este enlace vence el ${expiresFormatted}. Si no solicitaste esta invitación, ignora este correo.`;

  return { subject, html, text };
}
