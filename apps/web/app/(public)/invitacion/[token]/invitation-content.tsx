/**
 * Invitation content component.
 * SSOT: plan/03-identidad-y-acceso.md §9c
 *
 * Multi-step flow: Welcome → Password → Consent (adult) → Success
 * Mobile-first, accessible.
 */

'use client';

import { useState, useRef, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { FormField } from '@/components/atoms/form-field';
import { FormPasswordInput } from '@/components/atoms/password-input';
import { Button } from '@/components/atoms/button';
import { Alert } from '@/components/atoms/alert';

interface Props {
  token: string;
  givenName: string;
  isMinor: boolean;
  institutionName: string;
  dataPolicyUrl: string | null;
}

type Step = 'welcome' | 'password' | 'consent' | 'success';

export default function InvitationContent({
  token,
  givenName,
  isMinor,
  institutionName,
  dataPolicyUrl,
}: Props) {
  const t = useTranslations('invitation');
  const [step, setStep] = useState<Step>('welcome');
  const [password, setPassword] = useState('');
  const [acceptsPolicy, setAcceptsPolicy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const headingRef = useRef<HTMLHeadingElement>(null);

  const nextRef = useRef<string>('/');
  const alertRef = useRef<HTMLDivElement>(null);

  // Focus heading on step change
  useEffect(() => {
    headingRef.current?.focus();
  }, [step]);

  // Focus alert when error appears
  useEffect(() => {
    if (error) {
      alertRef.current?.focus();
    }
  }, [error]);

  // Auto-redirect after success
  useEffect(() => {
    if (step === 'success') {
      const timer = setTimeout(() => {
        window.location.assign(nextRef.current);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [step]);

  const isPasswordValid = password.length >= 12;

  async function handleSubmit() {
    setError(null);
    setLoading(true);

    try {
      const res = await fetch(`/api/invitations/${token}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          password,
          acceptsDataPolicy: isMinor ? true : acceptsPolicy,
        }),
      });

      if (res.ok) {
        // The server started the session; `next` is `/` (or `/auth/login` if it could not).
        const data = (await res.json()) as { data: { next: string } };
        nextRef.current = data.data.next;
        setStep('success');
        return;
      }

      const data = await res.json();
      const code = data.error?.code;

      switch (code) {
        case 'CONSENT_REQUIRED':
          setError(t('consentRequired'));
          break;
        case 'ACCESS_EXPIRED':
          setError(t('expired'));
          break;
        case 'NOT_FOUND':
          setError(t('notFound'));
          break;
        default:
          setError(data.error?.message || t('genericError'));
      }
    } catch {
      setError(t('genericError'));
    } finally {
      setLoading(false);
    }
  }

  function handleContinueFromWelcome() {
    setStep('password');
  }

  function handleContinueFromPassword() {
    if (!isPasswordValid) return;
    // Skip consent step for minors
    if (isMinor) {
      handleSubmit();
    } else {
      setStep('consent');
    }
  }

  function handleContinueFromConsent() {
    if (!acceptsPolicy) return;
    handleSubmit();
  }

  // Welcome step
  if (step === 'welcome') {
    return (
      <section className="text-center">
        <h1 ref={headingRef} tabIndex={-1} className="type-heading text-text outline-none">
          {t('welcome')}
        </h1>
        <p className="type-body text-text-muted mt-4">
          {t('welcomeMessage', { name: givenName, institution: institutionName })}
        </p>
        <div className="pt-6">
          <Button onClick={handleContinueFromWelcome} className="w-full">
            {t('continue')}
          </Button>
        </div>
      </section>
    );
  }

  // Password step
  if (step === 'password') {
    return (
      <section>
        <h1
          ref={headingRef}
          tabIndex={-1}
          className="type-heading text-text text-center outline-none"
        >
          {t('createPassword')}
        </h1>

        {error && (
          <div ref={alertRef} tabIndex={-1} className="outline-none">
            <Alert severity="error">{error}</Alert>
          </div>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleContinueFromPassword();
          }}
          className="space-y-4"
        >
          <FormField label={t('password')} name="password" hint={t('passwordHint')} required>
            <FormPasswordInput
              name="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={12}
            />
          </FormField>

          {isMinor && <Alert severity="info">{t('minorNotice')}</Alert>}

          <div className="pt-2">
            <Button
              type="submit"
              loading={loading && isMinor}
              disabled={!isPasswordValid}
              className="w-full"
            >
              {isMinor ? t('createAccount') : t('continue')}
            </Button>
          </div>
        </form>
      </section>
    );
  }

  // Consent step (adults only)
  if (step === 'consent') {
    return (
      <section>
        <h1
          ref={headingRef}
          tabIndex={-1}
          className="type-heading text-text text-center outline-none"
        >
          {t('dataPolicy')}
        </h1>

        {error && (
          <div ref={alertRef} tabIndex={-1} className="outline-none">
            <Alert severity="error">{error}</Alert>
          </div>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleContinueFromConsent();
          }}
          className="space-y-4"
        >
          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={acceptsPolicy}
              onChange={(e) => setAcceptsPolicy(e.target.checked)}
              className="border-border-default text-accent-base focus:ring-accent-base mt-1 h-5 w-5 rounded"
            />
            <span className="type-body text-text">
              {t('acceptPolicy')}{' '}
              {dataPolicyUrl && (
                <a
                  href={dataPolicyUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent-base hover:underline"
                >
                  {t('viewPolicy')}
                </a>
              )}
            </span>
          </label>

          <div className="pt-2">
            <Button type="submit" loading={loading} disabled={!acceptsPolicy} className="w-full">
              {t('createAccount')}
            </Button>
          </div>
        </form>
      </section>
    );
  }

  // Success step
  return (
    <section className="text-center">
      <h1 ref={headingRef} tabIndex={-1} className="type-heading text-text outline-none">
        {t('success')}
      </h1>
      <Alert severity="success">{t('successMessage')}</Alert>
      <p className="type-body text-text-muted mt-4">{t('redirecting')}</p>
    </section>
  );
}
