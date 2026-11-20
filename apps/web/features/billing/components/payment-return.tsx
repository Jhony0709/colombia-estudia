/** El aviso al volver del pago en línea (`?pago=`): lo que Bold dijo de ese link. */

import { getTranslations } from 'next-intl/server';
import { Alert } from '@/components/atoms/alert';
import type { ReturnedPayment } from '@/features/billing/server/account.service';

const SEVERITY = { paid: 'success', review: 'info', pending: 'info', failed: 'warning' } as const;

export async function PaymentReturn({ outcome }: { outcome: ReturnedPayment | null }) {
  if (!outcome) return null;
  const t = await getTranslations('learn.account');
  return <Alert severity={SEVERITY[outcome]}>{t(`returned.${outcome}`)}</Alert>;
}
