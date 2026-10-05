import { cn } from '@/lib/utils';

/**
 * El logotipo de WhatsApp (28/9). Es una marca ajena: el trazo no se dibuja a mano, se carga
 * el archivo del kit de marca en `public/brand/whatsapp.svg`. Va como máscara CSS
 * (`.site-wa-icon`, `site.css`) y no como `<img>`: así toma el color del texto donde esté.
 */
export function WhatsAppIcon({ className }: { className?: string }) {
  return <span aria-hidden="true" className={cn('site-wa-icon size-6', className)} />;
}
