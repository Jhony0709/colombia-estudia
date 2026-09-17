/**
 * Password recovery page.
 * SSOT: plan/03-identidad-y-acceso.md §Recuperación
 *
 * Sends password reset email. Always shows success message.
 */

'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { FormField, FormInput } from '@/components/atoms/form-field';
import { Button } from '@/components/atoms/button';
import { Alert } from '@/components/atoms/alert';

export default function RecuperarPage() {
  const t = useTranslations('auth');

  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch('/api/auth/recover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      if (res.ok) {
        setSent(true);
      } else {
        // Should not happen since API always returns 200
        const data = await res.json();
        setError(data.error?.message || 'Error');
      }
    } catch {
      setError('Error al enviar el correo');
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <section>
        <h1
          ref={headingRef}
          tabIndex={-1}
          className="type-heading text-text text-center outline-none"
        >
          {t('recover')}
        </h1>
        <Alert severity="success">{t('recoverSuccess')}</Alert>
        <div className="text-center">
          <Link href="/auth/login" className="type-body text-accent-base hover:underline">
            {t('backToLogin')}
          </Link>
        </div>
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
        {t('recover')}
      </h1>

      <p className="type-body text-text-muted text-center">{t('recoverInstructions')}</p>

      {error && <Alert severity="error">{error}</Alert>}

      <form onSubmit={handleSubmit} className="space-y-4">
        <FormField label={t('email')} name="email" required>
          <FormInput
            name="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </FormField>

        <Button type="submit" loading={loading} className="w-full">
          {t('submit')}
        </Button>
      </form>

      <div className="text-center">
        <Link href="/auth/login" className="type-body text-accent-base hover:underline">
          {t('backToLogin')}
        </Link>
      </div>
    </section>
  );
}
