'use client';

/**
 * La lista de precios de un programa (25/9, fase de negocio 1): lo que cuesta, cómo se cobra
 * y a qué grados aplica. Vive dentro de la fila del programa, debajo de los componentes.
 * SSOT: features/billing/server/prices.service.ts.
 *
 * Un precio no se edita: se archiva y se crea otro con su vigencia. Es lo que permite que
 * un plan de pagos viejo siga diciendo de qué precio salió.
 */

import { useId, useState } from 'react';
import { useFormatter, useTranslations } from 'next-intl';
import { Button } from '@/components/atoms/button';
import { FormField, FormInput, FormSelect } from '@/components/atoms/form-field';
import { DataTable } from '@/components/molecules/data-table';
import type { PricePeriod, ProgramPriceView } from '@/features/billing/server/prices.service';
import type { Send } from '../curriculum-send';

const PERIODS: readonly PricePeriod[] = ['ONE_TIME', 'MONTHLY', 'PER_MODULE'];

const today = () => new Date().toISOString().slice(0, 10);

export function ProgramPrices({
  programId,
  prices,
  busy,
  send,
}: {
  programId: string;
  prices: ProgramPriceView[];
  busy: boolean;
  send: Send;
}) {
  const t = useTranslations('admin.curriculum.prices');
  const format = useFormatter();
  const listId = useId();
  const [adding, setAdding] = useState(false);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [values, setValues] = useState({
    gradeFrom: '',
    gradeTo: '',
    amount: '',
    period: 'MONTHLY' as PricePeriod,
    validFrom: today(),
    validTo: '',
  });

  const cop = (v: number) =>
    format.number(v, { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });
  const grades = (p: ProgramPriceView) =>
    p.gradeFrom === null && p.gradeTo === null
      ? t('allGrades')
      : t('gradeRange', { from: p.gradeFrom ?? '…', to: p.gradeTo ?? '…' });

  const num = (v: string) => (v.trim() === '' ? null : Number(v));

  const add = async () => {
    const ok = await send(
      `/api/admin/programs/${programId}/prices`,
      'POST',
      {
        gradeFrom: num(values.gradeFrom),
        gradeTo: num(values.gradeTo),
        amount: Number(values.amount),
        period: values.period,
        validFrom: values.validFrom,
        validTo: values.validTo.trim() === '' ? null : values.validTo,
      },
      t('added')
    );
    if (ok) {
      setAdding(false);
      setValues((v) => ({ ...v, gradeFrom: '', gradeTo: '', amount: '', validTo: '' }));
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h4 id={listId} className="type-overline text-text-muted m-0 uppercase">
          {t('title')}
        </h4>
        {!adding && (
          <Button type="button" variant="quiet" onClick={() => setAdding(true)}>
            {t('add')}
          </Button>
        )}
      </div>

      <DataTable
        plain
        compactRows
        align="middle"
        caption={t('caption')}
        rows={prices}
        rowKey={(price) => price.id}
        empty={<p className="type-caption text-text-muted m-0">{t('empty')}</p>}
        columns={[
          { key: 'grades', header: t('colGrades'), cell: grades },
          {
            key: 'amount',
            header: t('colAmount'),
            numeric: true,
            cell: (price) => cop(price.amount),
          },
          { key: 'period', header: t('colPeriod'), cell: (price) => t(`period.${price.period}`) },
          {
            key: 'validity',
            header: t('colValidity'),
            cell: (price) =>
              price.validTo
                ? t('validBetween', { from: price.validFrom, to: price.validTo })
                : t('validSince', { from: price.validFrom }),
          },
          {
            key: 'actions',
            header: t('colActions'),
            narrow: true,
            cell: (price) =>
              confirming === price.id ? (
                <span className="flex items-center justify-end gap-1">
                  <Button
                    type="button"
                    variant="secondary"
                    loading={busy}
                    onClick={async () => {
                      const ok = await send(
                        `/api/admin/programs/${programId}/prices/${price.id}`,
                        'PATCH',
                        { op: 'archive' },
                        t('archived')
                      );
                      if (ok) setConfirming(null);
                    }}
                  >
                    {t('confirmArchive')}
                  </Button>
                  <Button type="button" variant="quiet" onClick={() => setConfirming(null)}>
                    {t('cancel')}
                  </Button>
                </span>
              ) : (
                <span className="flex justify-end">
                  <Button type="button" variant="quiet" onClick={() => setConfirming(price.id)}>
                    {t('archive')}
                    {price.planCount > 0 && (
                      <span className="sr-only"> {t('inUse', { count: price.planCount })}</span>
                    )}
                  </Button>
                </span>
              ),
          },
        ]}
      />

      {adding && (
        <form
          className="bg-surface-canvas rounded-card space-y-4 p-4"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            void add();
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label={t('amount')} name="priceAmount" required hint={t('amountHint')}>
              <FormInput
                name="priceAmount"
                type="number"
                inputMode="numeric"
                min={1}
                step={1}
                value={values.amount}
                onChange={(e) => setValues((v) => ({ ...v, amount: e.target.value }))}
              />
            </FormField>
            <FormField label={t('periodLabel')} name="pricePeriod" required>
              <FormSelect
                name="pricePeriod"
                value={values.period}
                onChange={(e) =>
                  setValues((v) => ({ ...v, period: e.target.value as PricePeriod }))
                }
              >
                {PERIODS.map((period) => (
                  <option key={period} value={period}>
                    {t(`period.${period}`)}
                  </option>
                ))}
              </FormSelect>
            </FormField>
            <FormField label={t('gradeFrom')} name="priceGradeFrom" hint={t('gradesHint')}>
              <FormInput
                name="priceGradeFrom"
                type="number"
                inputMode="numeric"
                min={0}
                max={13}
                value={values.gradeFrom}
                onChange={(e) => setValues((v) => ({ ...v, gradeFrom: e.target.value }))}
              />
            </FormField>
            <FormField label={t('gradeTo')} name="priceGradeTo">
              <FormInput
                name="priceGradeTo"
                type="number"
                inputMode="numeric"
                min={0}
                max={13}
                value={values.gradeTo}
                onChange={(e) => setValues((v) => ({ ...v, gradeTo: e.target.value }))}
              />
            </FormField>
            <FormField label={t('validFrom')} name="priceValidFrom" required>
              <FormInput
                name="priceValidFrom"
                type="date"
                value={values.validFrom}
                onChange={(e) => setValues((v) => ({ ...v, validFrom: e.target.value }))}
              />
            </FormField>
            <FormField label={t('validTo')} name="priceValidTo" hint={t('validToHint')}>
              <FormInput
                name="priceValidTo"
                type="date"
                value={values.validTo}
                onChange={(e) => setValues((v) => ({ ...v, validTo: e.target.value }))}
              />
            </FormField>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="submit"
              variant="secondary"
              loading={busy}
              disabled={values.amount.trim() === '' || Number(values.amount) <= 0}
            >
              {t('save')}
            </Button>
            <Button type="button" variant="quiet" onClick={() => setAdding(false)}>
              {t('cancel')}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
