/**
 * Email sending interface.
 * SSOT: plan/03-identidad-y-acceso.md §9c
 */

export interface EmailPayload {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export interface Mailer {
  send(payload: EmailPayload): Promise<{ id: string }>;
}
