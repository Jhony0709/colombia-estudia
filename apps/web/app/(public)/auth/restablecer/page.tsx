/**
 * Password reset page.
 * SSOT: plan/03-identidad-y-acceso.md §Recuperación
 *
 * Allows setting a new password. Session comes from recovery callback.
 */

'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { FormField } from '@/components/atoms/form-field';
import { FormPasswordInput } from '@/components/atoms/password-input';
import { Button } from '@/components/atoms/button';
import { Alert } from '@/components/atoms/alert';

export default function RestablecerPage() {
  const t = useTranslations('auth');
  const router = useRouter();

  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (password.length < 12) {
      setError(t('passwordHint'));
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const res = await fetch('/api/auth/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });

      if (res.ok) {
        setSuccess(true);
        // Redirect to login after short delay
        setTimeout(() => {
          router.push('/auth/login');
        }, 2000);
      } else {
        const data = await res.json();
        setError(data.error?.message || 'Error al actualizar la contraseña');
      }
    } catch {
      setError('Error al actualizar la contraseña');
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <section>
        <h1
          ref={headingRef}
          tabIndex={-1}
          className="type-heading text-text text-center outline-none"
        >
          {t('reset')}
        </h1>
        <Alert severity="success">{t('resetSuccess')}</Alert>
        <p className="type-body text-text-muted text-center">
          Serás redirigido al inicio de sesión...
        </p>
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
        {t('reset')}
      </h1>

      {error && <Alert severity="error">{error}</Alert>}

      <form onSubmit={handleSubmit} className="space-y-4">
        <FormField label={t('newPassword')} name="password" hint={t('passwordHint')} required>
          <FormPasswordInput
            name="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </FormField>

        <Button type="submit" loading={loading} className="w-full">
          {t('submit')}
        </Button>
      </form>
    </section>
  );
}
