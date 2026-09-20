'use client';

/**
 * El formulario de ajustes razonables (`Accommodation`), con explicación por campo y la
 * advertencia sobre `notes`. SSOT: plan/08 §8, ajustes-razonables.md.
 *
 * Manda todos los campos siempre (`PUT`); el servidor decide si algo cambió y audita solo
 * entonces.
 */

import { useId, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/atoms/button';
import { Alert } from '@/components/atoms/alert';
import { Label } from '@/components/atoms/label';
import { FormField, FormInput, FormSelect } from '@/components/atoms/form-field';
import { useAnnounce } from '@/lib/a11y/announce';
import { apiErrorText } from '@/lib/http/api-error-text';
import { cn } from '@/lib/utils';

export interface AccommodationFormValues {
  extraTimeFactor: number;
  exemptFromTimer: boolean;
  allowedAttemptsBonus: number;
  requiresCaptions: boolean;
  allowsAssistiveTech: boolean;
  notes: string | null;
}

const DEFAULTS: AccommodationFormValues = {
  extraTimeFactor: 1,
  exemptFromTimer: false,
  allowedAttemptsBonus: 0,
  requiresCaptions: false,
  allowsAssistiveTech: true,
  notes: null,
};

const FACTORS = [1, 1.25, 1.5, 2, 3];

export function AccommodationForm({
  enrollmentId,
  initial,
}: {
  enrollmentId: string;
  initial: AccommodationFormValues | null;
}) {
  const t = useTranslations('enrollmentDetail.accommodation');
  const router = useRouter();
  const { announce } = useAnnounce();
  const id = useId();
  const [values, setValues] = useState<AccommodationFormValues>(initial ?? DEFAULTS);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof AccommodationFormValues>(
    key: K,
    value: AccommodationFormValues[K]
  ) => setValues((v) => ({ ...v, [key]: value }));

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/inclusion/${enrollmentId}/accommodations`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...values, notes: values.notes ?? undefined }),
      });
      const payload = (await res.json().catch(() => null)) as {
        data?: { changed: boolean };
      } | null;
      if (!res.ok) return setError(apiErrorText(payload, t('error')));
      announce(payload?.data?.changed ? t('saved') : t('unchanged'));
      router.refresh();
    } catch {
      setError(t('error'));
    } finally {
      setBusy(false);
    }
  };

  const Check = ({
    field,
    label,
    hint,
  }: {
    field: 'exemptFromTimer' | 'requiresCaptions' | 'allowsAssistiveTech';
    label: string;
    hint: string;
  }) => (
    <div className="flex items-start gap-3">
      <input
        id={`${id}-${field}`}
        type="checkbox"
        checked={values[field]}
        onChange={(e) => set(field, e.target.checked)}
        aria-describedby={`${id}-${field}-hint`}
        className="border-border mt-1 size-5 shrink-0 cursor-pointer rounded-[4px] border accent-[var(--accent-base)]"
      />
      <div>
        <Label htmlFor={`${id}-${field}`}>{label}</Label>
        <p id={`${id}-${field}-hint`} className="type-caption text-text-muted m-0">
          {hint}
        </p>
      </div>
    </div>
  );

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      <Alert severity="warning">{t('noDiagnosis')}</Alert>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label={t('extraTime')} name="extraTimeFactor" hint={t('extraTimeHint')}>
          <FormSelect
            name="extraTimeFactor"
            value={String(values.extraTimeFactor)}
            onChange={(e) => set('extraTimeFactor', Number(e.target.value))}
          >
            {FACTORS.map((f) => (
              <option key={f} value={f}>
                {f === 1
                  ? t('extraTimeNone')
                  : t('extraTimeValue', { percent: Math.round((f - 1) * 100) })}
              </option>
            ))}
          </FormSelect>
        </FormField>
        <FormField label={t('bonus')} name="allowedAttemptsBonus" hint={t('bonusHint')}>
          <FormInput
            name="allowedAttemptsBonus"
            type="number"
            min={0}
            max={10}
            value={values.allowedAttemptsBonus}
            onChange={(e) =>
              set('allowedAttemptsBonus', Math.max(0, Math.min(10, Number(e.target.value) || 0)))
            }
          />
        </FormField>
      </div>

      <div className="space-y-3">
        <Check field="exemptFromTimer" label={t('exempt')} hint={t('exemptHint')} />
        <Check field="requiresCaptions" label={t('captions')} hint={t('captionsHint')} />
        <Check field="allowsAssistiveTech" label={t('assistive')} hint={t('assistiveHint')} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`${id}-notes`}>{t('notes')}</Label>
        <textarea
          id={`${id}-notes`}
          name="notes"
          rows={4}
          maxLength={2_000}
          value={values.notes ?? ''}
          onChange={(e) => set('notes', e.target.value)}
          aria-describedby={`${id}-notes-hint`}
          className={cn(
            'rounded-control border-border bg-surface-sunken text-text type-body w-full border px-3 py-2',
            'focus:border-accent-base duration-fast ease-standard transition-colors'
          )}
        />
        <p id={`${id}-notes-hint`} className="type-caption text-text-muted m-0">
          {t('notesHint')}
        </p>
      </div>

      {error && <Alert severity="error">{error}</Alert>}

      <Button type="submit" loading={busy}>
        {initial ? t('save') : t('create')}
      </Button>
    </form>
  );
}
