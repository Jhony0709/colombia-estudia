/**
 * Mail module factory.
 * SSOT: reference/08-env-vars.md:18-19
 *
 * In production: requires RESEND_API_KEY and EMAIL_DOMAIN, throws otherwise.
 * In development: uses ConsoleMailer (logs via pino).
 */

import 'server-only';

import { ConsoleMailer } from './console-mailer';
import type { Mailer } from './mailer';
import { ResendMailer } from './resend-mailer';

interface InstitutionMailConfig {
  emailFromName: string;
  supportEmail: string;
}

/**
 * ¿Hay de verdad un proveedor de correo detrás?
 *
 * Sin él, `getMailer` devuelve el `ConsoleMailer`, que **no envía nada**: escribe el correo
 * en el log del servidor. La operación necesita saberlo: «invitación enviada» sobre una
 * pantalla, cuando en realidad no salió ningún correo, es la clase de mentira que hace que
 * alguien espere tres días a que un estudiante entre.
 */
export function isMailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_DOMAIN);
}

/**
 * Get a mailer instance for the given institution.
 *
 * @throws Error if RESEND_API_KEY or EMAIL_DOMAIN is missing in production.
 */
export function getMailer(institution: InstitutionMailConfig): Mailer {
  const apiKey = process.env.RESEND_API_KEY;
  const domain = process.env.EMAIL_DOMAIN;
  const isProduction = process.env.NODE_ENV === 'production';

  if (!apiKey || !domain) {
    if (isProduction) {
      throw new Error('RESEND_API_KEY and EMAIL_DOMAIN are required in production');
    }
    return new ConsoleMailer();
  }

  return new ResendMailer(apiKey, domain, institution.emailFromName, institution.supportEmail);
}
