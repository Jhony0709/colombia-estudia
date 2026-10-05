import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { ArrowRight } from 'lucide-react';
import { SiteContainer } from '../site-container';
import { AlbaLogo } from '../brand/alba-logo';
import { MobileMenu, type MenuLink } from './mobile-menu';

/**
 * Cabecera fija (ALBA, 5/10): logo a la izquierda, cinco anclas centradas y, a la derecha,
 * «Ingresar» y «Comenzar →» (registro público). 76 px en escritorio y 64 en el teléfono, donde
 * las anclas no se comprimen: van en el menú. Con sesión, «Comenzar» no aplica y «Ingresar»
 * lleva a la cuenta.
 */
export async function SiteHeader({ signedIn }: { signedIn: boolean }) {
  const t = await getTranslations('landing.nav');
  const links: MenuLink[] = [
    { href: '#inicio', label: t('home') },
    { href: '#programas', label: t('programs') },
    { href: '#como-funciona', label: t('how') },
    { href: '#historias', label: t('stories') },
    { href: '#preguntas', label: t('faq') },
  ];
  const login = signedIn
    ? { href: '/ingresar', label: t('enter') }
    : { href: '/auth/login', label: t('login') };
  const start = signedIn ? null : { href: '/registro', label: t('start') };

  return (
    <header className="site-header">
      <SiteContainer className="flex h-full items-center justify-between gap-6 lg:grid lg:grid-cols-[1fr_auto_1fr]">
        <Link
          href="/"
          aria-label={t('homeLabel')}
          className="min-h-touch inline-flex items-center justify-self-start rounded-[10px]"
        >
          <AlbaLogo priority className="h-10 lg:h-11" />
        </Link>

        <nav aria-label={t('label')} className="hidden lg:block">
          <ul className="m-0 flex list-none items-center gap-1 p-0">
            {links.map((link) => (
              <li key={link.href}>
                <a href={link.href} className="site-nav-link">
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="hidden items-center gap-2 justify-self-end lg:flex">
          <Link href={login.href} className="site-btn site-btn--secondary site-btn--sm">
            {login.label}
          </Link>
          {start && (
            <Link href={start.href} className="site-btn site-btn--primary site-btn--sm">
              {start.label}
              <ArrowRight aria-hidden="true" className="size-4" />
            </Link>
          )}
        </div>

        <MobileMenu
          links={links}
          login={login}
          start={start}
          openLabel={t('menuOpen')}
          closeLabel={t('menuClose')}
        />
      </SiteContainer>
    </header>
  );
}
