'use client';

/**
 * El registro público (Fase B, 23/9): en qué cohorte entra quien se registra en `/registro`.
 * SSOT: docs/plan-redefinicion-2009.md Fase B.1.
 *
 * Aparte del formulario de la institución: aquello se guarda una vez; esto cambia cada
 * vez que se abre una cohorte de introducción nueva, y una sección con su propio botón no
 * obliga a reenviar la marca y el contacto para cambiar una cohorte.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { FormField, FormSelect } from '@/components/atoms/form-field';
import { Button } from '@/components/atoms/button';
import { Alert } from '@/components/atoms/alert';
import { PageSection } from '@/components/templates/page';
import { apiErrorText } from '@/lib/http/api-error-text';
import type { RegistrationSettings } from '@/features/admin/server/registration.service';

export function RegistrationForm({ settings }: { settings: RegistrationSettings }) {
  const t = useTranslations('admin.registration');
  const tc = useTranslations('cohorts');
  const router = useRouter();
  const [introCohortId, setIntroCohortId] = useState(settings.introCohortId ?? '');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ kind: 'ok' | 'error'; message: string } | null>(null);

  const dirty = introCohortId !== (settings.introCohortId ?? '');
  // La elegida puede haber dejado de ser candidata (cerrada, archivada): se dice.
  const stale = settings.introCohortId !== null && settings.introCohort === null;

  const save = async () => {
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch('/api/admin/institution/registration', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ introCohortId: introCohortId === '' ? null : introCohortId }),
      });
      if (!res.ok) {
        setResult({
          kind: 'error',
          message: apiErrorText(await res.json().catch(() => null), t('saveError')),
        });
        return;
      }
      setResult({ kind: 'ok', message: t('saved') });
      router.refresh();
    } catch {
      setResult({ kind: 'error', message: t('saveError') });
    } finally {
      setBusy(false);
    }
  };

  return (
    <PageSection id="registro" title={t('title')} description={t('hint')} card>
      <div className="max-w-reading space-y-4">
        {result && (
          <Alert severity={result.kind === 'ok' ? 'success' : 'error'}>{result.message}</Alert>
        )}
        {stale && <Alert severity="warning">{t('stale')}</Alert>}

        <FormField label={t('introCohort')} name="introCohortId" hint={t('introCohortHint')}>
          <FormSelect
            name="introCohortId"
            value={introCohortId}
            onChange={(e) => setIntroCohortId(e.target.value)}
          >
            <option value="">{t('none')}</option>
            {settings.candidates.map((c) => (
              <option key={c.id} value={c.id}>
                {c.code} · {c.name} · {c.programName} · {tc(`statuses.${c.status}`)}
              </option>
            ))}
          </FormSelect>
        </FormField>

        <p className="type-caption text-text-muted">
          {t('linkHint')} <code className="type-caption">/registro</code>
        </p>

        <Button type="button" variant="secondary" loading={busy} disabled={!dirty} onClick={save}>
          {t('save')}
        </Button>
      </div>
    </PageSection>
  );
}
