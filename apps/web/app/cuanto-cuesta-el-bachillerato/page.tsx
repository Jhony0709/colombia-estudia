/**
 * `/cuanto-cuesta-el-bachillerato` (23/11): los precios salen de la plataforma, los mismos que
 * dice el bot (`features/messaging/server/facts.service.ts`).
 */

import { getRequestContext } from '@/lib/authz/request-context';
import { botContext } from '@/features/messaging/server/facts.service';
import { cop } from '@/features/messaging/facts';
import { SitePage, sitePageMetadata, type PageValues } from '@/features/marketing/site-page';

async function priceValues(): Promise<PageValues> {
  const ctx = await getRequestContext();
  const { facts: f } = await botContext(ctx.institution.id);
  const stages = f.modules * f.modulePrice;
  return {
    modules: f.modules,
    modulePrice: cop(f.modulePrice),
    stages: cop(stages),
    graduationFee: cop(f.graduationFee),
    total: cop(stages + f.graduationFee),
    months: f.months,
    certificatePrice: cop(f.certificatePrice),
    certificateBusinessDays: f.certificateBusinessDays,
  };
}

export const generateMetadata = async () => sitePageMetadata('precio', await priceValues());

export default async function Page() {
  return <SitePage pageKey="precio" values={await priceValues()} />;
}
