import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { SITE_PAGES, type SitePageKey } from '@/lib/seo/pages';
import { SiteContainer } from '../site-container';
import { AlbaLogo } from '../brand/alba-logo';
import { whatsappUrl } from '../contact-links';
import type { LandingInstitution } from '../landing';

/**
 * Pie compacto (ALBA, 5/10): logo y lema, «Explora», «Soporte» y «Legal» con enlaces que
 * existen, y la línea de derechos. Sin redes ni centro de ayuda: no hay ninguno que enlazar
 * todavía. Deja sitio abajo para el botón flotante en el teléfono.
 */

// Las páginas de contenido por columna (23/11); una nueva sin columna cae en «Guías».
const EXPLORE: SitePageKey[] = ['precio', 'nosotros'];
const SUPPORT: SitePageKey[] = ['contacto'];
export const GUIDES = SITE_PAGES.map((page) => page.key).filter(
  (key) => !EXPLORE.includes(key) && !SUPPORT.includes(key)
);
const pathOf = (key: SitePageKey) => SITE_PAGES.find((page) => page.key === key)!.path;
export async function SiteFooter({
  institution,
  signedIn,
}: {
  institution: LandingInstitution;
  signedIn: boolean;
}) {
  const t = await getTranslations('landing');
  const pages = await getTranslations('sitePages');
  const wa = whatsappUrl(institution.supportPhone);
  const year = new Date().getFullYear();
  const link =
    'site-small min-h-touch inline-flex items-center hover:text-[var(--site-blue)] hover:underline';
  return (
    <footer className="border-t border-[var(--site-line)] bg-[var(--site-bg)] pb-24 sm:pb-0">
      <SiteContainer className="grid gap-8 py-12 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.2fr)_repeat(4,minmax(0,1fr))]">
        <div className="space-y-3">
          <AlbaLogo className="h-10" />
          <p className="site-small m-0 max-w-xs">{t('footer.tagline')}</p>
        </div>
        <FooterColumn title={t('footer.explore')}>
          <Link href="/#programas" className={link}>
            {t('nav.programs')}
          </Link>
          <Link href="/#como-funciona" className={link}>
            {t('nav.how')}
          </Link>
          <Link href="/#historias" className={link}>
            {t('nav.stories')}
          </Link>
          {EXPLORE.map((key) => (
            <Link key={key} href={pathOf(key)} className={link}>
              {pages(`${key}.nav`)}
            </Link>
          ))}
        </FooterColumn>
        <FooterColumn title={t('footer.guides')}>
          {GUIDES.map((key) => (
            <Link key={key} href={pathOf(key)} className={link}>
              {pages(`${key}.nav`)}
            </Link>
          ))}
        </FooterColumn>
        <FooterColumn title={t('footer.support')}>
          {wa && (
            <a href={wa} target="_blank" rel="noreferrer" className={link}>
              {t('footer.write')}
            </a>
          )}
          <a href={`mailto:${institution.supportEmail}`} className={`${link} break-all`}>
            {institution.supportEmail}
          </a>
          {SUPPORT.map((key) => (
            <Link key={key} href={pathOf(key)} className={link}>
              {pages(`${key}.nav`)}
            </Link>
          ))}
          <Link href={signedIn ? '/ingresar' : '/auth/login'} className={link}>
            {signedIn ? t('nav.enter') : t('nav.login')}
          </Link>
        </FooterColumn>
        <FooterColumn title={t('footer.legal')}>
          <a href={institution.dataPolicyUrl ?? '/politica-de-datos'} className={link}>
            {t('footer.dataPolicy')}
          </a>
        </FooterColumn>
      </SiteContainer>
      <div className="border-t border-[var(--site-line)]">
        <SiteContainer className="py-5">
          <p className="site-small m-0">{t('footer.rights', { year, name: institution.name })}</p>
        </SiteContainer>
      </div>
    </footer>
  );
}

function FooterColumn({ title, children }: { title: string; children: React.ReactNode }) {
  // `flat`: un `.map()` entre los hijos llega como un arreglo y cada enlace necesita su `<li>`.
  const items = [children].flat(2).filter(Boolean);
  return (
    <div>
      <h2 className="m-0 mb-1 text-sm font-semibold text-[var(--site-navy)]">{title}</h2>
      <ul className="m-0 flex list-none flex-col p-0">
        {items.map((child, index) => (
          <li key={index}>{child}</li>
        ))}
      </ul>
    </div>
  );
}
