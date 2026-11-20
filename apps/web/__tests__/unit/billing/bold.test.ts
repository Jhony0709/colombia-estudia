/** @jest-environment node */
/**
 * Bold (18/11): link de pago por API, firma `x-bold-signature` y consulta de un pago.
 * SSOT: lib/billing/bold.ts, developers.bold.co.
 */

import { createHmac } from 'node:crypto';

jest.mock('server-only', () => ({}));

import {
  buildReference,
  createPaymentLink,
  fetchPaymentLink,
  isBoldConfigured,
  isBoldSandbox,
  verifySignature,
} from '@/lib/billing/bold';

const ENV = { ...process.env };
const sign = (body: string, secret: string) =>
  createHmac('sha256', secret).update(Buffer.from(body).toString('base64')).digest('hex');
const mockFetch = jest.fn();

beforeEach(() => {
  process.env = { ...ENV, BOLD_API_KEY: 'id-key', BOLD_SECRET_KEY: 'secret' };
  delete process.env.BOLD_SANDBOX;
  delete process.env.VERCEL_ENV;
  mockFetch.mockReset();
  global.fetch = mockFetch as unknown as typeof fetch;
});
afterAll(() => {
  process.env = ENV;
});

describe('isBoldConfigured', () => {
  it('pide llave de identidad y secreta; en pruebas basta la de identidad', () => {
    expect(isBoldConfigured()).toBe(true);
    delete process.env.BOLD_SECRET_KEY;
    expect(isBoldConfigured()).toBe(false);
    process.env.BOLD_SANDBOX = 'true';
    expect(isBoldConfigured()).toBe(true);
  });

  it('en producción el modo de pruebas no cuenta', () => {
    process.env.BOLD_SANDBOX = 'true';
    process.env.VERCEL_ENV = 'production';
    expect(isBoldSandbox()).toBe(false);
    delete process.env.BOLD_SECRET_KEY;
    expect(isBoldConfigured()).toBe(false);
  });
});

describe('verifySignature', () => {
  const body = '{"type":"SALE_APPROVED","data":{"payment_id":"p1"}}';

  it('acepta el HMAC del cuerpo en Base64 y rechaza lo demás', () => {
    expect(verifySignature(body, sign(body, 'secret'))).toBe(true);
    expect(verifySignature(body, sign(body, 'otra'))).toBe(false);
    expect(verifySignature(`${body} `, sign(body, 'secret'))).toBe(false);
    expect(verifySignature(body, null)).toBe(false);
  });

  it('en pruebas Bold firma con llave vacía; en producción esa firma no vale', () => {
    process.env.BOLD_SANDBOX = 'true';
    expect(verifySignature(body, sign(body, ''))).toBe(true);
    process.env.VERCEL_ENV = 'production';
    expect(verifySignature(body, sign(body, ''))).toBe(false);
    process.env.BOLD_SECRET_KEY = '';
    expect(verifySignature(body, sign(body, ''))).toBe(false);
  });
});

describe('createPaymentLink', () => {
  const now = new Date('2026-11-18T15:00:00.000Z');

  it('crea un link cerrado en pesos con la referencia, y vence cuando se le pide', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        payload: { payment_link: 'LNK_1', url: 'https://checkout.bold.co/LNK_1' },
      }),
    });
    const link = await createPaymentLink({
      reference: 'ce-abc-1',
      amountCop: 90_000,
      description: 'Cuota 1 del plan de pago',
      callbackUrl: 'https://alba.test/aprender/mi-cuenta?pago=ce-abc-1',
      payerEmail: 'a@b.co',
      ttlMs: 24 * 3600 * 1000,
      now,
    });
    expect(link).toEqual({
      id: 'LNK_1',
      url: 'https://checkout.bold.co/LNK_1',
      expiresAt: new Date(now.getTime() + 24 * 3600 * 1000),
    });
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe('https://integrations.api.bold.co/online/link/v1');
    expect(init.headers.Authorization).toBe('x-api-key id-key');
    const body = JSON.parse(init.body);
    expect(body).toMatchObject({
      amount_type: 'CLOSE',
      amount: { currency: 'COP', total_amount: 90_000, tip_amount: 0 },
      reference: 'ce-abc-1',
      callback_url: 'https://alba.test/aprender/mi-cuenta?pago=ce-abc-1',
      payer_email: 'a@b.co',
    });
    expect(body.expiration_date).toBe((now.getTime() + 24 * 3600 * 1000) * 1_000_000);
  });

  it('sin https no manda callback; si Bold falla, null', async () => {
    mockFetch.mockResolvedValue({ ok: false, json: async () => ({ errors: [{}] }) });
    const link = await createPaymentLink({
      reference: 'ce-abc-1',
      amountCop: 1000,
      description: 'Cuota',
      callbackUrl: 'http://localhost:3030/aprender/mi-cuenta',
      ttlMs: 3600 * 1000,
    });
    expect(link).toBeNull();
    expect(JSON.parse(mockFetch.mock.calls[0][1].body).callback_url).toBeUndefined();
  });
});

describe('fetchPaymentLink', () => {
  const answer = (body: unknown, ok = true) =>
    mockFetch.mockResolvedValue({ ok, json: async () => body });

  it('lee estado, monto y transacción del link', async () => {
    answer({ id: 'LNK_1', status: 'PAID', total: 90_000, transaction_id: 'TX-1' });
    await expect(fetchPaymentLink('LNK_1')).resolves.toEqual({
      status: 'PAID',
      amountCop: 90_000,
      transactionId: 'TX-1',
    });
    expect(mockFetch.mock.calls[0][0]).toBe(
      'https://integrations.api.bold.co/online/link/v1/LNK_1'
    );
    expect(mockFetch.mock.calls[0][1].headers.Authorization).toBe('x-api-key id-key');
  });

  it('sin pagar no hay transacción; si Bold no responde bien, null', async () => {
    answer({ status: 'ACTIVE', total: 90_000, transaction_id: null });
    await expect(fetchPaymentLink('LNK_1')).resolves.toMatchObject({ transactionId: null });
    answer({ errors: [{}] }, false);
    await expect(fetchPaymentLink('LNK_1')).resolves.toBeNull();
    answer({ status: 'PAID' });
    await expect(fetchPaymentLink('LNK_1')).resolves.toBeNull();
  });

  it('Bold caído o lento: null, con límite de tiempo en la llamada', async () => {
    mockFetch.mockRejectedValue(new Error('timeout'));
    await expect(fetchPaymentLink('LNK_1')).resolves.toBeNull();
    await expect(
      createPaymentLink({
        reference: 'ce-a-1',
        amountCop: 1000,
        description: 'Cuota',
        ttlMs: 3600 * 1000,
      })
    ).resolves.toBeNull();
    expect(mockFetch.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
  });

  it('un link de pruebas solo cuenta en modo de pruebas', async () => {
    answer({ status: 'PAID', total: 1000, transaction_id: 'TX', is_sandbox: true });
    await expect(fetchPaymentLink('LNK_1')).resolves.toBeNull();
    process.env.BOLD_SANDBOX = 'true';
    await expect(fetchPaymentLink('LNK_1')).resolves.toMatchObject({ status: 'PAID' });
  });
});

describe('referencia', () => {
  it('distinta en cada intento y dentro del límite de Bold (60)', () => {
    const a = buildReference('cm1abc', new Date(1));
    expect(a).not.toBe(buildReference('cm1abc', new Date(2)));
    expect(a).toMatch(/^ce-cm1abc-[a-z0-9]+$/);
    expect(buildReference('c'.repeat(25)).length).toBeLessThanOrEqual(60);
  });
});
