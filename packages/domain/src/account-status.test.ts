/**
 * Tests for account-status.ts
 * SSOT: reference/04-business-logic/acceso-y-cartera.md §4
 */

import {
  deriveAccountStatus,
  deriveInstallmentStatus,
  isInstallmentOverdue,
} from './account-status';
import type { Installment, Payment, PaymentAgreement } from './types';

// ─────────────────────────── Test Helpers ───────────────────────────

const NOW = new Date('2024-06-15T12:00:00Z');
const PAST = new Date('2024-01-15T12:00:00Z');
const FUTURE = new Date('2024-12-15T12:00:00Z');

function createInstallment(overrides?: Partial<Installment>): Installment {
  return {
    id: 'installment-1',
    position: 1,
    amount: 100000, // COP integer
    dueOn: FUTURE,
    status: 'OPEN',
    agreementId: null,
    ...overrides,
  };
}

function createPayment(overrides?: Partial<Payment>): Payment {
  return {
    installmentId: 'installment-1',
    amount: 100000,
    confirmedAt: NOW,
    voidedAt: null,
    ...overrides,
  };
}

function createAgreement(overrides?: Partial<PaymentAgreement>): PaymentAgreement {
  return {
    id: 'agreement-1',
    enrollmentId: 'enrollment-1',
    status: 'ACTIVE',
    ...overrides,
  };
}

// ─────────────────────────── deriveInstallmentStatus ───────────────────────────

describe('deriveInstallmentStatus', () => {
  it('solo pagos confirmados cuentan', () => {
    const payments: Payment[] = [
      createPayment({ amount: 50000, confirmedAt: NOW }),
      createPayment({ installmentId: 'installment-1', amount: 50000, confirmedAt: null }),
    ];

    const result = deriveInstallmentStatus({ amount: 100000, payments });
    // Only the confirmed 50000 counts
    expect(result).toBe('PARTIALLY_PAID');
  });

  it('un pago anulado no cuenta', () => {
    const payments: Payment[] = [
      createPayment({ amount: 100000, confirmedAt: NOW, voidedAt: NOW }),
    ];

    const result = deriveInstallmentStatus({ amount: 100000, payments });
    expect(result).toBe('OPEN');
  });

  it('PAID when total >= amount', () => {
    const payments: Payment[] = [createPayment({ amount: 100000 })];
    const result = deriveInstallmentStatus({ amount: 100000, payments });
    expect(result).toBe('PAID');
  });

  it('PAID when total > amount (overpayment)', () => {
    const payments: Payment[] = [createPayment({ amount: 150000 })];
    const result = deriveInstallmentStatus({ amount: 100000, payments });
    expect(result).toBe('PAID');
  });

  it('PARTIALLY_PAID when 0 < total < amount', () => {
    const payments: Payment[] = [createPayment({ amount: 50000 })];
    const result = deriveInstallmentStatus({ amount: 100000, payments });
    expect(result).toBe('PARTIALLY_PAID');
  });

  it('OPEN when total = 0', () => {
    const result = deriveInstallmentStatus({ amount: 100000, payments: [] });
    expect(result).toBe('OPEN');
  });

  it('montos como enteros (COP sin centavos)', () => {
    const payments: Payment[] = [
      createPayment({ amount: 333333 }),
      createPayment({ installmentId: 'installment-1', amount: 333333 }),
      createPayment({ installmentId: 'installment-1', amount: 333334 }),
    ];

    const result = deriveInstallmentStatus({ amount: 1000000, payments });
    expect(result).toBe('PAID');
  });
});

// ─────────────────────────── isInstallmentOverdue ───────────────────────────

describe('isInstallmentOverdue', () => {
  it('OPEN with past dueOn is overdue', () => {
    const installment = createInstallment({ status: 'OPEN', dueOn: PAST });
    expect(isInstallmentOverdue(installment, NOW)).toBe(true);
  });

  it('PARTIALLY_PAID with past dueOn is overdue', () => {
    const installment = createInstallment({ status: 'PARTIALLY_PAID', dueOn: PAST });
    expect(isInstallmentOverdue(installment, NOW)).toBe(true);
  });

  it('PAID with past dueOn is NOT overdue', () => {
    const installment = createInstallment({ status: 'PAID', dueOn: PAST });
    expect(isInstallmentOverdue(installment, NOW)).toBe(false);
  });

  it('VOID with past dueOn is NOT overdue', () => {
    const installment = createInstallment({ status: 'VOID', dueOn: PAST });
    expect(isInstallmentOverdue(installment, NOW)).toBe(false);
  });

  it('OPEN with future dueOn is NOT overdue', () => {
    const installment = createInstallment({ status: 'OPEN', dueOn: FUTURE });
    expect(isInstallmentOverdue(installment, NOW)).toBe(false);
  });

  // Bogota date tests (AMBIGUO: acceso-y-cartera.md:98)
  it('cuota vence hoy en Bogota -> no vencida', () => {
    // dueOn = 2024-06-15 (stored as midnight UTC)
    // now = 2024-06-15 12:00 UTC = 2024-06-15 07:00 COT (same day in Bogota)
    const dueOn = new Date('2024-06-15T00:00:00.000Z');
    const now = new Date('2024-06-15T12:00:00.000Z');
    const installment = createInstallment({ status: 'OPEN', dueOn });
    expect(isInstallmentOverdue(installment, now)).toBe(false);
  });

  it('cuota vencio ayer en Bogota -> vencida', () => {
    // dueOn = 2024-06-14 (stored as midnight UTC)
    // now = 2024-06-15 06:00 UTC = 2024-06-15 01:00 COT (next day in Bogota)
    const dueOn = new Date('2024-06-14T00:00:00.000Z');
    const now = new Date('2024-06-15T06:00:00.000Z');
    const installment = createInstallment({ status: 'OPEN', dueOn });
    expect(isInstallmentOverdue(installment, now)).toBe(true);
  });
});

// ─────────────────────────── deriveAccountStatus ───────────────────────────

describe('deriveAccountStatus', () => {
  it('PARTNER_PAID when payerType is PARTNER', () => {
    const result = deriveAccountStatus({
      payerType: 'PARTNER',
      installments: [],
      payments: [],
      agreements: [],
      now: NOW,
    });
    expect(result).toBe('PARTNER_PAID');
  });

  it('CURRENT when no overdue installments', () => {
    const result = deriveAccountStatus({
      payerType: 'PERSON',
      installments: [createInstallment({ dueOn: FUTURE })],
      payments: [],
      agreements: [],
      now: NOW,
    });
    expect(result).toBe('CURRENT');
  });

  it('CURRENT when all installments are PAID', () => {
    const result = deriveAccountStatus({
      payerType: 'PERSON',
      installments: [createInstallment({ status: 'PAID', dueOn: PAST })],
      payments: [createPayment({ amount: 100000 })],
      agreements: [],
      now: NOW,
    });
    expect(result).toBe('CURRENT');
  });

  it('OVERDUE when installment is overdue', () => {
    const result = deriveAccountStatus({
      payerType: 'PERSON',
      installments: [createInstallment({ dueOn: PAST, status: 'OPEN' })],
      payments: [],
      agreements: [],
      now: NOW,
    });
    expect(result).toBe('OVERDUE');
  });

  it('IN_AGREEMENT when active agreement with current installments', () => {
    const result = deriveAccountStatus({
      payerType: 'PERSON',
      installments: [
        createInstallment({ id: 'inst-1', status: 'VOID' }), // Original voided
        createInstallment({
          id: 'inst-2',
          agreementId: 'agreement-1',
          dueOn: FUTURE,
          status: 'OPEN',
        }),
      ],
      payments: [],
      agreements: [createAgreement({ status: 'ACTIVE' })],
      now: NOW,
    });
    expect(result).toBe('IN_AGREEMENT');
  });

  it('cuota del acuerdo vencida → OVERDUE aunque las originales estén VOID (§6)', () => {
    const result = deriveAccountStatus({
      payerType: 'PERSON',
      installments: [
        createInstallment({ id: 'inst-1', status: 'VOID' }), // Original voided
        createInstallment({
          id: 'inst-2',
          agreementId: 'agreement-1',
          dueOn: PAST, // Agreement installment overdue
          status: 'OPEN',
        }),
      ],
      payments: [],
      agreements: [createAgreement({ status: 'ACTIVE' })],
      now: NOW,
    });
    expect(result).toBe('OVERDUE');
  });

  it('agreement FULFILLED no cuenta como vigente', () => {
    const result = deriveAccountStatus({
      payerType: 'PERSON',
      installments: [createInstallment({ dueOn: PAST, status: 'OPEN' })],
      payments: [],
      agreements: [createAgreement({ status: 'FULFILLED' })],
      now: NOW,
    });
    // No active agreement, so regular installment check applies
    expect(result).toBe('OVERDUE');
  });

  it('agreement CANCELLED no cuenta como vigente', () => {
    const result = deriveAccountStatus({
      payerType: 'PERSON',
      installments: [createInstallment({ dueOn: PAST, status: 'OPEN' })],
      payments: [],
      agreements: [createAgreement({ status: 'CANCELLED' })],
      now: NOW,
    });
    expect(result).toBe('OVERDUE');
  });

  it('dos matrículas → dos estados (§4)', () => {
    // This test simulates two separate calls for different enrollments
    const enrollment1Result = deriveAccountStatus({
      payerType: 'PERSON',
      installments: [createInstallment({ dueOn: FUTURE })],
      payments: [],
      agreements: [],
      now: NOW,
    });

    const enrollment2Result = deriveAccountStatus({
      payerType: 'PERSON',
      installments: [createInstallment({ dueOn: PAST, status: 'OPEN' })],
      payments: [],
      agreements: [],
      now: NOW,
    });

    expect(enrollment1Result).toBe('CURRENT');
    expect(enrollment2Result).toBe('OVERDUE');
  });

  it('VOID installments are skipped (do not cause OVERDUE)', () => {
    const result = deriveAccountStatus({
      payerType: 'PERSON',
      installments: [createInstallment({ dueOn: PAST, status: 'VOID' })],
      payments: [],
      agreements: [],
      now: NOW,
    });
    expect(result).toBe('CURRENT');
  });

  it('derives status from confirmed payments, not persisted status', () => {
    // Installment says OPEN but has enough confirmed payments
    const result = deriveAccountStatus({
      payerType: 'PERSON',
      installments: [createInstallment({ id: 'inst-1', dueOn: PAST, status: 'OPEN' })],
      payments: [createPayment({ installmentId: 'inst-1', amount: 100000 })],
      agreements: [],
      now: NOW,
    });
    // Payment covers it, so not overdue
    expect(result).toBe('CURRENT');
  });
});
