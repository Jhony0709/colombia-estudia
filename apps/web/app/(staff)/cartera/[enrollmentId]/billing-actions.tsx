'use client';

/**
 * Las acciones financieras de una matrícula, todas en dos pasos (plan/09 §3 y §5):
 * - crear el plan (formulario → se crea; no hay paso de resumen porque no mueve dinero);
 * - registrar un pago: formulario → resumen en cristiano → confirmar (`POST payments` y
 *   luego `POST …/confirm`); anular con motivo;
 * - firmar un acuerdo: cuotas nuevas → vista previa del calendario → firmar.
 * Todo es teclado-navegable: formularios nativos, sin diálogos modales.
 */

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations, useFormatter } from 'next-intl';
import { FormField, FormInput, FormSelect } from '@/components/atoms/form-field';
import { Button } from '@/components/atoms/button';
import { Alert } from '@/components/atoms/alert';
import { useAnnounce } from '@/lib/a11y/announce';
import { apiErrorText } from '@/lib/http/api-error-text';

async function call(
  url: string,
  method: 'POST' | 'PATCH',
  body: unknown
): Promise<{ ok: boolean; data: unknown; payload: unknown }> {
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const payload = (await res.json().catch(() => null)) as { data?: unknown } | null;
  return { ok: res.ok, data: payload?.data, payload };
}

// ─────────────────────────── plan ───────────────────────────

export function CreatePlan({
  enrollmentId,
  isMinor,
  partners,
}: {
  enrollmentId: string;
  isMinor: boolean;
  partners: Array<{ id: string; name: string }>;
}) {
  const t = useTranslations('billing.plan');
  const router = useRouter();
  const { announce } = useAnnounce();
  const [payerType, setPayerType] = useState<'PERSON' | 'PARTNER'>('PERSON');
  const [partnerId, setPartnerId] = useState('');
  const [total, setTotal] = useState('');
  const [count, setCount] = useState('3');
  const [firstDueOn, setFirstDueOn] = useState('');
  const [periodicity, setPeriodicity] = useState('MONTHLY');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await call('/api/billing/plans', 'POST', {
        enrollmentId,
        payerType,
        partnerId: payerType === 'PARTNER' ? partnerId || null : null,
        totalAmount: Number(total),
        installments: Number(count),
        firstDueOn,
        periodicity,
      });
      if (!r.ok) return setError(apiErrorText(r.payload, t('error')));
      announce(t('created'));
      router.refresh();
    } catch {
      setError(t('error'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      {isMinor && <Alert severity="info">{t('minorNotice')}</Alert>}
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField label={t('payerType')} name="payerType">
          <FormSelect
            name="payerType"
            value={payerType}
            onChange={(e) => setPayerType(e.target.value as 'PERSON' | 'PARTNER')}
          >
            <option value="PERSON">{t('payerPerson')}</option>
            <option value="PARTNER">{t('payerPartner')}</option>
          </FormSelect>
        </FormField>
        {payerType === 'PARTNER' && (
          <FormField label={t('partner')} name="partnerId" required>
            <FormSelect
              name="partnerId"
              value={partnerId}
              onChange={(e) => setPartnerId(e.target.value)}
            >
              <option value="">{t('choosePartner')}</option>
              {partners.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </FormSelect>
          </FormField>
        )}
        <FormField label={t('total')} name="total" required hint={t('totalHint')}>
          <FormInput
            name="total"
            type="number"
            min={1}
            step={1}
            inputMode="numeric"
            value={total}
            onChange={(e) => setTotal(e.target.value)}
          />
        </FormField>
        <FormField label={t('count')} name="count" required>
          <FormInput
            name="count"
            type="number"
            min={1}
            max={36}
            value={count}
            onChange={(e) => setCount(e.target.value)}
          />
        </FormField>
        <FormField label={t('firstDueOn')} name="firstDueOn" required>
          <FormInput
            name="firstDueOn"
            type="date"
            value={firstDueOn}
            onChange={(e) => setFirstDueOn(e.target.value)}
          />
        </FormField>
        <FormField label={t('periodicity')} name="periodicity">
          <FormSelect
            name="periodicity"
            value={periodicity}
            onChange={(e) => setPeriodicity(e.target.value)}
          >
            <option value="MONTHLY">{t('monthly')}</option>
            <option value="BIWEEKLY">{t('biweekly')}</option>
            <option value="WEEKLY">{t('weekly')}</option>
          </FormSelect>
        </FormField>
      </div>
      {error && <Alert severity="error">{error}</Alert>}
      <Button
        type="submit"
        loading={busy}
        disabled={!total || !firstDueOn || (payerType === 'PARTNER' && !partnerId)}
      >
        {t('create')}
      </Button>
    </form>
  );
}

// ─────────────────────────── pago en dos pasos ───────────────────────────

interface Summary {
  paymentId: string;
  amount: number;
  method: string;
  reference: string | null;
  paidAt: string;
  installment: {
    id: string;
    position: number;
    amount: number;
    dueOn: string;
    pendingBefore: number;
  };
  studentName: string;
}

export function RegisterPayment({
  installments,
}: {
  installments: Array<{
    id: string;
    position: number;
    amount: number;
    paid: number;
    dueOn: string;
    status: string;
  }>;
}) {
  const t = useTranslations('billing.payment');
  const format = useFormatter();
  const router = useRouter();
  const { announce } = useAnnounce();
  const open = installments.filter((i) => i.status === 'OPEN' || i.status === 'PARTIALLY_PAID');
  const [installmentId, setInstallmentId] = useState(open[0]?.id ?? '');
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('TRANSFER');
  const [reference, setReference] = useState('');
  const [paidAt, setPaidAt] = useState(new Date().toISOString().slice(0, 10));
  const [summary, setSummary] = useState<Summary | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cop = (v: number) =>
    format.number(v, { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });

  if (open.length === 0) return <p className="type-body text-text-muted">{t('nothingOpen')}</p>;

  const register = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await call('/api/billing/payments', 'POST', {
        installmentId,
        amount: Number(amount),
        method,
        reference: reference || undefined,
        paidAt,
      });
      if (!r.ok) return setError(apiErrorText(r.payload, t('error')));
      setSummary(r.data as Summary);
    } catch {
      setError(t('error'));
    } finally {
      setBusy(false);
    }
  };

  const confirm = async () => {
    if (!summary) return;
    setBusy(true);
    setError(null);
    try {
      const r = await call(`/api/billing/payments/${summary.paymentId}/confirm`, 'POST', {});
      if (!r.ok) return setError(apiErrorText(r.payload, t('error')));
      announce(t('confirmed'));
      setSummary(null);
      setAmount('');
      setReference('');
      router.refresh();
    } catch {
      setError(t('error'));
    } finally {
      setBusy(false);
    }
  };

  const discard = async () => {
    if (!summary) return;
    // Un registro sin confirmar que se descarta se anula, para que no quede colgando.
    setBusy(true);
    try {
      await call(`/api/billing/payments/${summary.paymentId}/void`, 'POST', {
        reason: 'Descartado antes de confirmar',
      });
    } finally {
      setSummary(null);
      setBusy(false);
      router.refresh();
    }
  };

  if (summary) {
    return (
      <div className="space-y-3" role="region" aria-labelledby="pago-resumen">
        <h3 id="pago-resumen" className="type-body-emphasis">
          {t('summaryTitle')}
        </h3>
        <p className="type-body">
          {t('summaryBody', {
            amount: cop(summary.amount),
            method: t(`methods.${summary.method}`),
            position: summary.installment.position,
            name: summary.studentName,
            dueOn: summary.installment.dueOn,
            pending: cop(summary.installment.pendingBefore),
          })}
        </p>
        {summary.amount > summary.installment.pendingBefore && (
          <Alert severity="warning">{t('overpay')}</Alert>
        )}
        {error && <Alert severity="error">{error}</Alert>}
        <div className="flex gap-2">
          <Button onClick={() => void confirm()} loading={busy}>
            {t('confirm')}
          </Button>
          <Button variant="quiet" onClick={() => void discard()} disabled={busy}>
            {t('discard')}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={register} noValidate className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField label={t('installment')} name="installmentId">
          <FormSelect
            name="installmentId"
            value={installmentId}
            onChange={(e) => setInstallmentId(e.target.value)}
          >
            {open.map((i) => (
              <option key={i.id} value={i.id}>
                {t('installmentOption', {
                  position: i.position,
                  dueOn: i.dueOn,
                  pending: cop(i.amount - i.paid),
                })}
              </option>
            ))}
          </FormSelect>
        </FormField>
        <FormField label={t('amount')} name="amount" required>
          <FormInput
            name="amount"
            type="number"
            min={1}
            step={1}
            inputMode="numeric"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </FormField>
        <FormField label={t('method')} name="method">
          <FormSelect name="method" value={method} onChange={(e) => setMethod(e.target.value)}>
            <option value="TRANSFER">{t('methods.TRANSFER')}</option>
            <option value="BRE_B">{t('methods.BRE_B')}</option>
            <option value="CASH">{t('methods.CASH')}</option>
          </FormSelect>
        </FormField>
        <FormField label={t('paidAt')} name="paidAt" required>
          <FormInput
            name="paidAt"
            type="date"
            value={paidAt}
            onChange={(e) => setPaidAt(e.target.value)}
          />
        </FormField>
        <FormField label={t('reference')} name="reference" hint={t('referenceHint')}>
          <FormInput
            name="reference"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
          />
        </FormField>
      </div>
      {error && <Alert severity="error">{error}</Alert>}
      <Button type="submit" loading={busy} disabled={!installmentId || !amount || !paidAt}>
        {t('review')}
      </Button>
    </form>
  );
}

export function VoidPayment({ paymentId }: { paymentId: string }) {
  const t = useTranslations('billing.payment');
  const router = useRouter();
  const { announce } = useAnnounce();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) {
    return (
      <Button variant="quiet" onClick={() => setOpen(true)}>
        {t('void')}
      </Button>
    );
  }
  return (
    <form
      className="space-y-2"
      noValidate
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        try {
          const r = await call(`/api/billing/payments/${paymentId}/void`, 'POST', { reason });
          if (!r.ok) return setError(apiErrorText(r.payload, t('error')));
          announce(t('voided'));
          setOpen(false);
          router.refresh();
        } catch {
          setError(t('error'));
        } finally {
          setBusy(false);
        }
      }}
    >
      {error && <Alert severity="error">{error}</Alert>}
      <FormField label={t('voidReason')} name={`void-${paymentId}`} required>
        <FormInput
          name={`void-${paymentId}`}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
      </FormField>
      <div className="flex gap-2">
        <Button type="submit" loading={busy} disabled={reason.trim().length < 5}>
          {t('voidConfirm')}
        </Button>
        <Button variant="quiet" onClick={() => setOpen(false)} disabled={busy}>
          {t('cancel')}
        </Button>
      </div>
    </form>
  );
}

// ─────────────────────────── cuota: editar ───────────────────────────

export function EditInstallment({
  installment,
}: {
  installment: { id: string; amount: number; dueOn: string };
}) {
  const t = useTranslations('billing.installment');
  const router = useRouter();
  const { announce } = useAnnounce();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(String(installment.amount));
  const [dueOn, setDueOn] = useState(installment.dueOn);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) {
    return (
      <Button variant="quiet" onClick={() => setOpen(true)}>
        {t('edit')}
      </Button>
    );
  }
  return (
    <form
      className="flex flex-wrap items-end gap-2"
      noValidate
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        try {
          const r = await call(`/api/billing/installments/${installment.id}`, 'PATCH', {
            amount: Number(amount),
            dueOn,
          });
          if (!r.ok) return setError(apiErrorText(r.payload, t('error')));
          announce(t('saved'));
          setOpen(false);
          router.refresh();
        } catch {
          setError(t('error'));
        } finally {
          setBusy(false);
        }
      }}
    >
      <FormField label={t('amount')} name={`amt-${installment.id}`}>
        <FormInput
          name={`amt-${installment.id}`}
          type="number"
          min={1}
          step={1}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
      </FormField>
      <FormField label={t('dueOn')} name={`due-${installment.id}`}>
        <FormInput
          name={`due-${installment.id}`}
          type="date"
          value={dueOn}
          onChange={(e) => setDueOn(e.target.value)}
        />
      </FormField>
      <Button type="submit" loading={busy}>
        {t('save')}
      </Button>
      <Button variant="quiet" onClick={() => setOpen(false)} disabled={busy}>
        {t('cancel')}
      </Button>
      {error && <Alert severity="error">{error}</Alert>}
    </form>
  );
}

// ─────────────────────────── acuerdo en dos pasos ───────────────────────────

interface Preview {
  voided: Array<{ id: string; position: number; pending: number; dueOn: string }>;
  pendingTotal: number;
  created: Array<{ position: number; amount: number; dueOn: string }>;
  newTotal: number;
  covers: boolean;
}

export function SignAgreement({
  enrollmentId,
  hasActive,
}: {
  enrollmentId: string;
  hasActive: boolean;
}) {
  const t = useTranslations('billing.agreement');
  const format = useFormatter();
  const router = useRouter();
  const { announce } = useAnnounce();
  const [rows, setRows] = useState<Array<{ amount: string; dueOn: string }>>([
    { amount: '', dueOn: '' },
  ]);
  const [notes, setNotes] = useState('');
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cop = (v: number) =>
    format.number(v, { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });

  if (hasActive) return <p className="type-body text-text-muted">{t('alreadyActive')}</p>;

  const body = () => ({
    enrollmentId,
    installments: rows
      .filter((r) => r.amount && r.dueOn)
      .map((r) => ({ amount: Number(r.amount), dueOn: r.dueOn })),
    notes: notes || undefined,
  });

  const doPreview = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await call('/api/billing/agreements/preview', 'POST', body());
      if (!r.ok) return setError(apiErrorText(r.payload, t('error')));
      setPreview(r.data as Preview);
    } catch {
      setError(t('error'));
    } finally {
      setBusy(false);
    }
  };

  const sign = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await call('/api/billing/agreements', 'POST', body());
      if (!r.ok) return setError(apiErrorText(r.payload, t('error')));
      announce(t('signed'));
      setPreview(null);
      setRows([{ amount: '', dueOn: '' }]);
      router.refresh();
    } catch {
      setError(t('error'));
    } finally {
      setBusy(false);
    }
  };

  if (preview) {
    return (
      <div className="space-y-3" role="region" aria-labelledby="acuerdo-previa">
        <h3 id="acuerdo-previa" className="type-body-emphasis">
          {t('previewTitle')}
        </h3>
        <p className="type-body">
          {t('previewVoided', { count: preview.voided.length, pending: cop(preview.pendingTotal) })}
        </p>
        <ol className="type-body list-decimal pl-5">
          {preview.created.map((c) => (
            <li key={c.position}>
              {t('previewRow', { position: c.position, amount: cop(c.amount), dueOn: c.dueOn })}
            </li>
          ))}
        </ol>
        <p className="type-body">{t('previewTotal', { total: cop(preview.newTotal) })}</p>
        {!preview.covers && <Alert severity="error">{t('notCovered')}</Alert>}
        {error && <Alert severity="error">{error}</Alert>}
        <div className="flex gap-2">
          <Button onClick={() => void sign()} loading={busy} disabled={!preview.covers}>
            {t('sign')}
          </Button>
          <Button variant="quiet" onClick={() => setPreview(null)} disabled={busy}>
            {t('back')}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={doPreview} noValidate className="space-y-3">
      <p className="type-caption text-text-muted">{t('hint')}</p>
      {rows.map((r, i) => (
        <div key={i} className="flex flex-wrap items-end gap-2">
          <FormField label={t('rowAmount', { n: i + 1 })} name={`a-${i}`}>
            <FormInput
              name={`a-${i}`}
              type="number"
              min={1}
              step={1}
              value={r.amount}
              onChange={(e) =>
                setRows(rows.map((x, j) => (j === i ? { ...x, amount: e.target.value } : x)))
              }
            />
          </FormField>
          <FormField label={t('rowDueOn', { n: i + 1 })} name={`d-${i}`}>
            <FormInput
              name={`d-${i}`}
              type="date"
              value={r.dueOn}
              onChange={(e) =>
                setRows(rows.map((x, j) => (j === i ? { ...x, dueOn: e.target.value } : x)))
              }
            />
          </FormField>
          {rows.length > 1 && (
            <Button
              variant="quiet"
              onClick={() => setRows(rows.filter((_, j) => j !== i))}
              aria-label={t('removeRow', { n: i + 1 })}
            >
              {t('remove')}
            </Button>
          )}
        </div>
      ))}
      <Button
        variant="secondary"
        onClick={() => setRows([...rows, { amount: '', dueOn: '' }])}
        disabled={rows.length >= 36}
      >
        {t('addRow')}
      </Button>
      <FormField label={t('notes')} name="notes">
        <FormInput name="notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
      </FormField>
      {error && <Alert severity="error">{error}</Alert>}
      <Button type="submit" loading={busy} disabled={!rows.some((r) => r.amount && r.dueOn)}>
        {t('preview')}
      </Button>
    </form>
  );
}

export function CancelAgreement({ agreementId }: { agreementId: string }) {
  const t = useTranslations('billing.agreement');
  const router = useRouter();
  const { announce } = useAnnounce();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!open) {
    return (
      <Button variant="quiet" onClick={() => setOpen(true)}>
        {t('cancelAgreement')}
      </Button>
    );
  }
  return (
    <form
      className="space-y-2"
      noValidate
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        try {
          const r = await call(`/api/billing/agreements/${agreementId}/cancel`, 'POST', { reason });
          if (!r.ok) return setError(apiErrorText(r.payload, t('error')));
          announce(t('cancelled'));
          setOpen(false);
          router.refresh();
        } catch {
          setError(t('error'));
        } finally {
          setBusy(false);
        }
      }}
    >
      {error && <Alert severity="error">{error}</Alert>}
      <FormField
        label={t('cancelReason')}
        name={`cancel-${agreementId}`}
        required
        hint={t('cancelHint')}
      >
        <FormInput
          name={`cancel-${agreementId}`}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
      </FormField>
      <div className="flex gap-2">
        <Button type="submit" loading={busy} disabled={reason.trim().length < 5}>
          {t('cancelConfirm')}
        </Button>
        <Button variant="quiet" onClick={() => setOpen(false)} disabled={busy}>
          {t('back')}
        </Button>
      </div>
    </form>
  );
}
