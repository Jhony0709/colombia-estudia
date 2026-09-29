/**
 * Enlaces de contacto de la portada. Puro, para poder probarlo sin Next.
 */

/**
 * `wa.me` solo acepta dígitos con indicativo de país, sin `+` ni espacios. `message` (28/9)
 * va como `?text=` y aparece ya escrito en el chat: quien escribe no tiene que pensar cómo
 * empezar.
 */
export function whatsappUrl(phone: string | null, message?: string): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 10) return null;
  const text = message?.trim() ? `?text=${encodeURIComponent(message.trim())}` : '';
  return `https://wa.me/${digits}${text}`;
}

export interface ContactLink {
  href: string;
  /** WhatsApp abre en pestaña nueva; `mailto:` no. */
  external: boolean;
}

/** La acción principal de toda la portada: WhatsApp si hay teléfono, correo si no. */
export function primaryContact(phone: string | null, email: string, message?: string): ContactLink {
  const wa = whatsappUrl(phone, message);
  return wa ? { href: wa, external: true } : { href: `mailto:${email}`, external: false };
}
