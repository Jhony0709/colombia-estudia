'use client';

/**
 * Open / close a cohort, and create one.
 * SSOT: plan/06-cohortes-y-personas.md:23-30.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CircleAlert, CircleCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
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
  programId = null,
}: {
  cohortId: string;
  status: string;
  code: string;
  /** En la cabecera de la ficha es LA acción: relleno. En una fila de la lista, discreto. */
  prominent?: boolean;
  /** Para el enlace «Volver al contenido» de la revisión previa. */
  programId?: string | null;
}) {
  const t = useTranslations('cohorts');
  const { busy, error, missing, send } = useCohortMutation();
  const [reviewing, setReviewing] = useState(false);

  if (status !== 'PLANNED' && status !== 'OPEN') return null;

  const op = status === 'PLANNED' ? 'open' : 'close';

  return (
    <div className="space-y-2">
      <Button
        variant={prominent ? (op === 'open' ? 'primary' : 'secondary') : 'quiet'}
        disabled={busy}
        aria-label={op === 'open' ? t('openNamed', { code }) : t('closeNamed', { code })}
        onClick={() =>
          op === 'open' ? setReviewing(true) : send(`/api/cohorts/${cohortId}`, 'PATCH', { op })
        }
      >
        {op === 'open' ? t('open') : t('close')}
      </Button>

      {/* Abrir pasa por la revisión previa (23/9): qué se asigna, quién entra, qué se
          queda fuera. Es la misma regla que ejecuta la apertura. */}
      {op === 'open' && (
        <OpeningPreflightSheet
          cohortId={cohortId}
          code={code}
          programId={programId}
          open={reviewing}
          onOpenChange={setReviewing}
        />
      )}

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

interface Preflight {
  programName: string;
  modules: number;
  lessonsPublished: number;
  assessmentsPublished: number;
  enrollments: number;
  cohort: { startsOn: string; endsOn: string; progression: string };
  missing: Missing[];
}

/**
 * La revisión antes de abrir (23/9): el equivalente de una lista de comprobación antes de
 * publicar. Se carga al abrir la hoja, del mismo `planCohortOpening` que usa la apertura.
 * Con piezas en borrador, la acción cambia a «Abrir sin lo pendiente» y dice adónde irán.
 */
function OpeningPreflightSheet({
  cohortId,
  code,
  programId,
  open,
  onOpenChange,
}: {
  cohortId: string;
  code: string;
  programId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations('cohorts.preflight');
  const tc = useTranslations('cohorts');
  const router = useRouter();
  const [data, setData] = useState<Preflight | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setData(null);
    setLoadError(null);
    setDone(null);
    fetch(`/api/cohorts/${cohortId}/preflight`)
      .then(async (res) => {
        const payload = await res.json();
        if (!res.ok) throw new Error(payload?.error?.message ?? 'error');
        if (!cancelled) setData((payload.data ?? payload) as Preflight);
      })
      .catch(() => {
        if (!cancelled) setLoadError(tc('error'));
      });
    return () => {
      cancelled = true;
    };
  }, [open, cohortId, tc]);

  const confirm = async (skipUnpublished: boolean) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/cohorts/${cohortId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ op: 'open', skipUnpublished }),
      });
      const payload = await res.json();
      if (!res.ok) {
        setError(payload?.error?.message ?? tc('error'));
        return;
      }
      const result = (payload.data ?? payload) as { assigned: number };
      setDone(t('opened', { assigned: result.assigned }));
      router.refresh();
      setTimeout(() => onOpenChange(false), 1200);
    } catch {
      setError(tc('error'));
    } finally {
      setBusy(false);
    }
  };

  const nothing = data !== null && data.lessonsPublished + data.assessmentsPublished === 0;
  const hasMissing = data !== null && data.missing.length > 0;

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={t('title', { code })}
      description={t('description')}
    >
      {loadError && <Alert severity="error">{loadError}</Alert>}
      {!data && !loadError && <p className="type-body text-text-muted">{t('loading')}</p>}
      {data && (
        <div className="space-y-4">
          <ul className="space-y-2">
            <Check ok label={t('program', { name: data.programName })} />
            <Check ok={data.modules > 0} label={t('modules', { count: data.modules })} />
            <Check
              ok={data.lessonsPublished > 0}
              label={t('lessons', { count: data.lessonsPublished })}
            />
            <Check
              ok={data.assessmentsPublished > 0}
              label={t('assessments', { count: data.assessmentsPublished })}
            />
            <Check
              ok={data.enrollments > 0}
              label={t('enrollments', { count: data.enrollments })}
            />
            <Check
              ok
              label={t('dates', {
                startsOn: data.cohort.startsOn,
                endsOn: data.cohort.endsOn,
                progression:
                  data.cohort.progression === 'FREE'
                    ? tc('progressionFree')
                    : tc('progressionLinear'),
              })}
            />
          </ul>

          {hasMissing && (
            <Alert severity="warning">
              <p className="type-body-emphasis m-0">
                {t('missingTitle', { count: data.missing.length })}
              </p>
              <ul className="type-caption mt-1 list-disc space-y-0.5 pl-5">
                {data.missing.map((m) => (
                  <li key={`${m.kind}-${m.title}`}>
                    {tc(`missingKind.${m.kind}`)}: {m.title}
                  </li>
                ))}
              </ul>
              <p className="type-caption mt-2">{t('missingHint')}</p>
            </Alert>
          )}
          {nothing && <Alert severity="error">{t('nothingToAssign')}</Alert>}
          {error && <Alert severity="error">{error}</Alert>}
          {done && <Alert severity="success">{done}</Alert>}

          <div className="flex flex-wrap justify-end gap-2 pt-2">
            {programId && (hasMissing || nothing) && (
              <Button asChild variant="quiet">
                <Link href={`/contenido/programas/${programId}`}>{t('goToBuilder')}</Link>
              </Button>
            )}
            <Button
              onClick={() => confirm(hasMissing)}
              loading={busy}
              disabled={nothing || done !== null}
            >
              {hasMissing ? t('confirmSkipping') : t('confirm')}
            </Button>
          </div>
        </div>
      )}
    </Sheet>
  );
}

function Check({ ok, label }: { ok: boolean; label: string }) {
  const Icon = ok ? CircleCheck : CircleAlert;
  return (
    <li className="type-body flex items-start gap-2">
      <Icon
        aria-hidden
        className={cn(
          'mt-0.5 size-4 shrink-0',
          ok ? 'text-status-success-base' : 'text-status-warning-base'
        )}
      />
      <span className={cn(!ok && 'text-text-muted')}>{label}</span>
    </li>
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
