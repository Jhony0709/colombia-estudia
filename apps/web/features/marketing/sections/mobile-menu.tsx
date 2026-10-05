'use client';

/**
 * Menú del teléfono y la tableta (bajo `lg`): botón de 44 px y una hoja bajo la cabecera con las
 * anclas y las dos acciones. Se cierra con Escape (y el foco vuelve al botón), al elegir un enlace
 * y al pasar a escritorio. Sin trampa de foco: no es un diálogo, la página sigue ahí.
 */

import { useEffect, useId, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Menu, X } from 'lucide-react';

export interface MenuLink {
  href: string;
  label: string;
}

export function MobileMenu({
  links,
  login,
  start,
  openLabel,
  closeLabel,
}: {
  links: MenuLink[];
  login: MenuLink;
  start: MenuLink | null;
  openLabel: string;
  closeLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const button = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        button.current?.focus();
      }
    };
    const desktop = window.matchMedia('(min-width: 1024px)');
    const onResize = () => desktop.matches && setOpen(false);
    window.addEventListener('keydown', onKey);
    desktop.addEventListener('change', onResize);
    return () => {
      window.removeEventListener('keydown', onKey);
      desktop.removeEventListener('change', onResize);
    };
  }, [open]);

  const close = () => setOpen(false);

  return (
    <div className="lg:hidden">
      <button
        ref={button}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={open ? closeLabel : openLabel}
        onClick={() => setOpen((value) => !value)}
        className="site-round text-[var(--site-blue)] hover:bg-[var(--site-tint)]"
      >
        {open ? (
          <X aria-hidden="true" className="size-6" />
        ) : (
          <Menu aria-hidden="true" className="size-6" />
        )}
      </button>
      <div id={panelId} hidden={!open} className="site-menu">
        <div className="mx-auto max-w-[80rem] px-4 pb-6 pt-2 sm:px-6">
          <ul className="m-0 list-none divide-y divide-[var(--site-line)] p-0">
            {links.map((link) => (
              <li key={link.href}>
                <a href={link.href} onClick={close}>
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <Link href={login.href} onClick={close} className="site-btn site-btn--secondary">
              {login.label}
            </Link>
            {start && (
              <Link href={start.href} onClick={close} className="site-btn site-btn--primary">
                {start.label}
                <ArrowRight aria-hidden="true" className="size-4" />
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
