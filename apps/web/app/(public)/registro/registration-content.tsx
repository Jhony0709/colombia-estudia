'use client';

/**
 * El registro (Fase B, 23/9; conversacional desde el 6/10, experiencia-colombia-estudia §4):
 * una pregunta a la vez con `ConversationalForm`, un solo envío al final y una pantalla de
 * éxito que dice qué pasó con la matrícula: es lo que la persona quiere saber al terminar.
 *
 * La fecha de nacimiento se pide aunque el plan no la listaba: sin ella no hay matrícula
 * (`Person.birthDate` es obligatoria para matricular) y decide si la persona firma la
 * política o si la firma su acudiente (Ley 1581). Con menos de 18, la casilla de la
 * política no se enseña y se dice que operación completará la matrícula.
 */

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useFormatter, useTranslations } from 'next-intl';
import { FormField, FormInput } from '@/components/atoms/form-field';
import { FormPasswordInput } from '@/components/atoms/password-input';
import { Button } from '@/components/atoms/button';
import { Alert } from '@/components/atoms/alert';
import {
  ConversationalForm,
  type ConversationStep,
} from '@/components/organisms/conversational-form';
import { apiErrorText } from '@/lib/http/api-error-text';
import { HOME_AFTER_LOGIN } from '@/lib/authz/routes';

type Enrollment =
  | { status: 'ENROLLED'; cohortCode: string; cohortName: string; free: boolean }
  | { status: 'NO_INTRO_COHORT' }
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

/** Qué paso pregunta cada campo que puede rechazar el servidor. */
const STEP_OF_FIELD: Record<string, string> = {
  givenName: 'name',
  familyName: 'name',
  birthDate: 'birthDate',
  email: 'email',
  phone: 'phone',
  password: 'password',
  acceptsDataPolicy: 'policy',
};

/**
 * La pregunta a la que vuelve un rechazo del servidor (`registration.service.ts`): por campo
 * cuando zod dice cuál, y por código cuando es una regla del servicio (correo ya registrado,
 * política sin aceptar, fecha imposible, contraseña filtrada).
 */
function stepOfError(
  error: { code?: string; message?: string; details?: Record<string, unknown> } | undefined
): string | null {
  const field = Object.keys(error?.details ?? {}).find((k) => STEP_OF_FIELD[k]);
  if (field) return STEP_OF_FIELD[field]!;
  if (error?.code === 'CONFLICT') return 'email';
  if (error?.code === 'CONSENT_REQUIRED') return 'policy';
  if (error?.code === 'VALIDATION_ERROR') {
    if (/contraseña/i.test(error.message ?? '')) return 'password';
    if (/fecha/i.test(error.message ?? '')) return 'birthDate';
  }
  return null;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function RegistrationContent({
  institutionName,
  dataPolicyUrl,
}: {
  institutionName: string;
  dataPolicyUrl: string | null;
}) {
  const t = useTranslations('registration');
  const format = useFormatter();
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
  const [jumpTo, setJumpTo] = useState<{ id: string; token: number; error: string } | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (done) headingRef.current?.focus();
  }, [done]);

  const set = (key: keyof typeof values, value: string) =>
    setValues((prev) => ({ ...prev, [key]: value }));

  const age = ageFromIso(values.birthDate);
  const isMinor = age !== null && age < 18;
  const given = values.givenName.trim();

  const onSubmit = async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...values, acceptsDataPolicy: isMinor ? undefined : acceptsPolicy }),
      });
      const payload = (await res.json().catch(() => null)) as {
        data?: Done;
        error?: { code?: string; message?: string; details?: Record<string, unknown> };
      } | null;
      if (!res.ok || !payload?.data) {
        // Un dato rechazado vuelve a su pregunta con el motivo de ese campo («La contraseña debe
        // tener al menos 12 caracteres»), no con la lista de `apiErrorText`, que lleva el nombre
        // interno del campo; lo demás se dice junto al botón.
        const step = stepOfError(payload?.error);
        const fieldMessage = Object.entries(payload?.error?.details ?? {})
          .filter(([key]) => STEP_OF_FIELD[key] === step)
          .map(([, value]) => (Array.isArray(value) ? value[0] : value))
          .find((value): value is string => typeof value === 'string' && value.trim() !== '');
        const message = fieldMessage ?? apiErrorText(payload, t('genericError'));
        if (step) {
          setJumpTo((prev) => ({ id: step, token: (prev?.token ?? 0) + 1, error: message }));
        } else {
          setError(message);
        }
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
      <section className="motion-enter space-y-4">
        <h1 ref={headingRef} tabIndex={-1} className="auth-title text-text outline-none">
          {t('success')}
        </h1>
        {e.status === 'ENROLLED' ? (
          <Alert severity="success">
            {t(e.free ? 'enrolledFree' : 'enrolled', { code: e.cohortCode, name: e.cohortName })}
          </Alert>
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

  const sections = {
    you: t('convo.sections.you'),
    contact: t('convo.sections.contact'),
    account: t('convo.sections.account'),
    ready: t('convo.sections.ready'),
  };

  const steps: ConversationStep[] = [
    {
      id: 'name',
      section: sections.you,
      prompt: t('convo.name'),
      answer: `${values.givenName.trim()} ${values.familyName.trim()}`,
      validate: () =>
        !values.givenName.trim() || !values.familyName.trim() ? t('convo.nameMissing') : null,
      field: () => (
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
      ),
    },
    {
      id: 'birthDate',
      section: sections.you,
      prompt: t('convo.birthDate', { name: given }),
      answer:
        age !== null
          ? format.dateTime(new Date(`${values.birthDate}T00:00:00.000Z`), {
              dateStyle: 'long',
              timeZone: 'UTC',
            })
          : '',
      validate: () => (age === null || age < 0 || age > 120 ? t('convo.birthDateInvalid') : null),
      field: () => (
        <FormField label={t('birthDate')} name="birthDate" required hint={t('birthDateHint')}>
          <FormInput
            name="birthDate"
            type="date"
            autoComplete="bday"
            value={values.birthDate}
            onChange={(e) => set('birthDate', e.target.value)}
          />
        </FormField>
      ),
    },
    {
      id: 'email',
      section: sections.contact,
      prompt: t('convo.email'),
      answer: values.email.trim(),
      validate: () => (EMAIL.test(values.email.trim()) ? null : t('convo.emailInvalid')),
      field: () => (
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
      ),
    },
    {
      id: 'phone',
      section: sections.contact,
      prompt: t('convo.phone'),
      answer: values.phone.trim() || t('convo.noPhone'),
      secondary: { label: t('convo.skip'), onSelect: () => set('phone', '') },
      field: () => (
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
      ),
    },
    {
      id: 'password',
      section: sections.account,
      prompt: t('convo.password'),
      answer: '••••••••',
      validate: () => (values.password.length >= MIN_PASSWORD ? null : t('passwordHint')),
      field: () => (
        <>
          {/* El gestor de contraseñas guarda la pareja: el correo va aquí aunque ya se respondió. */}
          <input
            type="email"
            name="username"
            autoComplete="username"
            value={values.email}
            readOnly
            hidden
          />
          <FormField label={t('password')} name="password" required hint={t('passwordHint')}>
            <FormPasswordInput
              name="password"
              autoComplete="new-password"
              value={values.password}
              onChange={(e) => set('password', e.target.value)}
              minLength={MIN_PASSWORD}
            />
          </FormField>
        </>
      ),
    },
    ...(isMinor
      ? []
      : [
          {
            id: 'policy',
            section: sections.account,
            prompt: t('convo.policy'),
            answer: t('acceptPolicy'),
            kind: 'choice' as const,
            field: ({ advance }: { advance: () => void }) => (
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  type="button"
                  onClick={() => {
                    setAcceptsPolicy(true);
                    advance();
                  }}
                >
                  {t('convo.accept')}
                </Button>
                {dataPolicyUrl && (
                  <a
                    href={dataPolicyUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="type-body text-text-link min-h-touch inline-flex items-center underline"
                  >
                    {t('viewPolicy')}
                  </a>
                )}
              </div>
            ),
          },
        ]),
  ];

  return (
    <section className="space-y-6">
      <div className="space-y-2">
        <h1 className="auth-title text-text">{t('title')}</h1>
        <p className="type-body text-text-muted">
          {t('subtitle', { institution: institutionName })}
        </p>
      </div>

      <ConversationalForm
        steps={steps}
        jumpTo={jumpTo}
        onSubmit={() => void onSubmit()}
        finale={{
          section: sections.ready,
          prompt: t('convo.ready', { name: given }),
          content: (
            <div className="space-y-4">
              {/* La pareja para el gestor de contraseñas al enviar: los pasos ya no están montados. */}
              <input
                type="email"
                name="username"
                autoComplete="username"
                value={values.email}
                readOnly
                hidden
              />
              <input
                type="password"
                name="password"
                autoComplete="new-password"
                value={values.password}
                readOnly
                hidden
              />
              {isMinor && <Alert severity="info">{t('minorNotice')}</Alert>}
              {error && <Alert severity="error">{error}</Alert>}
              <Button type="submit" loading={loading} className="w-full">
                {t('submit')}
              </Button>
            </div>
          ),
        }}
      />

      <p className="type-body text-text-muted">
        {t('haveAccount')}{' '}
        <Link href="/auth/login" className="text-text-link underline">
          {t('login')}
        </Link>
      </p>
    </section>
  );
}
