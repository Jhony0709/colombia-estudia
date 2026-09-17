/**
 * Console mailer for development (logs via pino, not console.log).
 * Only logs: subject, to, and href links from HTML.
 */

import { logger } from '@/lib/observability/logger';
import type { EmailPayload, Mailer } from './mailer';

/**
 * Extract all href values from HTML.
 */
function extractHrefs(html: string): string[] {
  const hrefs: string[] = [];
  const regex = /href="([^"]+)"/g;
  let match;
  while ((match = regex.exec(html)) !== null) {
    const href = match[1];
    if (href) {
      hrefs.push(href);
    }
  }
  return hrefs;
}

let counter = 0;

export class ConsoleMailer implements Mailer {
  async send(payload: EmailPayload): Promise<{ id: string }> {
    const id = `console-${Date.now()}-${++counter}`;
    const hrefs = extractHrefs(payload.html);

    logger.info(
      {
        emailId: id,
        to: payload.to,
        subject: payload.subject,
        hrefs,
      },
      '[ConsoleMailer] Email sent'
    );

    return { id };
  }
}
