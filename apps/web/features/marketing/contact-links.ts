/**
 * Enlaces de contacto de la portada. Puro, para poder probarlo sin Next.
 */

/** `wa.me` solo acepta dígitos con indicativo de país, sin `+` ni espacios. */
export function whatsappUrl(phone: string | null): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  return digits.length >= 10 ? `https://wa.me/${digits}` : null;
}

export interface ContactLink {
  href: string;
  /** WhatsApp abre en pestaña nueva; `mailto:` no. */
  external: boolean;
}

/** La acción principal de toda la portada: WhatsApp si hay teléfono, correo si no. */
export function primaryContact(phone: string | null, email: string): ContactLink {
  const wa = whatsappUrl(phone);
  return wa ? { href: wa, external: true } : { href: `mailto:${email}`, external: false };
}
