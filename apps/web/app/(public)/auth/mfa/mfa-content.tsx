/**
 * MFA content component.
 * SSOT: plan/03-identidad-y-acceso.md §MFA para staff
 *
 * If no TOTP factor exists, shows QR code for enrollment.
 * If factor exists, shows code input for verification.
 */

'use client';

import { useState, useRef, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { sanitizeNextUrl } from '@/lib/authz/routes';
import { FormField, FormInput } from '@/components/atoms/form-field';
import { Button } from '@/components/atoms/button';
import { Alert } from '@/components/atoms/alert';

interface Factor {
  id: string;
  status: string;
  friendlyName: string | null;
}

export default function MfaContent() {
  const t = useTranslations('auth');
  const searchParams = useSearchParams();
  // `next` comes from the URL: sanitize or `//evil.com` becomes an open redirect.
  const next = sanitizeNextUrl(searchParams.get('next'));

  const [loading, setLoading] = useState(true);
  const [factors, setFactors] = useState<Factor[]>([]);
  const [enrolling, setEnrolling] = useState(false);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);

  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headingRef.current?.focus();
    loadFactors();
  }, []);

  async function loadFactors() {
    try {
      const res = await fetch('/api/auth/mfa/factors');
      if (res.ok) {
        const data = await res.json();
        setFactors(data.data.factors);
      }
    } catch {
      // Ignore errors, will show enrollment
    } finally {
      setLoading(false);
    }
  }

  async function handleEnroll() {
    setError(null);
    setEnrolling(true);

    try {
      const res = await fetch('/api/auth/mfa/enroll', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setQrCode(data.data.qr);
        setFactorId(data.data.factorId);
      } else {
        const data = await res.json();
        setError(data.error?.message || 'Error al configurar MFA');
      }
    } catch {
      setError('Error al configurar MFA');
    } finally {
      setEnrolling(false);
    }
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setVerifying(true);

    const fId = factorId || factors[0]?.id;
    if (!fId) {
      setError('No hay factor configurado');
      setVerifying(false);
      return;
    }

    try {
      const res = await fetch('/api/auth/mfa/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ factorId: fId, code }),
      });

      if (res.ok) {
        // Full navigation: server components must re-render with the aal2 session.
        window.location.assign(next);
      } else {
        const data = await res.json();
        setError(data.error?.message || 'Código inválido');
      }
    } catch {
      setError('Error al verificar');
    } finally {
      setVerifying(false);
    }
  }

  if (loading) {
    return (
      <section className="flex items-center justify-center">
        <div className="type-body text-text-muted animate-pulse">Cargando...</div>
      </section>
    );
  }

  const hasVerifiedFactor = factors.some((f) => f.status === 'verified');

  // Enrollment mode
  if (!hasVerifiedFactor && !qrCode) {
    return (
      <section>
        <h1
          ref={headingRef}
          tabIndex={-1}
          className="type-heading text-text text-center outline-none"
        >
          {t('mfa')}
        </h1>

        <p className="type-body text-text-muted text-center">
          Para continuar, configura la verificación en dos pasos.
        </p>

        {error && <Alert severity="error">{error}</Alert>}

        <Button onClick={handleEnroll} loading={enrolling} className="w-full">
          Configurar
        </Button>
      </section>
    );
  }

  // QR code display (enrollment)
  if (qrCode) {
    return (
      <section>
        <h1
          ref={headingRef}
          tabIndex={-1}
          className="type-heading text-text text-center outline-none"
        >
          {t('mfa')}
        </h1>

        <p className="type-body text-text-muted text-center">{t('mfaEnroll')}</p>

        <div className="flex justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qrCode} alt="Código QR para autenticación" className="h-48 w-48" />
        </div>

        {error && <Alert severity="error">{error}</Alert>}

        <form onSubmit={handleVerify} className="space-y-4">
          <FormField label={t('mfaCode')} name="code" required>
            <FormInput
              name="code"
              type="text"
              inputMode="numeric"
              pattern="[0-9]{6}"
              maxLength={6}
              autoComplete="one-time-code"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              required
            />
          </FormField>

          <Button type="submit" loading={verifying} className="w-full">
            {t('mfaVerify')}
          </Button>
        </form>
      </section>
    );
  }

  // Verification mode (factor exists)
  return (
    <section>
      <h1
        ref={headingRef}
        tabIndex={-1}
        className="type-heading text-text text-center outline-none"
      >
        {t('mfa')}
      </h1>

      <p className="type-body text-text-muted text-center">
        Ingresa el código de tu aplicación de autenticación.
      </p>

      {error && <Alert severity="error">{error}</Alert>}

      <form onSubmit={handleVerify} className="space-y-4">
        <FormField label={t('mfaCode')} name="code" required>
          <FormInput
            name="code"
            type="text"
            inputMode="numeric"
            pattern="[0-9]{6}"
            maxLength={6}
            autoComplete="one-time-code"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            required
          />
        </FormField>

        <Button type="submit" loading={verifying} className="w-full">
          {t('mfaVerify')}
        </Button>
      </form>
    </section>
  );
}
