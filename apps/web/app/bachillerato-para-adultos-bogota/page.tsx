/** `/bachillerato-para-adultos-bogota`: página de contenido del sitio público (plan/13-seo.md, fase 1). */

import { SitePage, sitePageMetadata } from '@/features/marketing/site-page';

export const generateMetadata = () => sitePageMetadata('bogota');

export default function Page() {
  return <SitePage pageKey="bogota" />;
}
