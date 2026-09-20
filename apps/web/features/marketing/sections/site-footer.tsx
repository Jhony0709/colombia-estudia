import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { BrandLogo } from '@/components/atoms/brand-logo';
import { SiteContainer } from '../site-container';
import { whatsappUrl } from '../contact-links';
import type { LandingInstitution } from '../landing';

/**
 * Pie pequeño: logo y lema, columnas con enlaces que existen y el contacto real. Sin redes:
 * no hay ninguna que enlazar. Deja sitio abajo para el botón flotante.
 */
export async function SiteFooter({
  institution,
  signedIn,
}: {
  institution: LandingInstitution;
  signedIn: boolean;
}) {
  const t = await getTranslations('landing');
  const wa = whatsappUrl(institution.supportPhone);
  const year = new Date().getFullYear();
  const link = 'site-small min-h-touch inline-flex items-center hover:text-[var(--site-blue)]';
  return (
    <footer className="border-t border-[var(--site-line)] pb-24 sm:pb-0">
      <SiteContainer className="grid gap-10 py-14 md:grid-cols-[1.4fr_1fr_1fr] lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div className="space-y-4">
          <BrandLogo className="h-10" />
          <p className="site-small m-0 max-w-xs">{t('footer.tagline')}</p>
        </div>
        <FooterColumn title={t('footer.platform')}>
          <a href="#programas" className={link}>
            {t('nav.programs')}
          </a>
          <a href="#como-funciona" className={link}>
            {t('nav.how')}
          </a>
          <a href="#preguntas" className={link}>
            {t('nav.faq')}
          </a>
        </FooterColumn>
        <FooterColumn title={t('footer.institution')}>
          <a href={`mailto:${institution.supportEmail}`} className={link}>
            {institution.supportEmail}
          </a>
          {institution.supportPhone && (
            <a
              href={wa ?? `tel:${institution.supportPhone.replace(/\s/g, '')}`}
              target={wa ? '_blank' : undefined}
              rel={wa ? 'noreferrer' : undefined}
              className={link}
            >
              {institution.supportPhone}
            </a>
          )}
          <Link href={signedIn ? '/ingresar' : '/auth/login'} className={link}>
            {signedIn ? t('nav.enter') : t('nav.login')}
          </Link>
        </FooterColumn>
        {institution.dataPolicyUrl && (
          <FooterColumn title={t('footer.legal')}>
            <a href={institution.dataPolicyUrl} className={link}>
              {t('footer.dataPolicy')}
            </a>
          </FooterColumn>
        )}
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
  return (
    <div>
      <h2 className="mb-2 text-sm font-bold">{title}</h2>
      <ul className="m-0 flex list-none flex-col p-0">
        {Array.isArray(children) ? (
          children.map((c, i) => c && <li key={i}>{c}</li>)
        ) : (
          <li>{children}</li>
        )}
      </ul>
    </div>
  );
}
