/**
 * El marco de marca de los correos (8/10): logo de ALBA, raya amarilla, tarjeta blanca sobre
 * el fondo de la app, un botón y el pie. Lo usan la invitación y el recordatorio de cuota; las
 * plantillas de Supabase Auth (`supabase/templates/`) copian este mismo marco.
 *
 * Tablas y estilos en línea: es lo que entienden Outlook y Gmail. Los colores salen de los
 * tokens del tema claro (un correo no sabe en qué tema está el cliente).
 */

import { light } from '@colombia-estudia/design-tokens';

export function escapeHtml(s: string): string {
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

/** El logo se sirve desde la propia app (`public/brand`); `origin` es su URL pública. */
export const logoUrl = (origin: string) =>
  new URL('/brand/alba-logo-horizontal.png', origin).toString();

export function renderBrandedEmail({
  origin,
  preheader,
  heading,
  paragraphs,
  cta,
  footnote,
}: {
  origin: string;
  /** El resumen que el buzón enseña junto al asunto. Texto plano. */
  preheader: string;
  /** Ya escapado. */
  heading: string;
  /** HTML ya escapado, un párrafo por elemento. */
  paragraphs: string[];
  cta?: { href: string; label: string };
  /** HTML ya escapado: vencimiento, «si no lo pediste…». */
  footnote: string;
}): string {
  const button = cta
    ? `<tr><td style="padding:8px 0 24px;">
        <a href="${cta.href}" style="display:inline-block;background:${light.accent.base};color:${light.text.onAccent};padding:14px 28px;border-radius:999px;text-decoration:none;font-weight:600;font-size:16px;">${escapeHtml(cta.label)}</a>
      </td></tr>
      <tr><td style="padding:0 0 24px;font-size:13px;line-height:1.5;color:${light.text.muted};">
        Si el botón no abre, copia este enlace en tu navegador:<br>
        <a href="${cta.href}" style="color:${light.accent.base};word-break:break-all;">${cta.href}</a>
      </td></tr>`
    : '';
  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><meta name="color-scheme" content="light"></head>
<body style="margin:0;padding:0;background:${light.surface.canvas};font-family:Lexend,system-ui,-apple-system,'Segoe UI',sans-serif;color:${light.text.default};">
  <span style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preheader)}</span>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${light.surface.canvas};">
    <tr><td align="center" style="padding:32px 16px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:${light.surface.base};border:1px solid ${light.border.muted};border-radius:16px;">
        <tr><td style="padding:32px 32px 0;">
          <img src="${logoUrl(origin)}" width="148" height="48" alt="ALBA Futuro Educativo" style="display:block;border:0;height:48px;width:auto;">
        </td></tr>
        <tr><td style="padding:24px 32px 0;">
          <h1 style="margin:0 0 8px;font-size:24px;line-height:1.3;">${heading}</h1>
          <div style="width:48px;height:4px;border-radius:2px;background:${light.brand.yellow};"></div>
        </td></tr>
        <tr><td style="padding:24px 32px 0;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            ${paragraphs
              .map(
                (p) =>
                  `<tr><td style="padding:0 0 16px;font-size:16px;line-height:1.6;">${p}</td></tr>`
              )
              .join('\n            ')}
            ${button}
            <tr><td style="padding:0 0 32px;font-size:14px;line-height:1.5;color:${light.text.muted};">${footnote}</td></tr>
          </table>
        </td></tr>
        <tr><td style="height:8px;background:${light.accent.base};border-radius:0 0 16px 16px;font-size:0;line-height:0;">&nbsp;</td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
