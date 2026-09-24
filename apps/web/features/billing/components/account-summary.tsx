/**
 * AccountSummary: la cuenta de una matrícula en lenguaje de persona (E4 de la decisión del
 * estudiante, 23/9). Una frase que dice qué pasa —«Tienes 2 cuotas vencidas desde el 18 de
 * septiembre: $ 200.000»—, la siguiente cuota si la hay, y la consecuencia contractual
 * **solo para adultos y solo la que existe** (la política de la institución).
 *
 * La frontera menor/adulto vive aquí, no solo en el dominio: con `isMinor` este componente
 * **no tiene** rama que junte deuda y acceso, y ninguna prop lo cambia. Que no exista el
 * camino es la garantía (`acceso-y-cartera.md` §2).
 *
 * Servidor: recibe la vista de la cuenta ya calculada y formatea.
 */

import { getFormatter, getTranslations } from 'next-intl/server';
import { StatusBadge } from '@/components/molecules/status-badge/StatusBadge';
import type { AccountView } from '@/features/billing/server/billing.service';

export async function AccountSummary({
  account,
  /** Lo que la institución tiene activado hoy; la única consecuencia que se puede decir. */
  requireAgreementForNextCohort,
}: {
  account: AccountView;
  requireAgreementForNextCohort: boolean;
}) {
  const [t, format] = await Promise.all([getTranslations('billingSummary'), getFormatter()]);
  const cop = (v: number) =>
    format.number(v, { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });
  // `dueOn` es un día (`YYYY-MM-DD`): se pinta en UTC para no perderlo en Bogotá.
  const day = (iso: string) =>
    format.dateTime(new Date(`${iso}T00:00:00Z`), {
      day: 'numeric',
      month: 'long',
      timeZone: 'UTC',
    });

  const overdue = account.installments.filter((i) => i.overdue);
  const overdueAmount = overdue.reduce((sum, i) => sum + (i.amount - i.paid), 0);
  const firstOverdue = overdue.map((i) => i.dueOn).sort()[0] ?? null;
  const agreement = account.agreements.find((g) => g.status === 'ACTIVE') ?? null;
  const next = account.summary.next;
  const status = account.status ?? 'CURRENT';

  let line: string;
  if (status === 'PARTNER_PAID') {
    line = t('partnerPaid');
  } else if (status === 'IN_AGREEMENT' && agreement) {
    line = t('inAgreement', { date: day(agreement.signedAt.slice(0, 10)) });
  } else if (overdue.length > 0 && firstOverdue) {
    line = t('overdue', {
      count: overdue.length,
      date: day(firstOverdue),
      amount: cop(overdueAmount),
    });
  } else if (next) {
    line = t('current', {
      position: next.position,
      amount: cop(next.amount),
      date: day(next.dueOn),
    });
  } else {
    line = t('allPaid');
  }

  const total = account.plan?.totalAmount ?? 0;

  return (
    <div className="space-y-2">
      <p className="type-body m-0 flex flex-wrap items-center gap-2">
        <StatusBadge domain="account" status={status} />
        <span>{line}</span>
      </p>
      {total > 0 && (
        <p className="type-caption text-text-muted m-0">
          {t('paidOf', { paid: cop(account.summary.paid), total: cop(total) })}
        </p>
      )}
      {/*
        La consecuencia, solo para adultos y solo si la institución la tiene activada. Para
        un menor no hay rama: la deuda nunca se junta con el acceso, ni aquí ni en ningún
        texto de esta pantalla.
      */}
      {!account.student.isMinor && overdue.length > 0 && requireAgreementForNextCohort && (
        <p className="type-caption text-text m-0">{t('consequenceAdult')}</p>
      )}
      {account.student.isMinor && (
        <p className="type-caption text-text-muted m-0">{t('minorNotice')}</p>
      )}
    </div>
  );
}
