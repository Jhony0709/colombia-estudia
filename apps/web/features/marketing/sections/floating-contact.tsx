import { getTranslations } from 'next-intl/server';
import type { ContactLink } from '../contact-links';
import { MessageCircle } from 'lucide-react';
import { WhatsAppIcon } from '../brand-shapes';

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
      {contact.external ? (
        <WhatsAppIcon className="size-6" />
      ) : (
        <MessageCircle aria-hidden="true" className="size-6" />
      )}
      {/* En el teléfono solo el icono (28/9): con texto medía 150 px y tapaba los botones de
          las tarjetas y del hero. El nombre accesible lo pone `aria-label`. */}
      <span className="hidden sm:inline">{t('label')}</span>
    </a>
  );
}
