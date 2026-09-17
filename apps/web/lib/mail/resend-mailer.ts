/**
 * Resend mailer implementation using fetch (no SDK).
 * SSOT: reference/08-env-vars.md:18-19
 */

import 'server-only';

import type { EmailPayload, Mailer } from './mailer';

const RESEND_API_URL = 'https://api.resend.com/emails';

export class ResendMailer implements Mailer {
  constructor(
    private apiKey: string,
    private fromDomain: string,
    private fromName: string,
    private replyTo: string
  ) {}

  async send(payload: EmailPayload): Promise<{ id: string }> {
    const res = await fetch(RESEND_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `${this.fromName} <no-reply@${this.fromDomain}>`,
        reply_to: this.replyTo,
        to: payload.to,
        subject: payload.subject,
        html: payload.html,
        text: payload.text,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Resend error ${res.status}: ${body}`);
    }

    const data = (await res.json()) as { id: string };
    return { id: data.id };
  }
}
