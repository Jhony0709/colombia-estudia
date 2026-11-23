/**
 * `/quienes-somos` (23/11): quién está detrás. Razón social y NIT salen de `/admin/institucion`;
 * si faltan, la línea no se muestra.
 */

import { getRequestContext } from '@/lib/authz/request-context';
import { getInstitutionOverview } from '@/features/admin/server/institution.service';
import { SitePage, sitePageMetadata, type PageValues } from '@/features/marketing/site-page';

async function orgValues(): Promise<PageValues> {
  const ctx = await getRequestContext();
  const { settings } = await getInstitutionOverview(ctx.institution.id);
  return {
    name: settings.name,
    legalName: settings.legalName,
    taxId: settings.taxId,
    supportEmail: settings.supportEmail,
    supportPhone: settings.supportPhone,
  };
}

export const generateMetadata = () => sitePageMetadata('nosotros');

export default async function Page() {
  return <SitePage pageKey="nosotros" values={await orgValues()} />;
}
