/** @jest-environment node */
/**
 * Pago en línea con Bold (19/11), caso por caso: crear o reutilizar el link, el webhook, la
 * vuelta del pago y el job. Un pago solo se registra cuando Bold dice que el link está pagado,
 * y una sola vez. SSOT: features/billing/server/account.service.ts.
 */

import { createHmac } from 'node:crypto';

const tenant = {
  installment: { findFirst: jest.fn(), findMany: jest.fn() },
  payment: { findFirst: jest.fn(), create: jest.fn() },
  paymentLink: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    updateMany: jest.fn(),
  },
  $transaction: jest.fn(),
};
const prisma = { paymentLink: { findFirst: jest.fn() } };
const mockNotify = jest.fn();
const mockNotifyMany = jest.fn();
const mockConfirm = jest.fn();
const mockCreateLink = jest.fn();
const mockFetchLink = jest.fn();

jest.mock('server-only', () => ({}));
jest.mock('@/lib/db/tenant', () => ({
  get prisma() {
    return prisma;
  },
  createTenantClient: () => tenant,
}));
jest.mock('@/lib/observability/logger', () => ({
  logger: { warn: jest.fn(), error: jest.fn() },
}));
jest.mock('@/lib/billing/bold', () => ({
  ...jest.requireActual('@/lib/billing/bold'),
  createPaymentLink: (...a: unknown[]) => mockCreateLink(...a),
  fetchPaymentLink: (...a: unknown[]) => mockFetchLink(...a),
}));
jest.mock('@/features/notifications/server/notifications.service', () => ({
  notify: (...a: unknown[]) => mockNotify(...a),
  notifyMany: (...a: unknown[]) => mockNotifyMany(...a),
  staffPersonIds: async () => ['ops-1'],
}));
jest.mock('@/features/billing/server/billing.service', () => ({
  getAccount: jest.fn(),
  confirmPayment: (...a: unknown[]) => mockConfirm(...a),
}));

import {
  checkReturnedPayment,
  createStaffLink,
  handleBoldEvent,
  nextChargeOf,
  startCheckout,
  syncOpenPaymentLinks,
} from '@/features/billing/server/account.service';

const NOW = new Date('2026-11-19T15:00:00.000Z');
const REF = 'ce-inst1cuota-mabc';
const decimal = (n: number) => ({ toNumber: () => n });
const link = (over: Record<string, unknown> = {}) => ({
  id: 'link-1',
  institutionId: 'inst-1',
  installmentId: 'inst1cuota',
  reference: REF,
  providerId: 'LNK_1',
  amount: decimal(90_000),
  status: 'ACTIVE',
  expiresAt: new Date(NOW.getTime() + 20 * 3600 * 1000),
  ...over,
});
const installment = (over: Record<string, unknown> = {}) => ({
  id: 'inst1cuota',
  amount: decimal(90_000),
  status: 'OPEN',
  position: 2,
  payments: [],
  paymentPlan: {
    enrollmentId: 'enr-1',
    partnerId: null,
    payerType: 'PERSON',
    payerPersonId: 'payer-1',
    enrollment: { id: 'enr-1' },
  },
  ...over,
});
const NEW_LINK = { id: 'LNK_9', url: 'https://checkout.bold.co/LNK_9', expiresAt: NOW };
const bold = (status: string, total = 90_000, transactionId: string | null = null) =>
  mockFetchLink.mockResolvedValue({ status, amountCop: total, transactionId });
const body = (type: string, reference: string | null = REF) =>
  JSON.stringify({ id: 'evt-1', type, data: { payment_id: 'pay-1', metadata: { reference } } });
const sign = (raw: string) =>
  createHmac('sha256', 'secret').update(Buffer.from(raw).toString('base64')).digest('hex');
const send = (raw: string, signature = sign(raw)) => handleBoldEvent(raw, signature, NOW);

beforeEach(() => {
  jest.clearAllMocks();
  process.env.BOLD_API_KEY = 'id-key';
  process.env.BOLD_SECRET_KEY = 'secret';
  delete process.env.BOLD_SANDBOX;
  tenant.installment.findFirst.mockResolvedValue(installment());
  tenant.payment.findFirst.mockResolvedValue(null);
  tenant.payment.create.mockResolvedValue({ id: 'p-new' });
  tenant.paymentLink.findFirst.mockResolvedValue(null);
  tenant.paymentLink.findMany.mockResolvedValue([]);
  tenant.paymentLink.updateMany.mockResolvedValue({ count: 1 });
  tenant.$transaction.mockImplementation((fn: (tx: typeof tenant) => unknown) => fn(tenant));
  prisma.paymentLink.findFirst.mockResolvedValue(link());
});

describe('startCheckout', () => {
  const start = (over: Record<string, unknown> = {}) =>
    startCheckout({
      institutionId: 'inst-1',
      installmentId: 'inst1cuota',
      scopes: [{ enrollmentId: 'enr-1' }] as never,
      origin: 'https://alba.test',
      customerEmail: 'a@b.co',
      now: NOW,
      ...over,
    });

  it('crea el link por lo pendiente y lo guarda', async () => {
    tenant.installment.findFirst.mockResolvedValue(
      installment({ payments: [{ amount: decimal(30_000), confirmedAt: NOW, voidedAt: null }] })
    );
    mockCreateLink.mockResolvedValue(NEW_LINK);
    const out = await start();
    expect(out).toMatchObject({ url: 'https://checkout.bold.co/LNK_9', amount: 60_000 });
    expect(mockCreateLink).toHaveBeenCalledWith(
      expect.objectContaining({
        amountCop: 60_000,
        callbackUrl: `https://alba.test/aprender/mi-cuenta?pago=${out.reference}`,
      })
    );
    expect(tenant.paymentLink.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        providerId: 'LNK_9',
        reference: out.reference,
        amount: 60_000,
      }),
    });
  });

  it('con un link vigente por el mismo monto, lo reutiliza sin llamar a Bold', async () => {
    tenant.paymentLink.findFirst.mockResolvedValue({
      url: 'https://checkout.bold.co/LNK_1',
      reference: REF,
    });
    await expect(start()).resolves.toEqual({
      url: 'https://checkout.bold.co/LNK_1',
      reference: REF,
      amount: 90_000,
      delivery: 'redirect',
    });
    expect(mockCreateLink).not.toHaveBeenCalled();
    // Solo si le quedan al menos 10 minutos.
    expect(tenant.paymentLink.findFirst.mock.calls[0][0].where.expiresAt).toEqual({
      gt: new Date(NOW.getTime() + 10 * 60 * 1000),
    });
  });

  it('pagar ahora dura 1 hora y Bold no manda correo', async () => {
    mockCreateLink.mockResolvedValue(NEW_LINK);
    await start();
    expect(mockCreateLink).toHaveBeenCalledWith(
      expect.objectContaining({ ttlMs: 3600 * 1000, payerEmail: null })
    );
  });

  it('por correo dura 24 horas, lo envía Bold y siempre es un link nuevo', async () => {
    mockCreateLink.mockResolvedValue(NEW_LINK);
    await expect(start({ delivery: 'email' })).resolves.toMatchObject({ delivery: 'email' });
    expect(mockCreateLink).toHaveBeenCalledWith(
      expect.objectContaining({ ttlMs: 24 * 3600 * 1000, payerEmail: 'a@b.co' })
    );
    // Lo único que mira es si ya salió uno hace menos de 5 minutos.
    expect(tenant.paymentLink.findFirst.mock.calls[0][0].where.createdAt).toEqual({
      gt: new Date(NOW.getTime() - 5 * 60 * 1000),
    });
  });

  it('por correo, un segundo clic en menos de 5 minutos no crea otro link', async () => {
    tenant.paymentLink.findFirst.mockResolvedValue({ id: 'link-1' });
    await expect(start({ delivery: 'email' })).rejects.toMatchObject({ code: 'CONFLICT' });
    expect(mockCreateLink).not.toHaveBeenCalled();
  });

  it('por correo sin correo registrado no crea nada', async () => {
    await expect(start({ delivery: 'email', customerEmail: null })).rejects.toMatchObject({
      code: 'CONFLICT',
    });
    expect(mockCreateLink).not.toHaveBeenCalled();
  });

  it('si Bold no crea el link, no queda nada guardado', async () => {
    mockCreateLink.mockResolvedValue(null);
    await expect(start()).rejects.toMatchObject({ code: 'INTERNAL' });
    expect(tenant.paymentLink.create).not.toHaveBeenCalled();
  });

  it('si el link se crea en Bold pero no se guarda, falla y deja rastro', async () => {
    mockCreateLink.mockResolvedValue(NEW_LINK);
    tenant.paymentLink.create.mockRejectedValueOnce(new Error('db'));
    await expect(start()).rejects.toThrow('db');
    expect(jest.requireMock('@/lib/observability/logger').logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'bold-link-orphan', providerId: 'LNK_9' })
    );
  });

  it('cuota pagada, cuota ajena o Bold sin configurar: no hay link', async () => {
    tenant.installment.findFirst.mockResolvedValue(installment({ status: 'PAID' }));
    await expect(start()).rejects.toMatchObject({ code: 'CONFLICT' });
    tenant.installment.findFirst.mockResolvedValue(installment());
    await expect(start({ scopes: [{ enrollmentId: 'otra' }] })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    delete process.env.BOLD_API_KEY;
    await expect(start()).rejects.toMatchObject({ code: 'CONFLICT' });
    expect(mockCreateLink).not.toHaveBeenCalled();
  });
});

describe('cobrar desde una conversación', () => {
  const due = (id: string, paid: number) => ({
    id,
    position: id === 'i1' ? 1 : 2,
    amount: decimal(90_000),
    dueOn: new Date('2026-12-05T00:00:00.000Z'),
    payments: paid ? [{ amount: decimal(paid), confirmedAt: NOW, voidedAt: null }] : [],
  });
  const staff = (delivery: 'email' | 'chat', payerEmail: string | null = 'a@b.co') =>
    createStaffLink({
      institutionId: 'inst-1',
      personId: 'per-1',
      delivery,
      payerEmail,
      origin: 'https://alba.test',
      now: NOW,
    });

  it('la próxima cuota es la primera con saldo, suya o de quien tiene a cargo, sin aliados', async () => {
    tenant.installment.findMany.mockResolvedValue([due('i1', 90_000), due('i2', 30_000)]);
    await expect(nextChargeOf({ institutionId: 'inst-1', personId: 'per-1' })).resolves.toEqual({
      installmentId: 'i2',
      position: 2,
      amount: 60_000,
      dueOn: '2026-12-05',
    });
    expect(tenant.installment.findMany.mock.calls[0][0].where.paymentPlan).toEqual({
      partnerId: null,
      OR: [{ payerPersonId: 'per-1' }, { enrollment: { studentId: 'per-1' } }],
    });
    tenant.installment.findMany.mockResolvedValue([]);
    await expect(nextChargeOf({ institutionId: 'inst-1', personId: 'per-1' })).resolves.toBeNull();
  });

  it('para el chat: 24 horas, sin correo de Bold, y solo reutiliza uno recién creado', async () => {
    tenant.installment.findMany.mockResolvedValue([due('i2', 0)]);
    mockCreateLink.mockResolvedValue(NEW_LINK);
    await expect(staff('chat')).resolves.toMatchObject({ url: NEW_LINK.url, amount: 90_000 });
    expect(mockCreateLink).toHaveBeenCalledWith(
      expect.objectContaining({
        ttlMs: 24 * 3600 * 1000,
        payerEmail: null,
        callbackUrl: expect.stringContaining('https://alba.test/aprender/mi-cuenta?pago='),
      })
    );
    expect(tenant.paymentLink.findFirst.mock.calls[0][0].where.expiresAt).toEqual({
      gt: new Date(NOW.getTime() + 23 * 3600 * 1000),
    });
  });

  it('por correo: Bold lo envía; sin correo o sin cuotas, no crea nada', async () => {
    tenant.installment.findMany.mockResolvedValue([due('i2', 0)]);
    mockCreateLink.mockResolvedValue(NEW_LINK);
    await staff('email');
    expect(mockCreateLink).toHaveBeenCalledWith(expect.objectContaining({ payerEmail: 'a@b.co' }));

    mockCreateLink.mockClear();
    await expect(staff('email', null)).rejects.toMatchObject({ code: 'CONFLICT' });
    tenant.installment.findMany.mockResolvedValue([]);
    await expect(staff('chat')).rejects.toMatchObject({ code: 'CONFLICT' });
    expect(mockCreateLink).not.toHaveBeenCalled();
  });
});

describe('handleBoldEvent', () => {
  it('sin firma válida no toca nada', async () => {
    await expect(send(body('SALE_APPROVED'), 'bad')).resolves.toEqual({
      outcome: 'invalid_signature',
      reference: null,
    });
    expect(prisma.paymentLink.findFirst).not.toHaveBeenCalled();
  });

  it('aprobado y Bold dice pagado por lo pendiente: registra una vez y confirma', async () => {
    bold('PAID', 90_000, 'TX-1');
    await expect(send(body('SALE_APPROVED'))).resolves.toEqual({
      outcome: 'confirmed',
      reference: REF,
    });
    expect(tenant.paymentLink.updateMany).toHaveBeenCalledWith({
      where: { id: 'link-1', status: { not: 'PAID' } },
      data: { status: 'PAID' },
    });
    expect(tenant.payment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          amount: 90_000,
          method: 'GATEWAY',
          gatewayRef: 'TX-1',
          reference: REF,
        }),
      })
    );
    expect(mockConfirm).toHaveBeenCalledWith(
      expect.objectContaining({ paymentId: 'p-new', actorId: null })
    );
  });

  it('el evento no se cree: si Bold no lo muestra pagado, no hay pago y se pide reintento', async () => {
    bold('ACTIVE');
    await expect(send(body('SALE_APPROVED'))).resolves.toMatchObject({ outcome: 'pending' });
    bold('PROCESSING');
    await expect(send(body('SALE_APPROVED'))).resolves.toMatchObject({ outcome: 'pending' });
    mockFetchLink.mockResolvedValue(null);
    await expect(send(body('SALE_APPROVED'))).resolves.toMatchObject({ outcome: 'pending' });
    expect(tenant.payment.create).not.toHaveBeenCalled();
  });

  it('monto distinto: queda sin confirmar y avisa a operación', async () => {
    bold('PAID', 50_000, 'TX-1');
    await expect(send(body('SALE_APPROVED'))).resolves.toMatchObject({
      outcome: 'amount_mismatch',
    });
    expect(tenant.payment.create).toHaveBeenCalled();
    expect(mockConfirm).not.toHaveBeenCalled();
    expect(mockNotifyMany).toHaveBeenCalledWith(
      'inst-1',
      ['ops-1'],
      expect.objectContaining({ href: '/cartera/enr-1' })
    );
  });

  it('repetido: el link ya pagado no consulta ni registra; en carrera, gana uno solo', async () => {
    prisma.paymentLink.findFirst.mockResolvedValue(link({ status: 'PAID' }));
    await expect(send(body('SALE_APPROVED'))).resolves.toMatchObject({ outcome: 'duplicate' });
    expect(mockFetchLink).not.toHaveBeenCalled();

    prisma.paymentLink.findFirst.mockResolvedValue(link());
    bold('PAID', 90_000, 'TX-1');
    tenant.paymentLink.updateMany.mockResolvedValue({ count: 0 });
    await expect(send(body('SALE_APPROVED'))).resolves.toMatchObject({ outcome: 'duplicate' });
    expect(tenant.payment.create).not.toHaveBeenCalled();
  });

  it('rechazado avisa al pagador; anulado avisa a operación', async () => {
    await expect(send(body('SALE_REJECTED'))).resolves.toMatchObject({ outcome: 'declined' });
    expect(mockNotify).toHaveBeenCalledWith(
      'inst-1',
      expect.objectContaining({ personId: 'payer-1' })
    );
    await expect(send(body('VOID_APPROVED'))).resolves.toMatchObject({ outcome: 'voided' });
    expect(mockNotifyMany).toHaveBeenCalledWith(
      'inst-1',
      ['ops-1'],
      expect.objectContaining({ title: 'Bold anuló un pago en línea' })
    );
    expect(mockFetchLink).not.toHaveBeenCalled();
  });

  it('una venta que no es de la plataforma (datáfono, otro link) se ignora', async () => {
    prisma.paymentLink.findFirst.mockResolvedValue(null);
    await expect(send(body('SALE_APPROVED', 'venta-datafono'))).resolves.toMatchObject({
      outcome: 'unknown_reference',
    });
    await expect(send(body('SALE_APPROVED', null))).resolves.toMatchObject({
      outcome: 'unknown_reference',
    });
    await expect(send(body('VOID_REJECTED'))).resolves.toMatchObject({ outcome: 'ignored' });
    await expect(send('no-json')).resolves.toMatchObject({ outcome: 'invalid_event' });
    expect(mockFetchLink).not.toHaveBeenCalled();
  });

  it('busca el link por nuestra referencia o por el id del link', async () => {
    bold('PAID', 90_000, 'TX-1');
    await send(body('SALE_APPROVED', 'LNK_1'));
    expect(prisma.paymentLink.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { OR: [{ reference: 'LNK_1' }, { providerId: 'LNK_1' }] } })
    );
  });
});

describe('checkReturnedPayment', () => {
  const back = (reference = REF, enrollmentId = 'enr-1') =>
    checkReturnedPayment({
      institutionId: 'inst-1',
      reference,
      scopes: [{ enrollmentId }] as never,
      now: NOW,
    });
  const owned = (over: Record<string, unknown> = {}) =>
    link({ installment: { paymentPlan: { enrollmentId: 'enr-1', partnerId: null } }, ...over });

  it('pagado: se confirma al volver, sin esperar el webhook', async () => {
    tenant.paymentLink.findFirst.mockResolvedValue(owned());
    bold('PAID', 90_000, null);
    await expect(back()).resolves.toBe('paid');
    // Sin id de transacción, el del link sirve de referencia única.
    expect(tenant.payment.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ gatewayRef: 'LNK_1' }) })
    );
  });

  it('recargar la página no registra otro pago y dice cómo quedó', async () => {
    tenant.paymentLink.findFirst.mockResolvedValue(owned({ status: 'PAID' }));
    tenant.payment.findFirst.mockResolvedValue({ confirmedAt: NOW });
    await expect(back()).resolves.toBe('paid');
    tenant.payment.findFirst.mockResolvedValue({ confirmedAt: null });
    await expect(back()).resolves.toBe('review');
    expect(tenant.payment.create).not.toHaveBeenCalled();
  });

  it('en proceso (PSE) espera; rechazado o vencido deja de ofrecer ese link', async () => {
    tenant.paymentLink.findFirst.mockResolvedValue(owned());
    bold('PROCESSING');
    await expect(back()).resolves.toBe('pending');
    expect(tenant.paymentLink.updateMany).not.toHaveBeenCalled();

    bold('REJECTED');
    await expect(back()).resolves.toBe('failed');
    bold('EXPIRED');
    await expect(back()).resolves.toBe('failed');
    expect(tenant.paymentLink.updateMany).toHaveBeenCalledWith({
      where: { id: 'link-1', status: 'ACTIVE' },
      data: { status: 'EXPIRED' },
    });
  });

  it('Bold caído: en proceso, sin romper la página; referencia ajena: nada', async () => {
    tenant.paymentLink.findFirst.mockResolvedValue(owned());
    mockFetchLink.mockRejectedValue(new Error('timeout'));
    await expect(back()).resolves.toBe('pending');
    tenant.paymentLink.findFirst.mockResolvedValue(null);
    await expect(back()).resolves.toBeNull();
  });

  it('el link de otra matrícula no dice nada ni consulta a Bold', async () => {
    tenant.paymentLink.findFirst.mockResolvedValue(owned());
    await expect(back(REF, 'otra')).resolves.toBeNull();
    expect(mockFetchLink).not.toHaveBeenCalled();
  });

  it('si Bold pega parámetros detrás de la referencia, se usa solo la referencia', async () => {
    tenant.paymentLink.findFirst.mockResolvedValue(owned());
    bold('PAID', 90_000, 'TX-1');
    await expect(back(`${REF}?bold-order-id=X&bold-tx-status=approved`)).resolves.toBe('paid');
    expect(tenant.paymentLink.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { reference: REF } })
    );
    await expect(back('?nada')).resolves.toBeNull();
  });
});

describe('syncOpenPaymentLinks', () => {
  it('recupera el pago cuyo webhook no llegó y vence los links pasados de fecha', async () => {
    tenant.paymentLink.findMany.mockResolvedValue([
      link(),
      link({ id: 'link-2', providerId: 'LNK_2', expiresAt: new Date(NOW.getTime() - 1000) }),
    ]);
    mockFetchLink
      .mockResolvedValueOnce({ status: 'PAID', amountCop: 90_000, transactionId: 'TX-1' })
      .mockResolvedValueOnce({ status: 'ACTIVE', amountCop: 90_000, transactionId: null });
    await expect(syncOpenPaymentLinks({ institutionId: 'inst-1', now: NOW })).resolves.toBe(1);
    expect(mockConfirm).toHaveBeenCalledTimes(1);
    expect(tenant.paymentLink.updateMany).toHaveBeenCalledWith({
      where: { id: 'link-2', status: 'ACTIVE' },
      data: { status: 'EXPIRED' },
    });
  });

  it('un link que falla no detiene a los demás', async () => {
    tenant.paymentLink.findMany.mockResolvedValue([
      link(),
      link({ id: 'link-2', providerId: 'LNK_2' }),
    ]);
    mockFetchLink
      .mockRejectedValueOnce(new Error('timeout'))
      .mockResolvedValueOnce({ status: 'PAID', amountCop: 90_000, transactionId: 'TX-2' });
    await expect(syncOpenPaymentLinks({ institutionId: 'inst-1', now: NOW })).resolves.toBe(1);
  });
});
