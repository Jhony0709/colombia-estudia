import 'server-only';

/**
 * Lo que el bot afirma, desde la plataforma (14/11): cuántos componentes tiene el bachillerato y
 * cuánto vale cada uno salen del programa y de su precio vigente, para que WhatsApp y el catálogo
 * digan lo mismo. Cacheado diez minutos por institución: el bot contesta a cada mensaje y el
 * precio cambia pocas veces al año.
 */

import { unstable_cache } from 'next/cache';
import { createTenantClient } from '@/lib/db/tenant';
import { logger } from '@/lib/observability/logger';
import { siteUrl } from '@/lib/seo/site-url';
import {
  PROGRAM_PRICE_SELECT,
  toProgramPriceView,
  withPriceStates,
} from '@/features/billing/server/prices.service';
import { advisorsOpen, DEFAULT_FACTS, type Facts } from '../facts';
import type { BotContext } from '../bot';

const TTL_SECONDS = 600;

interface PlatformFacts {
  modules: number | null;
  modulePrice: number | null;
  introOpen: boolean;
  dataPolicyUrl: string | null;
}

async function readPlatformFacts(institutionId: string): Promise<PlatformFacts> {
  const db = createTenantClient(institutionId);
  const [institution, program] = await Promise.all([
    db.institution.findUniqueOrThrow({
      where: { id: institutionId },
      select: { introCohortId: true, dataPolicyUrl: true },
    }),
    db.program.findFirst({
      where: { kind: 'BACHILLERATO', pricing: 'PAID', archivedAt: null },
      orderBy: { createdAt: 'asc' },
      select: {
        _count: { select: { modules: { where: { archivedAt: null } } } },
        prices: { select: PROGRAM_PRICE_SELECT },
      },
    }),
  ]);
  const current = program
    ? withPriceStates(program.prices.map(toProgramPriceView)).filter(
        (p) => p.state === 'CURRENT' && p.period === 'PER_MODULE'
      )
    : [];
  // El precio general (sin rango de grados) manda; si no hay, el primero vigente.
  const price = current.find((p) => p.gradeFrom === null && p.gradeTo === null) ?? current[0];
  return {
    modules: program?._count.modules || null,
    modulePrice: price?.amount ?? null,
    introOpen: institution.introCohortId !== null,
    dataPolicyUrl: institution.dataPolicyUrl,
  };
}

const cachedFacts = unstable_cache(readPlatformFacts, ['whatsapp-bot-facts'], {
  revalidate: TTL_SECONDS,
});

/** El contexto del bot para una institución; si la base falla, los valores por defecto. */
export async function botContext(
  institutionId: string,
  now: Date = new Date()
): Promise<BotContext> {
  const site = siteUrl();
  const platform = await cachedFacts(institutionId).catch((err: unknown) => {
    logger.warn({ event: 'whatsapp-bot-facts-failed', institutionId, error: String(err) });
    return null;
  });
  const facts: Facts = {
    ...DEFAULT_FACTS,
    ...(platform?.modules ? { modules: platform.modules } : {}),
    ...(platform?.modulePrice ? { modulePrice: platform.modulePrice } : {}),
  };
  return {
    siteUrl: site,
    policyUrl: platform?.dataPolicyUrl ?? `${site}/politica-de-datos`,
    facts,
    introOpen: platform?.introOpen ?? true,
    advisorsOpen: advisorsOpen(now),
  };
}
