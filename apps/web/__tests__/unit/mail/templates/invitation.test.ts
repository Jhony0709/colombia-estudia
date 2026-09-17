/** @jest-environment node */
/**
 * Tests for invitation email template.
 * SSOT: docs/estado.md §9c
 */

import { renderInvitationEmail } from '@/lib/mail/templates/invitation';

describe('renderInvitationEmail', () => {
  const baseData = {
    givenName: 'Juan',
    institutionName: 'Colombia Estudia',
    inviteUrl: 'https://example.com/invitacion/abc123',
    expiresAt: new Date('2026-09-23T00:00:00.000Z'),
  };

  it('escapes HTML in givenName', () => {
    const { html, text } = renderInvitationEmail({
      ...baseData,
      givenName: '<script>alert("xss")</script>',
    });

    expect(html).toContain('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
    expect(html).not.toContain('<script>');
  });

  it('escapes HTML in institutionName', () => {
    const { html } = renderInvitationEmail({
      ...baseData,
      institutionName: 'Test & <Company>',
    });

    expect(html).toContain('Test &amp; &lt;Company&gt;');
    expect(html).not.toContain('<Company>');
  });

  it('formats date in Spanish, in Bogota time', () => {
    const { html, text } = renderInvitationEmail(baseData);

    // expiresAt es 2026-09-23T00:00:00Z, que en Bogota (UTC-5) son las 19:00 del **22**.
    // La fecha que ve el destinatario tiene que ser la suya, no la del servidor: decirle 23
    // le haria creer que tiene todo ese dia. La instancia se eligio justo en esa franja para
    // que el test falle si alguien quita el `timeZone` de formatDate y vuelve a depender de
    // la TZ del proceso (en Vercel, UTC; `TZ` es variable reservada y no se puede fijar).
    expect(html).toMatch(/22.*septiembre.*2026/i);
    expect(text).toMatch(/22.*septiembre.*2026/i);
  });

  it('uses neutral copy - tienes una invitación', () => {
    const { subject, html, text } = renderInvitationEmail(baseData);

    expect(subject).toContain('tienes una invitación');
    expect(html).toContain('Tienes una invitación');
    expect(text).toContain('Tienes una invitación');
  });

  it('includes inviteUrl as href', () => {
    const { html, text } = renderInvitationEmail(baseData);

    expect(html).toContain('href="https://example.com/invitacion/abc123"');
    expect(text).toContain('https://example.com/invitacion/abc123');
  });

  it('uses accent.base color #1E40AF for button', () => {
    const { html } = renderInvitationEmail(baseData);

    expect(html).toContain('background:#1E40AF');
  });

  it('returns subject, html, and text', () => {
    const result = renderInvitationEmail(baseData);

    expect(result).toHaveProperty('subject');
    expect(result).toHaveProperty('html');
    expect(result).toHaveProperty('text');
    expect(typeof result.subject).toBe('string');
    expect(typeof result.html).toBe('string');
    expect(typeof result.text).toBe('string');
  });

  it('subject includes givenName and institutionName', () => {
    const { subject } = renderInvitationEmail(baseData);

    expect(subject).toContain('Juan');
    expect(subject).toContain('Colombia Estudia');
  });

  it('text version is plain text without HTML', () => {
    const { text } = renderInvitationEmail(baseData);

    expect(text).not.toContain('<');
    expect(text).not.toContain('>');
    expect(text).toContain('Hola, Juan');
    expect(text).toContain('Colombia Estudia');
  });
});
