'use client';

/**
 * El formulario de registro (Fase B, 23/9). Un solo paso y una pantalla de éxito que dice
 * qué pasó con la matrícula: es lo que la persona quiere saber al terminar.
 *
 * La fecha de nacimiento se pide aunque el plan no la listaba: sin ella no hay matrícula
 * (`Person.birthDate` es obligatoria para matricular) y decide si la persona firma la
 * política o si la firma su acudiente (Ley 1581). Con menos de 18, la casilla de la
 * política no se enseña y se dice que operación completará la matrícula.
 */

import { useEffect, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { FormField, FormInput } from '@/components/atoms/form-field';
import { FormPasswordInput } from '@/components/atoms/password-input';
import { Button } from '@/components/atoms/button';
import { Alert } from '@/components/atoms/alert';
import { apiErrorText } from '@/lib/http/api-error-text';
import { HOME_AFTER_LOGIN } from '@/lib/authz/routes';

type Enrollment =
  | { status: 'ENROLLED'; cohortCode: string; cohortName: string }
  | { status: 'NO_INTRO_COHORT' }
  | { status: 'MINOR_NEEDS_GUARDIAN' }
  | { status: 'FAILED'; reason: string };

interface Done {
  next: string;
  isMinor: boolean;
  enrollment: Enrollment;
}

const MIN_PASSWORD = 12;

function ageFromIso(iso: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const birth = new Date(`${iso}T00:00:00.000Z`);
  if (Number.isNaN(birth.getTime())) return null;
  const now = new Date();
  let age = now.getUTCFullYear() - birth.getUTCFullYear();
  const beforeBirthday =
    now.getUTCMonth() < birth.getUTCMonth() ||
    (now.getUTCMonth() === birth.getUTCMonth() && now.getUTCDate() < birth.getUTCDate());
  if (beforeBirthday) age -= 1;
  return age;
}

export default function RegistrationContent({
  institutionName,
  dataPolicyUrl,
}: {
  institutionName: string;
  dataPolicyUrl: string | null;
}) {
  const t = useTranslations('registration');
  const [values, setValues] = useState({
    givenName: '',
    familyName: '',
    email: '',
    phone: '',
    birthDate: '',
    password: '',
  });
  const [acceptsPolicy, setAcceptsPolicy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<Done | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const alertRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, [done]);

  useEffect(() => {
    if (error) alertRef.current?.focus();
  }, [error]);

  const set = (key: keyof typeof values, value: string) =>
    setValues((prev) => ({ ...prev, [key]: value }));

  const age = ageFromIso(values.birthDate);
  const isMinor = age !== null && age < 18;
  const complete =
    values.givenName.trim() !== '' &&
    values.familyName.trim() !== '' &&
    values.email.trim() !== '' &&
    age !== null &&
    values.password.length >= MIN_PASSWORD &&
    (isMinor || acceptsPolicy);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...values, acceptsDataPolicy: isMinor ? undefined : acceptsPolicy }),
      });
      const payload = (await res.json().catch(() => null)) as { data?: Done } | null;
      if (!res.ok || !payload?.data) {
        setError(apiErrorText(payload, t('genericError')));
        return;
      }
      setDone(payload.data);
    } catch {
      setError(t('genericError'));
    } finally {
      setLoading(false);
    }
  };

  if (done !== null) {
    const e = done.enrollment;
    return (
      <section className="space-y-4">
        <h1 ref={headingRef} tabIndex={-1} className="type-heading text-text outline-none">
          {t('success')}
        </h1>
        {e.status === 'ENROLLED' ? (
          <Alert severity="success">
            {t('enrolled', { code: e.cohortCode, name: e.cohortName })}
          </Alert>
        ) : e.status === 'MINOR_NEEDS_GUARDIAN' ? (
          <Alert severity="info">{t('minorPending')}</Alert>
        ) : (
          <Alert severity="info">{t('operationsPending')}</Alert>
        )}
        <div className="pt-2">
          <Button asChild className="w-full">
            <a href={done.next === '/auth/login' ? '/auth/login' : HOME_AFTER_LOGIN}>
              {done.next === '/auth/login' ? t('goToLogin') : t('enter')}
            </a>
          </Button>
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <div className="space-y-2">
        <h1 ref={headingRef} tabIndex={-1} className="type-heading text-text outline-none">
          {t('title')}
        </h1>
        <p className="type-body text-text-muted">
          {t('subtitle', { institution: institutionName })}
        </p>
      </div>

      {error && (
        <div ref={alertRef} tabIndex={-1} className="outline-none">
          <Alert severity="error">{error}</Alert>
        </div>
      )}

      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label={t('givenName')} name="givenName" required>
            <FormInput
              name="givenName"
              autoComplete="given-name"
              value={values.givenName}
              onChange={(e) => set('givenName', e.target.value)}
            />
          </FormField>
          <FormField label={t('familyName')} name="familyName" required>
            <FormInput
              name="familyName"
              autoComplete="family-name"
              value={values.familyName}
              onChange={(e) => set('familyName', e.target.value)}
            />
          </FormField>
        </div>

        <FormField label={t('email')} name="email" required hint={t('emailHint')}>
          <FormInput
            name="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            value={values.email}
            onChange={(e) => set('email', e.target.value)}
          />
        </FormField>

        <FormField label={t('phone')} name="phone" hint={t('phoneHint')}>
          <FormInput
            name="phone"
            type="tel"
            autoComplete="tel"
            inputMode="tel"
            value={values.phone}
            onChange={(e) => set('phone', e.target.value)}
          />
        </FormField>

        <FormField label={t('birthDate')} name="birthDate" required hint={t('birthDateHint')}>
          <FormInput
            name="birthDate"
            type="date"
            autoComplete="bday"
            value={values.birthDate}
            onChange={(e) => set('birthDate', e.target.value)}
          />
        </FormField>

        <FormField label={t('password')} name="password" required hint={t('passwordHint')}>
          <FormPasswordInput
            name="password"
            autoComplete="new-password"
            value={values.password}
            onChange={(e) => set('password', e.target.value)}
            minLength={MIN_PASSWORD}
          />
        </FormField>

        {isMinor ? (
          <Alert severity="info">{t('minorNotice')}</Alert>
        ) : (
          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={acceptsPolicy}
              onChange={(e) => setAcceptsPolicy(e.target.checked)}
              className="border-border text-accent-base focus:ring-accent-base mt-1 h-5 w-5 rounded"
            />
            <span className="type-body text-text">
              {t('acceptPolicy')}{' '}
              {dataPolicyUrl && (
                <a
                  href={dataPolicyUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-text-link underline"
                >
                  {t('viewPolicy')}
                </a>
              )}
            </span>
          </label>
        )}

        <div className="pt-2">
          <Button type="submit" loading={loading} disabled={!complete} className="w-full">
            {t('submit')}
          </Button>
        </div>
      </form>

      <p className="type-body text-text-muted">
        {t('haveAccount')}{' '}
        <Link href="/auth/login" className="text-text-link underline">
          {t('login')}
        </Link>
      </p>
    </section>
  );
}
