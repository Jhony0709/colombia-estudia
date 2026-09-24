'use client';

/**
 * Enrol, withdraw and extend, from the cohort detail.
 * SSOT: plan/06-cohortes-y-personas.md:72-77.
 */

import { useState } from 'react';
import Link from 'next/link';
import type { Route } from 'next';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { CircleAlert, CircleCheck } from 'lucide-react';
import { FormField, FormInput, FormSelect } from '@/components/atoms/form-field';
import { Button } from '@/components/atoms/button';
import { Alert } from '@/components/atoms/alert';
import { Sheet } from '@/components/organisms/sheet';
import { apiErrorText } from '@/lib/http/api-error-text';
import { cn } from '@/lib/utils';
import type { EnrollmentPreview } from '@/features/cohorts/server/enrollments.service';

function useEnrollmentMutation() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  async function send(
    url: string,
    method: 'POST' | 'PATCH',
    body: unknown,
    okMessage: string
  ): Promise<boolean> {
    setBusy(true);
    setError(null);
    setDone(null);
    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const payload = await res.json();
      if (!res.ok) {
        setError(payload?.error?.message ?? 'No se pudo completar la acción.');
        return false;
      }
      // Un aviso del servidor (p. ej., la política de cartera) se enseña junto al éxito.
      const warning = (payload?.data as { warning?: string | null } | undefined)?.warning;
      setDone(warning ? `${okMessage} ${warning}` : okMessage);
      router.refresh();
      return true;
    } catch {
      setError('No se pudo completar la acción.');
      return false;
    } finally {
      setBusy(false);
    }
  }

  const clear = () => {
    setError(null);
    setDone(null);
  };

  return { busy, error, done, send, clear };
}

/**
 * Matricular, en una hoja y en dos pasos (23/9, pieza 5): primero se comprueba a quién
 * —nombre, si es menor y con qué acudiente, si ya está, qué más cursa, hasta cuándo tendría
 * acceso y el aviso de cartera— y solo entonces se matricula. Antes era un campo y un
 * botón: el «es menor sin acudiente» llegaba como error después de pulsar, y la fecha de
 * acceso, nunca. La comprobación es `POST …/enrollments/preview`: las mismas reglas que
 * la matrícula, sin escribir.
 */
export function EnrollSheet({
  cohortId,
  disabled,
  modules,
  prominent = false,
}: {
  cohortId: string;
  disabled: boolean;
  /** Los módulos del programa, en orden, para elegir el grado de entrada (20/9). */
  modules: Array<{ id: string; name: string; position: number }>;
  /** En la cabecera de una cohorte abierta es LA acción (ola 2, 23/9): relleno. */
  prominent?: boolean;
}) {
  const t = useTranslations('enrollments');
  const { busy, error, done, send, clear } = useEnrollmentMutation();
  const [open, setOpen] = useState(false);
  const [handle, setHandle] = useState('');
  // '' = desde el primer módulo (se manda `null`); si no, la posición del módulo elegido.
  const [startsAt, setStartsAt] = useState('');
  const [preview, setPreview] = useState<EnrollmentPreview | null>(null);
  const [checking, setChecking] = useState(false);
  const [checkError, setCheckError] = useState<string | null>(null);

  if (disabled) {
    return prominent ? null : (
      <p className="type-body text-text-muted">{t('closedForEnrolment')}</p>
    );
  }

  const reset = () => {
    setHandle('');
    setStartsAt('');
    setPreview(null);
    setCheckError(null);
  };

  const check = async () => {
    setChecking(true);
    setCheckError(null);
    setPreview(null);
    // El «matriculada» de la persona anterior no es de esta.
    clear();
    try {
      const res = await fetch(`/api/cohorts/${cohortId}/enrollments/preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ personHandle: handle }),
      });
      const payload = (await res.json().catch(() => null)) as {
        data?: EnrollmentPreview;
      } | null;
      if (!res.ok || !payload?.data) {
        setCheckError(apiErrorText(payload, t('sheet.checkError')));
        return;
      }
      setPreview(payload.data);
    } catch {
      setCheckError(t('sheet.checkError'));
    } finally {
      setChecking(false);
    }
  };

  const enrol = async () => {
    const ok = await send(
      `/api/cohorts/${cohortId}/enrollments`,
      'POST',
      { personHandle: handle, startsAtModule: startsAt === '' ? null : Number(startsAt) },
      t('enrolled')
    );
    if (ok) reset();
  };

  const canEnrol = preview !== null && preview.person !== null && preview.blockers.length === 0;

  return (
    <>
      <Button
        type="button"
        variant={prominent ? 'primary' : 'secondary'}
        onClick={() => {
          reset();
          setOpen(true);
        }}
      >
        {t('sheet.open')}
      </Button>

      <Sheet
        open={open}
        onOpenChange={setOpen}
        title={t('sheet.title')}
        description={t('sheet.description')}
      >
        <form
          className="space-y-4"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            void (canEnrol ? enrol() : check());
          }}
        >
          <FormField
            label={t('personHandle')}
            name="personHandle"
            required
            hint={t('personHandleHint')}
          >
            <FormInput
              name="personHandle"
              value={handle}
              onChange={(e) => {
                setHandle(e.target.value);
                setPreview(null);
              }}
            />
          </FormField>

          {preview === null && (
            <Button
              type="submit"
              variant="secondary"
              loading={checking}
              disabled={handle.trim() === ''}
            >
              {t('sheet.check')}
            </Button>
          )}

          {checkError !== null && <Alert severity="error">{checkError}</Alert>}

          {preview !== null && <PreviewCard preview={preview} />}

          {/* El grado de entrada solo cuando ya se sabe a quién: un select antes de la
              persona es una pregunta sin sujeto. */}
          {canEnrol && modules.length > 1 && (
            <FormField label={t('startsAt')} name="startsAtModule" hint={t('startsAtHint')}>
              <FormSelect
                name="startsAtModule"
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
              >
                <option value="">{t('startsAtFirst')}</option>
                {/* El primero ya es «desde el primer módulo»: listarlo sería la misma opción dos veces. */}
                {modules.slice(1).map((m) => (
                  <option key={m.id} value={String(m.position)}>
                    {t('moduleOption', { position: m.position, name: m.name })}
                  </option>
                ))}
              </FormSelect>
            </FormField>
          )}

          <div role="status" aria-live="polite">
            {error && <Alert severity="error">{error}</Alert>}
            {done && <Alert severity="success">{done}</Alert>}
          </div>

          {preview !== null && (
            <div className="flex flex-wrap items-center gap-3">
              <Button type="submit" loading={busy} disabled={!canEnrol}>
                {t('enrol')}
              </Button>
              <Button type="button" variant="quiet" onClick={reset} disabled={busy}>
                {t('sheet.another')}
              </Button>
            </div>
          )}
        </form>
      </Sheet>
    </>
  );
}

/** La persona tal y como quedaría matriculada, y lo que lo impide. Icono **y** palabra. */
function PreviewCard({ preview }: { preview: EnrollmentPreview }) {
  const t = useTranslations('enrollments');

  if (preview.person === null) {
    return <Alert severity="warning">{t('sheet.notFound')}</Alert>;
  }

  const { person } = preview;
  const rows: Array<{
    ok: boolean;
    text: string;
    href?: Route;
    link?: string;
    /** Una lista debajo del texto (lo que más cursa): una por línea, no separada por comas. */
    items?: string[];
  }> = [];

  rows.push(
    person.hasBirthDate
      ? { ok: true, text: person.isMinor ? t('sheet.minor') : t('sheet.adult') }
      : {
          ok: false,
          text: t('sheet.noBirthDate'),
          href: `/personas/${person.id}`,
          link: t('sheet.fixPerson'),
        }
  );
  if (person.isMinor) {
    rows.push(
      person.guardianName
        ? { ok: true, text: t('sheet.guardian', { name: person.guardianName }) }
        : {
            ok: false,
            text: t('sheet.noGuardian'),
            href: `/personas/${person.id}`,
            link: t('sheet.addGuardian'),
          }
    );
  }
  rows.push(
    preview.alreadyEnrolled
      ? { ok: false, text: t('sheet.alreadyEnrolled') }
      : { ok: true, text: t('sheet.notEnrolled') }
  );
  if (preview.activeElsewhere.length > 0) {
    rows.push({
      ok: true,
      text: t('sheet.elsewhere', { count: preview.activeElsewhere.length }),
      items: preview.activeElsewhere.map((e) => `${e.cohortCode} · ${e.programName}`),
    });
  }
  if (preview.accessUntil !== null && preview.blockers.length === 0) {
    rows.push({ ok: true, text: t('sheet.accessUntil', { date: preview.accessUntil }) });
  }

  return (
    <section
      aria-label={t('sheet.previewLabel')}
      className="bg-surface-sunken rounded-card space-y-2 px-4 py-3"
    >
      <p className="type-body-emphasis text-text">{person.name}</p>
      <ul className="space-y-1.5">
        {rows.map((row) => {
          const Icon = row.ok ? CircleCheck : CircleAlert;
          return (
            <li key={row.text} className="type-body flex items-start gap-2">
              <Icon
                aria-hidden
                className={cn(
                  'mt-0.5 size-4 shrink-0',
                  row.ok ? 'text-status-success-base' : 'text-status-warning-base'
                )}
              />
              <span className={cn('min-w-0', !row.ok && 'text-text-muted')}>
                {row.text}
                {row.href && row.link && (
                  <>
                    {' · '}
                    <Link href={row.href} className="text-text-link underline underline-offset-4">
                      {row.link}
                    </Link>
                  </>
                )}
                {row.items && (
                  <ul className="mt-1 space-y-0.5">
                    {row.items.map((item) => (
                      <li key={item} className="type-caption text-text-muted">
                        {item}
                      </li>
                    ))}
                  </ul>
                )}
              </span>
            </li>
          );
        })}
      </ul>
      {preview.warning !== null && <Alert severity="warning">{preview.warning}</Alert>}
    </section>
  );
}

export function EnrollmentActions({
  enrollmentId,
  name,
  status,
}: {
  enrollmentId: string;
  name: string;
  status: string;
}) {
  const t = useTranslations('enrollments');
  const { busy, error, send } = useEnrollmentMutation();
  const [mode, setMode] = useState<'none' | 'withdraw' | 'extend'>('none');
  const [reason, setReason] = useState('');
  const [accessUntil, setAccessUntil] = useState('');

  if (status === 'WITHDRAWN') {
    return <span className="type-caption text-text-muted">{t('alreadyWithdrawn')}</span>;
  }

  return (
    <div className="space-y-2">
      {error && <Alert severity="error">{error}</Alert>}

      {mode === 'none' && (
        <div className="flex gap-2">
          <Button
            variant="quiet"
            onClick={() => setMode('extend')}
            aria-label={t('extendNamed', { name })}
          >
            {t('extend')}
          </Button>
          <Button
            variant="quiet"
            onClick={() => setMode('withdraw')}
            aria-label={t('withdrawNamed', { name })}
          >
            {t('withdraw')}
          </Button>
        </div>
      )}

      {mode === 'withdraw' && (
        <form
          className="space-y-2"
          noValidate
          onSubmit={async (e) => {
            e.preventDefault();
            const ok = await send(
              `/api/cohorts/enrollments/${enrollmentId}`,
              'PATCH',
              { op: 'withdraw', reason },
              t('withdrawn')
            );
            if (ok) setMode('none');
          }}
        >
          <FormField
            label={t('reason')}
            name={`reason-${enrollmentId}`}
            required
            hint={t('reasonHint')}
          >
            <FormInput
              name={`reason-${enrollmentId}`}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </FormField>
          <div className="flex gap-2">
            <Button type="submit" loading={busy} disabled={reason.trim() === ''}>
              {t('confirmWithdraw')}
            </Button>
            <Button variant="quiet" onClick={() => setMode('none')} disabled={busy}>
              {t('cancel')}
            </Button>
          </div>
        </form>
      )}

      {mode === 'extend' && (
        <form
          className="space-y-2"
          noValidate
          onSubmit={async (e) => {
            e.preventDefault();
            const ok = await send(
              `/api/cohorts/enrollments/${enrollmentId}`,
              'PATCH',
              { op: 'extend', accessUntil },
              t('extended')
            );
            if (ok) setMode('none');
          }}
        >
          <FormField
            label={t('newAccessUntil')}
            name={`accessUntil-${enrollmentId}`}
            required
            hint={t('newAccessUntilHint')}
          >
            <FormInput
              name={`accessUntil-${enrollmentId}`}
              type="date"
              value={accessUntil}
              onChange={(e) => setAccessUntil(e.target.value)}
            />
          </FormField>
          <div className="flex gap-2">
            <Button type="submit" loading={busy} disabled={accessUntil === ''}>
              {t('confirmExtend')}
            </Button>
            <Button variant="quiet" onClick={() => setMode('none')} disabled={busy}>
              {t('cancel')}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
