'use client';

/**
 * Institution settings form.
 * SSOT: plan/06-cohortes-y-personas.md:11-18 (§1 Institución).
 *
 * Two sections in one form (brand + contact, legal + data policy) and one save:
 * the plan says "dos pantallas"; a single form keeps PUT semantics honest — the endpoint
 * replaces the whole settings object — and spares operations a second round trip.
 */

import { useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { contrastRatio, light, dark } from '@colombia-estudia/design-tokens';
import { FormField, FormInput } from '@/components/atoms/form-field';
import { Button } from '@/components/atoms/button';
import { Alert } from '@/components/atoms/alert';
import { PageSection } from '@/components/templates/page';
import type { InstitutionSettings } from '@/features/admin/server/institution.service';

/*
  Los lienzos contra los que se juzga el color de marca.

  Salen del paquete de tokens y ya no van copiados a mano: el rediseño del 18/9 cambió los
  dos valores y estas constantes se quedaron midiendo contra un fondo que ya no existía. Es
  AP1 de `ui-craft` en su forma más silenciosa — un literal que no se ve mal, solo miente.
*/
const CANVAS_LIGHT = light.surface.canvas;
const CANVAS_DARK = dark.surface.canvas;
/** WCAG 2.1 SC 1.4.11: non-text UI components need 3:1. */
const UI_CONTRAST_MIN = 3;

/** Every field is a string in the form; the endpoint turns blanks back into nulls. */
type FormValues = Record<keyof Omit<InstitutionSettings, 'id'>, string>;
type FieldErrors = Partial<Record<keyof FormValues, string[]>>;

const HEX = /^#[0-9a-fA-F]{6}$/;

export function InstitutionForm({ settings }: { settings: InstitutionSettings }) {
  const t = useTranslations('admin.institution');
  const initial: FormValues = {
    name: settings.name,
    legalName: settings.legalName ?? '',
    taxId: settings.taxId ?? '',
    brandColor: settings.brandColor ?? '',
    supportEmail: settings.supportEmail,
    supportPhone: settings.supportPhone ?? '',
    emailFromName: settings.emailFromName,
    dataPolicyUrl: settings.dataPolicyUrl ?? '',
    dataPolicyVersion: settings.dataPolicyVersion,
  };

  const [values, setValues] = useState<FormValues>(initial);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [status, setStatus] = useState<'idle' | 'saving'>('idle');
  const [result, setResult] = useState<{ kind: 'ok' | 'error'; message: string } | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  function set<K extends keyof FormValues>(key: K, value: string) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  const policyVersionChanged = values.dataPolicyVersion.trim() !== initial.dataPolicyVersion;

  const brandColor = values.brandColor.trim();
  const brandContrast = HEX.test(brandColor)
    ? {
        light: contrastRatio(brandColor, CANVAS_LIGHT),
        dark: contrastRatio(brandColor, CANVAS_DARK),
      }
    : null;
  const brandContrastPoor =
    brandContrast !== null &&
    (brandContrast.light < UI_CONTRAST_MIN || brandContrast.dark < UI_CONTRAST_MIN);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus('saving');
    setFieldErrors({});
    setResult(null);

    try {
      const res = await fetch('/api/admin/institution', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      const body = await res.json();

      if (!res.ok) {
        setFieldErrors((body?.error?.details ?? {}) as FieldErrors);
        setResult({ kind: 'error', message: body?.error?.message ?? t('saveError') });
        return;
      }

      const changed: string[] = body?.data?.changed ?? [];
      setResult({
        kind: 'ok',
        message: changed.length === 0 ? t('savedNoChanges') : t('saved'),
      });
    } catch {
      setResult({ kind: 'error', message: t('saveError') });
    } finally {
      setStatus('idle');
      // Move focus to the outcome so it is not only announced but reachable.
      requestAnimationFrame(() => resultRef.current?.focus());
    }
  }

  const firstError = (key: keyof FormValues) => fieldErrors[key]?.[0];

  return (
    <form onSubmit={handleSubmit} noValidate className="max-w-reading space-y-10">
      {result && (
        <div ref={resultRef} tabIndex={-1} className="outline-none">
          <Alert severity={result.kind === 'ok' ? 'success' : 'error'}>{result.message}</Alert>
        </div>
      )}

      <PageSection id="brand" title={t('brandSection')} card>
        <FormField label={t('name')} name="name" required error={firstError('name')}>
          <FormInput
            name="name"
            value={values.name}
            onChange={(e) => set('name', e.target.value)}
            autoComplete="organization"
          />
        </FormField>

        <FormField
          label={t('emailFromName')}
          name="emailFromName"
          required
          hint={t('emailFromNameHint')}
          error={firstError('emailFromName')}
        >
          <FormInput
            name="emailFromName"
            value={values.emailFromName}
            onChange={(e) => set('emailFromName', e.target.value)}
          />
        </FormField>

        <FormField
          label={t('brandColor')}
          name="brandColor"
          hint={t('brandColorHint')}
          error={firstError('brandColor')}
        >
          <FormInput
            name="brandColor"
            value={values.brandColor}
            onChange={(e) => set('brandColor', e.target.value)}
            placeholder="#1D4ED8"
            spellCheck={false}
          />
        </FormField>

        {brandContrast && (
          <div className="space-y-2">
            <p className="type-caption text-text-muted">
              {t('contrastReading', {
                light: brandContrast.light.toFixed(2),
                dark: brandContrast.dark.toFixed(2),
              })}
            </p>
            {brandContrastPoor && <Alert severity="warning">{t('contrastWarning')}</Alert>}
          </div>
        )}

        <FormField
          label={t('supportEmail')}
          name="supportEmail"
          required
          error={firstError('supportEmail')}
        >
          <FormInput
            name="supportEmail"
            type="email"
            value={values.supportEmail}
            onChange={(e) => set('supportEmail', e.target.value)}
            autoComplete="email"
          />
        </FormField>

        <FormField label={t('supportPhone')} name="supportPhone" error={firstError('supportPhone')}>
          <FormInput
            name="supportPhone"
            type="tel"
            value={values.supportPhone}
            onChange={(e) => set('supportPhone', e.target.value)}
            autoComplete="tel"
          />
        </FormField>
      </PageSection>

      <PageSection id="legal" title={t('legalSection')} card>
        <FormField label={t('legalName')} name="legalName" error={firstError('legalName')}>
          <FormInput
            name="legalName"
            value={values.legalName}
            onChange={(e) => set('legalName', e.target.value)}
          />
        </FormField>

        <FormField label={t('taxId')} name="taxId" error={firstError('taxId')}>
          <FormInput
            name="taxId"
            value={values.taxId}
            onChange={(e) => set('taxId', e.target.value)}
            spellCheck={false}
          />
        </FormField>

        <FormField
          label={t('dataPolicyUrl')}
          name="dataPolicyUrl"
          error={firstError('dataPolicyUrl')}
        >
          <FormInput
            name="dataPolicyUrl"
            type="url"
            value={values.dataPolicyUrl}
            onChange={(e) => set('dataPolicyUrl', e.target.value)}
            placeholder="https://"
            spellCheck={false}
          />
        </FormField>

        <FormField
          label={t('dataPolicyVersion')}
          name="dataPolicyVersion"
          required
          hint={t('dataPolicyVersionHint')}
          error={firstError('dataPolicyVersion')}
        >
          <FormInput
            name="dataPolicyVersion"
            value={values.dataPolicyVersion}
            onChange={(e) => set('dataPolicyVersion', e.target.value)}
            spellCheck={false}
          />
        </FormField>

        {policyVersionChanged && <Alert severity="warning">{t('dataPolicyVersionWarning')}</Alert>}
      </PageSection>

      <div>
        <Button type="submit" loading={status === 'saving'}>
          {t('save')}
        </Button>
      </div>
    </form>
  );
}
