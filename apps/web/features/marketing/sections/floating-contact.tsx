import { getTranslations } from 'next-intl/server';
import { MessageCircle } from 'lucide-react';
import type { ContactLink } from '../contact-links';

/**
 * Botón flotante con la invitación (Jhonny, 19/9): WhatsApp si hay teléfono, correo si no.
 * Siempre visible; en pantallas pequeñas solo el icono y un nombre accesible, para no tapar.
 */
export async function FloatingContact({ contact }: { contact: ContactLink }) {
  const t = await getTranslations('landing.fab');
  return (
    <a
      href={contact.href}
      target={contact.external ? '_blank' : undefined}
      rel={contact.external ? 'noreferrer' : undefined}
      className="site-fab"
      aria-label={t('label')}
    >
      <MessageCircle aria-hidden="true" className="size-6" />
      <span className="hidden sm:inline">{t('label')}</span>
      <span className="sm:hidden">{t('short')}</span>
    </a>
  );
}
