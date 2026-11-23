/** `/validar-bachillerato`: página de contenido del sitio público (23/11, «validar bachillerato»). */

import { SitePage, sitePageMetadata } from '@/features/marketing/site-page';

export const generateMetadata = () => sitePageMetadata('validar');

export default function Page() {
  return <SitePage pageKey="validar" />;
}
