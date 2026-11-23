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
import { botContext } from '@/features/messaging/server/facts.service';
import { cop } from '@/features/messaging/facts';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('landing');
  // `absolute`: el título ya lleva la marca y no pasa por la plantilla del layout.
  return {
    title: { absolute: t('meta.title') },
    description: t('meta.description'),
    alternates: { canonical: '/' },
    openGraph: {
      title: t('meta.title'),
      description: t('meta.description'),
      url: '/',
      siteName: 'ALBA Futuro Educativo',
      type: 'website',
      locale: 'es_CO',
    },
  };
}

export default async function HomePage() {
  const ctx = await getRequestContext();
  // El contacto sale de la institución (tenant ya resuelto), no de variables de entorno.
  const { name, supportEmail, supportPhone, dataPolicyUrl } = ctx.institution;
  // Los mismos precios que el bot y `/cuanto-cuesta-el-bachillerato` (23/11).
  const { facts: f } = await botContext(ctx.institution.id);
  return (
    <Landing
      institution={{ name, supportEmail, supportPhone, dataPolicyUrl }}
      signedIn={ctx.person !== null}
      prices={{
        modulePrice: cop(f.modulePrice),
        total: cop(f.modules * f.modulePrice + f.graduationFee),
      }}
    />
  );
}
