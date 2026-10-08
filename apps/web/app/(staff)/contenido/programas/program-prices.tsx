'use client';

/**
 * La lista de precios de un programa (25/9; revisada el 8/10): lo que cuesta, cómo se cobra, a
 * qué grados aplica y si se cobra hoy. Vive dentro de la fila del programa, debajo de los
 * componentes. SSOT: features/billing/server/prices.service.ts.
 *
 * Un precio que ningún plan usa se corrige o se borra. Uno que ya usa algún plan solo se archiva:
 * para cambiarlo se crea otro con la fecha desde la que aplica, y el anterior queda «Reemplazado».
 */

import { useId, useState } from 'react';
import { useFormatter, useTranslations } from 'next-intl';
import { bogotaDate } from '@colombia-estudia/domain';
import { Badge, type BadgeVariant } from '@/components/atoms/badge';
import { Button } from '@/components/atoms/button';
import { FormField, FormInput, FormSelect } from '@/components/atoms/form-field';
import { DataTable } from '@/components/molecules/data-table';
import type {
  PricePeriod,
  PriceState,
  ProgramPriceView,
} from '@/features/billing/server/prices.service';
import type { Send } from '../curriculum-send';

const PERIODS: readonly PricePeriod[] = ['PER_MODULE', 'MONTHLY', 'ONE_TIME'];

const STATE_VARIANT: Record<PriceState, BadgeVariant> = {
  CURRENT: 'success',
  SCHEDULED: 'info',
  REPLACED: 'neutral',
  EXPIRED: 'neutral',
};

type Values = {
  gradeFrom: string;
  gradeTo: string;
  amount: string;
  period: PricePeriod;
  validFrom: string;
  validTo: string;
};

const blank = (): Values => ({
  gradeFrom: '',
  gradeTo: '',
  amount: '',
  period: 'PER_MODULE',
  validFrom: bogotaDate(new Date()),
  validTo: '',
});

const valuesOf = (p: ProgramPriceView): Values => ({
  gradeFrom: p.gradeFrom === null ? '' : String(p.gradeFrom),
  gradeTo: p.gradeTo === null ? '' : String(p.gradeTo),
  amount: String(p.amount),
  period: p.period,
  validFrom: p.validFrom,
  validTo: p.validTo ?? '',
});

export function ProgramPrices({
  programId,
  prices,
  free,
  busy,
  send,
}: {
  programId: string;
  prices: ProgramPriceView[];
  /** Programa gratuito: no se le añaden precios. */
  free: boolean;
  busy: boolean;
  send: Send;
}) {
  const t = useTranslations('admin.curriculum.prices');
  const format = useFormatter();
  const listId = useId();
  // `null`: cerrado; `'new'`: añadiendo; un id: corrigiendo ese precio.
  const [form, setForm] = useState<'new' | string | null>(null);
  const [confirming, setConfirming] = useState<{ id: string; op: 'archive' | 'delete' } | null>(
    null
  );
  const [values, setValues] = useState<Values>(blank);

  const cop = (v: number) =>
    format.number(v, { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });
  const day = (iso: string) =>
    format.dateTime(new Date(`${iso}T00:00:00.000Z`), {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC',
    });
  const grades = (p: ProgramPriceView) =>
    p.gradeFrom === null && p.gradeTo === null
      ? t('allGrades')
      : t('gradeRange', { from: p.gradeFrom ?? '…', to: p.gradeTo ?? '…' });
  const num = (v: string) => (v.trim() === '' ? null : Number(v));

  const open = (target: 'new' | ProgramPriceView) => {
    setConfirming(null);
    setValues(target === 'new' ? blank() : valuesOf(target));
    setForm(target === 'new' ? 'new' : target.id);
  };

  const save = async () => {
    const body = {
      gradeFrom: num(values.gradeFrom),
      gradeTo: num(values.gradeTo),
      amount: Number(values.amount),
      period: values.period,
      validFrom: values.validFrom,
      validTo: values.validTo.trim() === '' ? null : values.validTo,
    };
    const ok =
      form === 'new'
        ? await send(`/api/admin/programs/${programId}/prices`, 'POST', body, t('added'))
        : await send(
            `/api/admin/programs/${programId}/prices/${form}`,
            'PATCH',
            { op: 'update', ...body },
            t('saved')
          );
    if (ok) setForm(null);
  };

  const editing = form !== null && form !== 'new';
  // Ya hay uno que se cobra hoy: el nuevo lo reemplaza desde su fecha (mismos grados).
  const hasCurrent = prices.some((p) => p.state === 'CURRENT');

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h4 id={listId} className="type-overline text-text-muted m-0 uppercase">
          {t('title')}
        </h4>
        {form === null && !free && (
          <Button type="button" variant="quiet" onClick={() => open('new')}>
            {t('add')}
          </Button>
        )}
      </div>

      {free && prices.length === 0 ? (
        <p className="type-caption text-text-muted m-0">{t('freeProgram')}</p>
      ) : (
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
            {
              key: 'period',
              header: t('colPeriod'),
              cell: (price) => t(`period.${price.period}`),
            },
            {
              key: 'validity',
              header: t('colValidity'),
              cell: (price) =>
                price.validTo
                  ? t('validBetween', { from: day(price.validFrom), to: day(price.validTo) })
                  : t('validSince', { from: day(price.validFrom) }),
            },
            {
              key: 'state',
              header: t('colState'),
              cell: (price) =>
                price.state && (
                  <span className="flex flex-col items-start gap-0.5">
                    <Badge variant={STATE_VARIANT[price.state]}>{t(`state.${price.state}`)}</Badge>
                    {price.planCount > 0 && (
                      <span className="type-caption text-text-muted">
                        {t('inUse', { count: price.planCount })}
                      </span>
                    )}
                  </span>
                ),
            },
            {
              key: 'actions',
              header: t('colActions'),
              narrow: true,
              cell: (price) =>
                confirming?.id === price.id ? (
                  <span className="flex flex-col items-end gap-1">
                    <span className="type-caption text-text-muted w-56 whitespace-normal text-right">
                      {confirming.op === 'delete' ? t('deleteHint') : t('archiveHint')}
                    </span>
                    <span className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant="secondary"
                        loading={busy}
                        onClick={async () => {
                          const ok = await send(
                            `/api/admin/programs/${programId}/prices/${price.id}`,
                            'PATCH',
                            { op: confirming.op },
                            confirming.op === 'delete' ? t('deleted') : t('archived')
                          );
                          if (ok) setConfirming(null);
                        }}
                      >
                        {confirming.op === 'delete' ? t('confirmDelete') : t('confirmArchive')}
                      </Button>
                      <Button type="button" variant="quiet" onClick={() => setConfirming(null)}>
                        {t('cancel')}
                      </Button>
                    </span>
                  </span>
                ) : (
                  <span className="flex justify-end gap-1">
                    {price.planCount === 0 ? (
                      <>
                        <Button type="button" variant="quiet" onClick={() => open(price)}>
                          {t('edit')}
                          <span className="sr-only"> {cop(price.amount)}</span>
                        </Button>
                        <Button
                          type="button"
                          variant="quiet"
                          onClick={() => setConfirming({ id: price.id, op: 'delete' })}
                        >
                          {t('delete')}
                          <span className="sr-only"> {cop(price.amount)}</span>
                        </Button>
                      </>
                    ) : (
                      <Button
                        type="button"
                        variant="quiet"
                        onClick={() => setConfirming({ id: price.id, op: 'archive' })}
                      >
                        {t('archive')}
                        <span className="sr-only"> {cop(price.amount)}</span>
                      </Button>
                    )}
                  </span>
                ),
            },
          ]}
        />
      )}

      {form !== null && (
        <form
          aria-label={editing ? t('editTitle') : t('newTitle')}
          className="bg-surface-canvas rounded-card space-y-4 p-4"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
        >
          <p className="type-body-emphasis text-text m-0">
            {editing ? t('editTitle') : t('newTitle')}
          </p>
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
            <FormField
              label={t('validFrom')}
              name="priceValidFrom"
              required
              hint={!editing && hasCurrent ? t('replacesHint') : undefined}
            >
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
              {editing ? t('saveChanges') : t('save')}
            </Button>
            <Button type="button" variant="quiet" onClick={() => setForm(null)}>
              {t('cancel')}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
