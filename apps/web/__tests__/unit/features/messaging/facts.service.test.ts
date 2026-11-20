/** @jest-environment node */
/**
 * El bot toma de la plataforma cuántos componentes y cuánto vale cada uno (14/11): el precio
 * general vigente por componente; si no hay o la base falla, los valores por defecto.
 * SSOT: features/messaging/server/facts.service.ts.
 */

const db = {
  institution: { findUniqueOrThrow: jest.fn() },
  program: { findFirst: jest.fn() },
};

jest.mock('server-only', () => ({}));
jest.mock('next/cache', () => ({ unstable_cache: (fn: unknown) => fn }));
jest.mock('@/lib/db/tenant', () => ({ createTenantClient: () => db }));
jest.mock('@/lib/observability/logger', () => ({ logger: { warn: jest.fn() } }));
jest.mock('@/lib/seo/site-url', () => ({ siteUrl: () => 'https://alba.test' }));

import { botContext } from '@/features/messaging/server/facts.service';
import { DEFAULT_FACTS } from '@/features/messaging/facts';

const price = (over: Record<string, unknown>) => ({
  id: 'pr-1',
  programId: 'prog-1',
  gradeFrom: null,
  gradeTo: null,
  amount: { toNumber: () => 95_000 },
  period: 'PER_MODULE',
  validFrom: new Date('2026-01-01T00:00:00.000Z'),
  validTo: null,
  archivedAt: null,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  _count: { paymentPlans: 0 },
  ...over,
});

beforeEach(() => {
  db.institution.findUniqueOrThrow.mockResolvedValue({ introCohortId: 'c-1', dataPolicyUrl: null });
});

it('componentes y precio vigente del bachillerato', async () => {
  db.program.findFirst.mockResolvedValue({ _count: { modules: 10 }, prices: [price({})] });
  const ctx = await botContext('inst-1');
  expect(ctx.facts).toMatchObject({ modules: 10, modulePrice: 95_000 });
  expect(ctx.facts.graduationFee).toBe(DEFAULT_FACTS.graduationFee);
  expect(ctx.policyUrl).toBe('https://alba.test/politica-de-datos');
  expect(ctx.introOpen).toBe(true);
});

it('sin precio por componente vigente, los valores por defecto', async () => {
  db.program.findFirst.mockResolvedValue({
    _count: { modules: 10 },
    prices: [price({ period: 'MONTHLY' })],
  });
  const ctx = await botContext('inst-1');
  expect(ctx.facts.modulePrice).toBe(DEFAULT_FACTS.modulePrice);
  expect(ctx.facts.modules).toBe(10);
});

it('si la base falla, responde con los valores por defecto', async () => {
  db.program.findFirst.mockRejectedValue(new Error('down'));
  const ctx = await botContext('inst-1');
  expect(ctx.facts).toEqual(DEFAULT_FACTS);
});
