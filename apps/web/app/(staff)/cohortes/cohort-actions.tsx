'use client';

/**
 * Open / close a cohort, and create one.
 * SSOT: plan/06-cohortes-y-personas.md:23-30.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { FormField, FormInput, FormSelect } from '@/components/atoms/form-field';
import { Button } from '@/components/atoms/button';
import { Alert } from '@/components/atoms/alert';
import { Sheet } from '@/components/organisms/sheet';
import type { CohortFormOptions } from '@/features/cohorts/server/cohorts.service';

interface Missing {
  kind: 'lesson' | 'assessment';
  title: string;
}

function useCohortMutation() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [missing, setMissing] = useState<Missing[]>([]);

  async function send(url: string, method: 'POST' | 'PATCH', body: unknown): Promise<boolean> {
    setBusy(true);
    setError(null);
    setMissing([]);
    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const payload = await res.json();
      if (!res.ok) {
        setError(payload?.error?.message ?? 'No se pudo completar la acción.');
        setMissing((payload?.error?.details?.missing ?? []) as Missing[]);
        return false;
      }
      router.refresh();
      return true;
    } catch {
      setError('No se pudo completar la acción.');
      return false;
    } finally {
      setBusy(false);
    }
  }

  return { busy, error, missing, send };
}

export function CohortStatusAction({
  cohortId,
  status,
  code,
  prominent = false,
}: {
  cohortId: string;
  status: string;
  code: string;
  /** En la cabecera de la ficha es LA acción: relleno. En una fila de la lista, discreto. */
  prominent?: boolean;
}) {
  const t = useTranslations('cohorts');
  const { busy, error, missing, send } = useCohortMutation();

  if (status !== 'PLANNED' && status !== 'OPEN') return null;

  const op = status === 'PLANNED' ? 'open' : 'close';

  return (
    <div className="space-y-2">
      <Button
        variant={prominent ? (op === 'open' ? 'primary' : 'secondary') : 'quiet'}
        disabled={busy}
        aria-label={op === 'open' ? t('openNamed', { code }) : t('closeNamed', { code })}
        onClick={() => send(`/api/cohorts/${cohortId}`, 'PATCH', { op })}
      >
        {op === 'open' ? t('open') : t('close')}
      </Button>

      {error && (
        <div role="alert">
          <Alert severity="error">{error}</Alert>
          {missing.length > 0 && (
            <ul className="type-caption text-text-muted mt-2 space-y-1">
              {missing.map((m) => (
                <li key={`${m.kind}-${m.title}`}>
                  {t(`missingKind.${m.kind}`)}: {m.title}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

export function NewCohortForm({ options }: { options: CohortFormOptions }) {
  const t = useTranslations('cohorts');
  const { busy, error, send } = useCohortMutation();
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState({
    code: '',
    name: '',
    programId: options.programs[0]?.id ?? '',
    partnerId: '',
    progression: 'LINEAR',
    startsOn: '',
    endsOn: '',
  });

  // Sin programas no hay cohorte que crear: el botón lo dice en vez de abrir un formulario
  // con un desplegable vacío.
  if (options.programs.length === 0) {
    return (
      <Button variant="secondary" disabled title={t('needsProgram')}>
        {t('newCohort')}
      </Button>
    );
  }

  /*
    El alta vive en la cabecera —es LA acción de esta pantalla— y se abre en una hoja. Hasta el
    19/9 era una sección al final de la página, debajo de la tabla: la persona que venía a
    crear una cohorte tenía que pasar por todas las que ya existían para encontrar el botón.
  */
  return (
    <>
      <Button onClick={() => setOpen(true)}>{t('newCohort')}</Button>
      <Sheet
        open={open}
        onOpenChange={setOpen}
        title={t('newCohort')}
        description={t('newCohortHint')}
      >
        <form
          className="space-y-4"
          noValidate
          onSubmit={async (e) => {
            e.preventDefault();
            const ok = await send('/api/cohorts', 'POST', values);
            if (ok) setOpen(false);
          }}
        >
          {error && <Alert severity="error">{error}</Alert>}

          <FormField label={t('code')} name="code" required hint={t('codeHint')}>
            <FormInput
              name="code"
              value={values.code}
              onChange={(e) => setValues((v) => ({ ...v, code: e.target.value }))}
              spellCheck={false}
            />
          </FormField>

          <FormField label={t('name')} name="name" required>
            <FormInput
              name="name"
              value={values.name}
              onChange={(e) => setValues((v) => ({ ...v, name: e.target.value }))}
            />
          </FormField>

          <FormField label={t('program')} name="programId" required>
            <FormSelect
              name="programId"
              value={values.programId}
              onChange={(e) => setValues((v) => ({ ...v, programId: e.target.value }))}
            >
              {options.programs.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code} — {p.name}
                </option>
              ))}
            </FormSelect>
          </FormField>

          {options.partners.length > 0 && (
            <FormField label={t('partner')} name="partnerId">
              <FormSelect
                name="partnerId"
                value={values.partnerId}
                onChange={(e) => setValues((v) => ({ ...v, partnerId: e.target.value }))}
              >
                <option value="">{t('noPartner')}</option>
                {options.partners.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </FormSelect>
            </FormField>
          )}

          <FormField
            label={t('progression')}
            name="progression"
            required
            hint={t('progressionHint')}
          >
            <FormSelect
              name="progression"
              value={values.progression}
              onChange={(e) => setValues((v) => ({ ...v, progression: e.target.value }))}
            >
              <option value="LINEAR">{t('progressionLinear')}</option>
              <option value="FREE">{t('progressionFree')}</option>
            </FormSelect>
          </FormField>

          <FormField label={t('startsOn')} name="startsOn" required>
            <FormInput
              name="startsOn"
              type="date"
              value={values.startsOn}
              onChange={(e) => setValues((v) => ({ ...v, startsOn: e.target.value }))}
            />
          </FormField>

          <FormField label={t('endsOn')} name="endsOn" required>
            <FormInput
              name="endsOn"
              type="date"
              value={values.endsOn}
              onChange={(e) => setValues((v) => ({ ...v, endsOn: e.target.value }))}
            />
          </FormField>

          <div className="flex gap-2">
            <Button type="submit" loading={busy}>
              {t('create')}
            </Button>
            <Button variant="quiet" onClick={() => setOpen(false)} disabled={busy}>
              {t('cancel')}
            </Button>
          </div>
        </form>
      </Sheet>
    </>
  );
}
