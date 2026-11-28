import { request } from '../api';

// `AccountView` de apps/web/features/billing/server/billing.service.ts:46-106, lo que la app lee.
export interface Account {
  enrollmentId: string;
  cohort: { programName: string; name: string };
  status: 'PARTNER_PAID' | 'CURRENT' | 'IN_AGREEMENT' | 'OVERDUE' | null;
  installments: {
    id: string;
    position: number;
    amount: number;
    paid: number;
    dueOn: string;
    status: 'OPEN' | 'PARTIALLY_PAID' | 'PAID' | 'VOID';
    overdue: boolean;
    unlocks: string[];
  }[];
  payments: {
    id: string;
    installmentPosition: number;
    amount: number;
    method: 'TRANSFER' | 'BRE_B' | 'CASH' | 'GATEWAY';
    paidAt: string;
    confirmedAt: string | null;
    voidedAt: string | null;
  }[];
  agreements: { id: string; status: 'ACTIVE' | 'FULFILLED' | 'CANCELLED'; signedAt: string }[];
  summary: {
    paid: number;
    pending: number;
    overdue: number;
    next: { id: string; position: number; amount: number; dueOn: string } | null;
  };
}

export const getAccounts = () =>
  request<{ accounts: Account[]; onlinePayment: boolean }>('/api/learn/account');

export const pay = (installmentId: string, delivery: 'redirect' | 'email') =>
  request<{ url: string; delivery: 'redirect' | 'email' }>('/api/learn/account/pay', {
    method: 'POST',
    body: { installmentId, delivery },
  });
