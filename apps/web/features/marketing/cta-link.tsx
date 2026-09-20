import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import type { ContactLink } from './contact-links';

/** Un enlace con la piel de botón de la portada. `contact` abre WhatsApp en pestaña nueva. */
export function CtaLink({
  href,
  contact,
  variant = 'primary',
  size,
  className,
  children,
}: {
  href?: string;
  contact?: ContactLink;
  variant?: 'primary' | 'secondary' | 'yellow' | 'white';
  size?: 'sm';
  className?: string;
  children: ReactNode;
}) {
  const target = contact?.href ?? href ?? '#';
  const external = contact?.external ?? false;
  return (
    <a
      href={target}
      target={external ? '_blank' : undefined}
      rel={external ? 'noreferrer' : undefined}
      className={cn('site-btn', `site-btn--${variant}`, size === 'sm' && 'site-btn--sm', className)}
    >
      {children}
    </a>
  );
}
