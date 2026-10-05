import { getTranslations } from 'next-intl/server';
import type { ContactLink } from '../contact-links';
import { MessageCircle } from 'lucide-react';
import { WhatsAppIcon } from '../brand/whatsapp-icon';
import { FabQuiet } from './fab-quiet';

/**
 * Botón flotante con la invitación (Jhonny, 19/9): WhatsApp si hay teléfono, correo si no.
 * Siempre visible; en pantallas pequeñas solo el icono y un nombre accesible, para no tapar.
 *
 * Relevancia (5/10): el icono va en el círculo verde de WhatsApp (glifo navy: 7:1; blanco sobre
 * ese verde daba 2:1) y un halo amarillo late cada 10 s desde los 6 s, hasta que la persona
 * interactúa con el botón (`FabQuiet`). Con movimiento reducido, nada.
 */
export async function FloatingContact({ contact }: { contact: ContactLink }) {
  const t = await getTranslations('landing.fab');
  return (
    <>
      <a
        href={contact.href}
        target={contact.external ? '_blank' : undefined}
        rel={contact.external ? 'noreferrer' : undefined}
        className={contact.external ? 'site-fab site-fab--whatsapp' : 'site-fab'}
        aria-label={t('label')}
      >
        {contact.external ? (
          <span className="site-fab-badge">
            <WhatsAppIcon className="size-5" />
          </span>
        ) : (
          <MessageCircle aria-hidden="true" className="size-6" />
        )}
        {/* En el teléfono solo el icono (28/9): con texto medía 150 px y tapaba los botones de
          las tarjetas y del hero. El nombre accesible lo pone `aria-label`. */}
        <span className="hidden sm:inline">{t('label')}</span>
      </a>
      {contact.external && <FabQuiet />}
    </>
  );
}
