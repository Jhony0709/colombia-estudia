/**
 * Invitation email template.
 * SSOT: plan/03-identidad-y-acceso.md §"Invitación"
 *
 * Los colores se INTERPOLAN desde los tokens, no se copian (hoy, en `layout.ts`).
 *
 * Un correo no puede usar variables CSS —la mitad de los clientes no las resuelven y el botón
 * saldría sin fondo— pero sí puede llevar el hexadecimal que sale del token al construir la
 * cadena. El 18/9 esto tenía tres valores copiados a mano y el rediseño de la paleta dejó dos
 * obsoletos: el acento, que se vio porque un test lo cazó, y `#475569` —el `text.muted`
 * anterior— que no lo cazó nadie y llevaba camino de quedarse.
 *
 * Se usa siempre el tema CLARO: un correo no sabe en qué tema está el cliente, y el fondo por
 * defecto de todos ellos es blanco.
 */

import { escapeHtml, renderBrandedEmail } from './layout';

interface InvitationEmailData {
  givenName: string;
  institutionName: string;
  inviteUrl: string;
  expiresAt: Date;
}

/**
 * Format date in Spanish (Colombia).
 */
function formatDate(d: Date): string {
  return d.toLocaleDateString('es-CO', {
    // Explicito a proposito: el servidor de Vercel corre en UTC y `TZ` es una variable
    // reservada que no se puede fijar ahi. Sin esto, una fecha entre las 19:00 y la
    // medianoche de Bogota se renderiza con el dia siguiente. Mismo criterio que
    // packages/domain/src/dates.ts.
    timeZone: 'America/Bogota',
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

  // El marco de marca (8/10); el logo sale del mismo origen que el enlace.
  const html = renderBrandedEmail({
    origin: new URL(data.inviteUrl).origin,
    preheader: `Activa tu cuenta de ${data.institutionName}.`,
    heading: `Hola, ${safeName}`,
    paragraphs: [`Tienes una invitación de <strong>${safeInstitution}</strong>.`],
    cta: { href: data.inviteUrl, label: 'Activar mi cuenta' },
    footnote: `Este enlace vence el ${expiresFormatted}. Si no solicitaste esta invitación, ignora este correo.`,
  });

  const text = `Hola, ${data.givenName}

Tienes una invitación de ${data.institutionName}.

Activa tu cuenta aquí: ${data.inviteUrl}

Este enlace vence el ${expiresFormatted}. Si no solicitaste esta invitación, ignora este correo.`;

  return { subject, html, text };
}
