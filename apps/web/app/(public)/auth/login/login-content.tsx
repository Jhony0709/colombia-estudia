/**
 * Login content component.
 * SSOT: plan/03-identidad-y-acceso.md §Login
 *
 * Password-first (Jhonny, 16/9): one form for email + password; the magic link is a
 * secondary text action that reuses the email field.
 * autocomplete attributes for password managers.
 *
 * ALBA (5/10, mockup de Jhonny): título y subtítulo, iconos dentro de los campos, «¿Olvidaste tu
 * contraseña?» bajo la contraseña, «Entrar →», una «o» y el enlace por correo como segunda
 * acción de igual peso visual que un botón secundario; «Crear cuenta» al final.
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
import { ArrowRight, LockKeyhole, Mail } from 'lucide-react';
import { HOME_AFTER_LOGIN } from '@/lib/authz/routes';

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

  const next = searchParams.get('next') || HOME_AFTER_LOGIN;

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
      <section className="space-y-6">
        <h1 ref={headingRef} tabIndex={-1} className="auth-title text-text outline-none">
          {t('magicLink')}
        </h1>
        <Alert severity="success">{t('magicLinkSent')}</Alert>
        <button
          type="button"
          onClick={() => setMagicLinkSent(false)}
          className="type-body text-text-link underline"
        >
          {t('backToLogin')}
        </button>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <div className="space-y-2">
        <h1 ref={headingRef} tabIndex={-1} className="auth-title text-text outline-none">
          {t('loginTitle')}
        </h1>
        <p className="type-body text-text-muted">{t('loginSubtitle')}</p>
      </div>

      {error && (
        <div ref={alertRef} tabIndex={-1} className="outline-none">
          <Alert severity="error">{error}</Alert>
        </div>
      )}

      <form onSubmit={handlePasswordLogin} className="space-y-4">
        <FormField label={t('email')} name="email" required>
          <div className="relative">
            <Mail
              aria-hidden="true"
              className="text-text-muted pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2"
            />
            <FormInput
              name="email"
              type="email"
              autoComplete="username"
              placeholder="tucorreo@ejemplo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="bg-surface-base pl-11"
            />
          </div>
        </FormField>

        <div className="space-y-2">
          <FormField label={t('password')} name="password" required>
            <div className="relative">
              <LockKeyhole
                aria-hidden="true"
                className="text-text-muted pointer-events-none absolute left-3 top-1/2 z-10 size-5 -translate-y-1/2"
              />
              <FormPasswordInput
                name="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="bg-surface-base pl-11"
              />
            </div>
          </FormField>
          <div className="text-right">
            <Link href="/auth/recuperar" className="type-caption text-text-link underline">
              {t('forgotPassword')}
            </Link>
          </div>
        </div>

        <Button type="submit" size="lg" loading={loading === 'password'} className="w-full">
          {t('enter')}
          <ArrowRight aria-hidden="true" className="size-5" />
        </Button>
      </form>

      {/* Sin contraseña (decisión 16/9: secundario): el mismo correo, un enlace al buzón. */}
      <div className="flex items-center gap-4" aria-hidden="true">
        <span className="bg-border-muted h-px flex-1" />
        <span className="type-caption text-text-muted">{t('or')}</span>
        <span className="bg-border-muted h-px flex-1" />
      </div>
      <Button
        type="button"
        variant="secondary"
        size="lg"
        onClick={handleMagicLink}
        disabled={loading !== null}
        loading={loading === 'magic'}
        className="w-full"
      >
        <Mail aria-hidden="true" className="size-5" />
        {t('magicLinkCta')}
      </Button>

      {/* Registro público (Fase B): quien llega sin cuenta se la crea. */}
      <p className="type-body text-text-muted text-center">
        {t('noAccount')}{' '}
        <Link href="/registro" className="text-text-link underline">
          {t('createAccount')}
        </Link>
      </p>
    </section>
  );
}
