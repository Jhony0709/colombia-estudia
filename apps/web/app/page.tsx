/**
 * `/`: la portada pública, con o sin sesión.
 * SSOT: reference/01-routing/routes.md
 *
 * Desde el 19/9 aquí no se redirige a nadie (Jhonny): con sesión la portada muestra
 * «Ingresar», que lleva a `/ingresar`, y ahí vive la elección del área por rol
 * (lib/authz/home.ts). `/` es pública (lib/authz/routes.ts PUBLIC_EXACT).
 */

import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { getRequestContext } from '@/lib/authz/request-context';
import { Landing } from '@/features/marketing/landing';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('landing');
  return {
    title: t('meta.title'),
    description: t('meta.description'),
    openGraph: {
      title: t('meta.title'),
      description: t('meta.description'),
      type: 'website',
      locale: 'es_CO',
    },
  };
}

export default async function HomePage() {
  const ctx = await getRequestContext();
  // El contacto sale de la institución (tenant ya resuelto), no de variables de entorno.
  const { name, supportEmail, supportPhone, dataPolicyUrl } = ctx.institution;
  return (
    <Landing
      institution={{ name, supportEmail, supportPhone, dataPolicyUrl }}
      signedIn={ctx.person !== null}
    />
  );
}
