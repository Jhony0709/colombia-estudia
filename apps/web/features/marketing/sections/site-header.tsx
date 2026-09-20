import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { BrandLogo } from '@/components/atoms/brand-logo';
import { SiteContainer } from '../site-container';
import { CtaLink } from '../cta-link';
import type { ContactLink } from '../contact-links';

/**
 * Cabecera fija: logo, tres anclas (desde `lg`), entrar y escribir. Sin buscador ni "Crear
 * cuenta": no hay registro. Por debajo de `lg` las anclas se ocultan —las secciones van en
 * el mismo orden al bajar— y un cajón para tres anclas no se paga.
 */
export async function SiteHeader({
  signedIn,
  contact,
}: {
  signedIn: boolean;
  contact: ContactLink;
}) {
  const t = await getTranslations('landing');
  return (
    <header className="site-header">
      <SiteContainer className="flex min-h-[4.5rem] items-center justify-between gap-6">
        <Link
          href="/"
          className="rounded-control inline-flex items-center"
          aria-label="Colombia Estudia, inicio"
        >
          <BrandLogo alt="" className="h-10 sm:h-11" priority />
        </Link>
        <nav aria-label={t('nav.label')} className="hidden items-center gap-1 lg:flex">
          <a href="#programas" className="site-nav-link">
            {t('nav.programs')}
          </a>
          <a href="#como-funciona" className="site-nav-link">
            {t('nav.how')}
          </a>
          <a href="#preguntas" className="site-nav-link">
            {t('nav.faq')}
          </a>
        </nav>
        <div className="flex items-center gap-2">
          <Link
            href={signedIn ? '/ingresar' : '/auth/login'}
            className="site-btn site-btn--secondary site-btn--sm"
          >
            {signedIn ? t('nav.enter') : t('nav.login')}
          </Link>
          {/* `hidden` no puede ir en el propio .site-btn: site.css fija su display después. */}
          <span className="hidden sm:block">
            <CtaLink contact={contact} size="sm">
              {t('nav.write')}
            </CtaLink>
          </span>
        </div>
      </SiteContainer>
    </header>
  );
}
