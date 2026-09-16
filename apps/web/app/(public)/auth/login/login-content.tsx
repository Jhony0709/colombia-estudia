/**
 * Login content component.
 * SSOT: plan/03-identidad-y-acceso.md §Login
 *
 * Password-first (Jhonny, 16/9): one form for email + password; the magic link is a
 * secondary text action that reuses the email field.
 * autocomplete attributes for password managers.
 */

'use client';

import { useState, useRef, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { FormField, FormInput } from '@/components/atoms/form-field';
import { FormPasswordInput } from '@/components/atoms/password-input';
import { Button } from '@/components/atoms/button';
import { Alert } from '@/components/atoms/alert';

export default function LoginContent() {
  const t = useTranslations('auth');
  const searchParams = useSearchParams();
  const callbackError = searchParams.get('error') === 'callback';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState<'password' | 'magic' | null>(null);
  const [error, setError] = useState<string | null>(callbackError ? t('callbackError') : null);
  const [magicLinkSent, setMagicLinkSent] = useState(false);

  const headingRef = useRef<HTMLHeadingElement>(null);
  const alertRef = useRef<HTMLDivElement>(null);

  // Focus heading on mount
  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  // Focus alert when error appears
  useEffect(() => {
    if (error) {
      alertRef.current?.focus();
    }
  }, [error]);

  const next = searchParams.get('next') || '/';

  async function handlePasswordLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading('password');

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, next }),
      });

      if (res.ok) {
        const data = (await res.json()) as { data: { next: string } };
        // Full navigation so server components re-render with the new session cookies.
        window.location.assign(data.data.next);
        return;
      }

      const data = await res.json();
      setError(data.error?.message || t('invalidCredentials'));
    } catch {
      setError(t('invalidCredentials'));
    } finally {
      setLoading(null);
    }
  }

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault();
    if (!email) {
      setError(t('emailRequired'));
      return;
    }

    setError(null);
    setLoading('magic');

    try {
      const res = await fetch('/api/auth/magic-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, next }),
      });

      if (res.ok) {
        setMagicLinkSent(true);
      } else {
        const data = await res.json();
        setError(data.error?.message || t('magicLinkError'));
      }
    } catch {
      setError(t('magicLinkError'));
    } finally {
      setLoading(null);
    }
  }

  if (magicLinkSent) {
    return (
      <section>
        <h1
          ref={headingRef}
          tabIndex={-1}
          className="type-heading text-text text-center outline-none"
        >
          {t('magicLink')}
        </h1>
        <Alert severity="success">{t('magicLinkSent')}</Alert>
        <button
          type="button"
          onClick={() => setMagicLinkSent(false)}
          className="type-body text-accent-base hover:underline"
        >
          {t('backToLogin')}
        </button>
      </section>
    );
  }

  return (
    <section>
      <h1
        ref={headingRef}
        tabIndex={-1}
        className="type-heading text-text text-center outline-none"
      >
        {t('login')}
      </h1>

      {error && (
        <div ref={alertRef} tabIndex={-1} className="outline-none">
          <Alert severity="error">{error}</Alert>
        </div>
      )}

      <form onSubmit={handlePasswordLogin} className="space-y-4">
        <FormField label={t('email')} name="email" required>
          <FormInput
            name="email"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </FormField>

        <FormField label={t('password')} name="password" required>
          <FormPasswordInput
            name="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </FormField>

        <div className="pt-2">
          <Button type="submit" loading={loading === 'password'} className="w-full">
            {t('submit')}
          </Button>
        </div>
      </form>

      {/* Password first (decision 16/9); the passwordless path is secondary, as text links. */}
      <div className="flex flex-col items-center gap-2 text-center">
        <Link href="/auth/recuperar" className="type-body text-accent-base hover:underline">
          {t('forgotPassword')}
        </Link>
        <p className="type-body text-text-muted">
          {t('orMagicLink')}{' '}
          <button
            type="button"
            onClick={handleMagicLink}
            disabled={loading !== null}
            className="type-body text-accent-base disabled:text-text-subtle hover:underline"
          >
            {t('magicLink')}
          </button>
        </p>
      </div>
    </section>
  );
}
