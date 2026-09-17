/**
 * Account status derivation with `now`.
 * SSOT: reference/04-business-logic/acceso-y-cartera.md §4
 *
 * Derives: PARTNER_PAID, CURRENT, IN_AGREEMENT, OVERDUE
 * Only considers confirmed, non-voided payments.
 */

import { bogotaDate, dateOnly } from './dates';
import type {
  AccountStatus,
  AgreementStatus,
  Installment,
  InstallmentStatus,
  Payment,
  PayerType,
  PaymentAgreement,
} from './types';

// ─────────────────────────── Helper Functions ───────────────────────────

/**
 * Check if a payment is confirmed and not voided.
 */
function isPaymentConfirmed(payment: Payment): boolean {
  return payment.confirmedAt !== null && payment.voidedAt === null;
}

/**
 * Get confirmed payments for an installment.
 */
function getConfirmedPayments(payments: Payment[], installmentId: string): Payment[] {
  return payments.filter((p) => p.installmentId === installmentId && isPaymentConfirmed(p));
}

/**
 * Check if an installment is overdue.
 * SSOT: acceso-y-cartera.md:98 "CURRENT ninguna cuota vencida (OPEN y dueOn < now)"
 *
 * // AMBIGUO(acceso-y-cartera.md:98): PARTIALLY_PAID vencida cuenta como vencida
 */
export function isInstallmentOverdue(installment: Installment, now: Date): boolean {
  // VOID installments are not considered overdue
  if (installment.status === 'VOID') {
    return false;
  }
  // PAID installments are not overdue
  if (installment.status === 'PAID') {
    return false;
  }
  // OPEN or PARTIALLY_PAID with dueOn < now (in Bogota calendar) is overdue
  // @db.Date comes as midnight UTC; compare by calendar day in Bogota
  return dateOnly(installment.dueOn) < bogotaDate(now);
}

// ─────────────────────────── Main Functions ───────────────────────────

/**
 * Derive installment status from payments.
 *
 * Status = f(Σ confirmed non-voided payments, amount)
 * - PAID if total >= amount
 * - PARTIALLY_PAID if total > 0
 * - OPEN if total = 0
 *
 * Note: VOID is set manually, not derived.
 * Note: Amounts are integers (COP without centavos).
 */
export function deriveInstallmentStatus(input: {
  amount: number;
  payments: Payment[];
}): 'OPEN' | 'PARTIALLY_PAID' | 'PAID' {
  const { amount, payments } = input;

  // Sum only confirmed, non-voided payments
  const totalPaid = payments.filter(isPaymentConfirmed).reduce((sum, p) => sum + p.amount, 0);

  if (totalPaid >= amount) {
    return 'PAID';
  }
  if (totalPaid > 0) {
    return 'PARTIALLY_PAID';
  }
  return 'OPEN';
}

/**
 * Derive account status for an enrollment.
 *
 * From acceso-y-cartera.md §4:
 * - PARTNER_PAID: payerType is PARTNER (student has no billing)
 * - CURRENT: no overdue installments
 * - IN_AGREEMENT: active agreement with all agreement installments current
 * - OVERDUE: at least one overdue installment without active agreement,
 *            OR agreement installment is overdue
 *
 * Note: FULFILLED and CANCELLED agreements are not "active" (§6).
 */
export function deriveAccountStatus(input: {
  payerType: PayerType;
  installments: Installment[];
  payments: Payment[];
  agreements: PaymentAgreement[];
  now: Date;
}): AccountStatus {
  const { payerType, installments, payments, agreements, now } = input;

  // If partner pays, student has no billing status
  if (payerType === 'PARTNER') {
    return 'PARTNER_PAID';
  }

  // Find active agreement (only ACTIVE status counts, not FULFILLED or CANCELLED)
  const activeAgreement = agreements.find((a) => a.status === 'ACTIVE');

  if (activeAgreement) {
    // Check if any agreement installment is overdue
    const agreementInstallments = installments.filter((i) => i.agreementId === activeAgreement.id);

    for (const installment of agreementInstallments) {
      // Recalculate status with payments for accurate check
      const installmentPayments = getConfirmedPayments(payments, installment.id);
      const derivedStatus = deriveInstallmentStatus({
        amount: installment.amount,
        payments: installmentPayments,
      });

      // Check if overdue: not PAID and dueOn < now (in Bogota calendar)
      if (derivedStatus !== 'PAID' && dateOnly(installment.dueOn) < bogotaDate(now)) {
        // §6: Agreement installment overdue → OVERDUE
        return 'OVERDUE';
      }
    }

    // Active agreement with all installments current
    return 'IN_AGREEMENT';
  }

  // No active agreement - check regular installments
  for (const installment of installments) {
    // Skip VOID installments (they don't count)
    if (installment.status === 'VOID') {
      continue;
    }

    // Skip agreement installments (handled above)
    if (installment.agreementId !== null) {
      continue;
    }

    // Check if overdue
    const installmentPayments = getConfirmedPayments(payments, installment.id);
    const derivedStatus = deriveInstallmentStatus({
      amount: installment.amount,
      payments: installmentPayments,
    });

    if (derivedStatus !== 'PAID' && dateOnly(installment.dueOn) < bogotaDate(now)) {
      return 'OVERDUE';
    }
  }

  return 'CURRENT';
}
