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
