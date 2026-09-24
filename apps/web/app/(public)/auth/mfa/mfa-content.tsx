/**
 * La verificación en dos pasos del staff.
 * SSOT: plan/03-identidad-y-acceso.md §MFA para staff
 *
 * Rehecha el 23/9 (Jhonny: «mejora la UI del código de verificación y sus diferentes
 * escenarios»). Cuatro pantallas, cada una responde qué hago ahora:
 *
 * - **comprobando**: leyendo si ya hay un factor. Texto quieto con `role="status"`; sin
 *   `animate-pulse` en texto (motion-colombia-estudia: pulso en texto, prohibido).
 * - **antes de configurar**: qué es, qué necesitas (una aplicación de códigos) y un botón.
 * - **configurando**: tres pasos numerados —escanear el QR (o escribir la clave a mano,
 *   que la API ya devolvía y nadie usaba), escribir el código, verificar—.
 * - **verificar**: el campo de seis dígitos, grande y espaciado, con foco al entrar; el
 *   código malo vacía el campo, devuelve el foco y explica que cambia cada 30 s.
 *
 * Un solo campo y no seis casillas: se pega de un golpe, `autocomplete="one-time-code"`
 * funciona y un lector de pantalla lee un campo, no seis. La validación es nuestra, no la
 * burbuja nativa de `pattern`. Al verificar bien, se dice («Listo. Entrando…») mientras
 * llega la navegación completa. «Entrar con otra cuenta» saca a quien se equivocó de cuenta.
 */

'use client';

import { useState, useRef, useEffect, type FormEvent } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { sanitizeNextUrl } from '@/lib/authz/routes';
import { FormField, FormInput } from '@/components/atoms/form-field';
import { Button } from '@/components/atoms/button';
import { Alert } from '@/components/atoms/alert';
import { LogoutButton } from '@/components/organisms/logout-dialog';

interface Factor {
  id: string;
  status: string;
  friendlyName: string | null;
}

type Phase = 'checking' | 'intro' | 'enrolling' | 'verify';

/** Cada 30 s el código cambia; a partir del tercer fallo se dice por qué puede estar fallando. */
const HINT_AFTER_FAILURES = 3;

/*
  Tamaño de display con el token. Va con `!` porque el `type-body` base del Input se genera
  después en la hoja y gana a cualquier `text-*` de la misma especificidad (comprobado el 23/9:
  sin `!`, 16 px), monoespaciado y con aire entre dígitos; `block` porque un `<input>`
  es inline y se pegaba a la etiqueta; ancho justo para seis dígitos con su tracking.
*/
const CODE_INPUT_CLASS =
  'block w-[9.5em] max-w-full !text-[length:var(--type-display-size)] leading-none font-semibold font-mono tracking-[0.4em] text-center px-2 py-3';

export default function MfaContent() {
  const t = useTranslations('auth.mfaScreen');
  const searchParams = useSearchParams();
  // `next` comes from the URL: sanitize or `//evil.com` becomes an open redirect.
  const next = sanitizeNextUrl(searchParams.get('next'));

  const [phase, setPhase] = useState<Phase>('checking');
  const [factors, setFactors] = useState<Factor[]>([]);
  const [busy, setBusy] = useState(false);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [failures, setFailures] = useState(0);
  const [done, setDone] = useState(false);
  const [copied, setCopied] = useState(false);

  const headingRef = useRef<HTMLHeadingElement>(null);
  const codeRef = useRef<HTMLInputElement>(null);
  const alertRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    headingRef.current?.focus();
    void loadFactors();
  }, []);

  // El campo del código recibe el foco cuando aparece; el error, cuando aparece.
  useEffect(() => {
    if (phase === 'verify' || phase === 'enrolling') codeRef.current?.focus();
  }, [phase]);
  // El error de configurar recibe el foco (no hay campo); el de código lo recibe el campo,
  // que ya queda vacío, y el `role="alert"` lo anuncia solo.
  const focusAlert = () => window.requestAnimationFrame(() => alertRef.current?.focus());

  async function loadFactors() {
    try {
      const res = await fetch('/api/auth/mfa/factors');
      if (res.ok) {
        const data = await res.json();
        const list: Factor[] = data.data.factors;
        setFactors(list);
        setPhase(list.some((f) => f.status === 'verified') ? 'verify' : 'intro');
        return;
      }
    } catch {
      // Sin respuesta: se ofrece configurar; si ya había factor, verificar fallará y lo dirá.
    }
    setPhase('intro');
  }

  async function handleEnroll() {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch('/api/auth/mfa/enroll', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        setQrCode(data.data.qr);
        setSecret(data.data.secret ?? null);
        setFactorId(data.data.factorId);
        setPhase('enrolling');
      } else {
        setError(data.error?.message || t('errors.enroll'));
        focusAlert();
      }
    } catch {
      setError(t('errors.network'));
      focusAlert();
    } finally {
      setBusy(false);
    }
  }

  async function handleVerify(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setFieldError(null);

    if (code.length !== 6) {
      setFieldError(t('errors.sixDigits'));
      codeRef.current?.focus();
      return;
    }
    const fId = factorId || factors[0]?.id;
    if (!fId) {
      setError(t('errors.noFactor'));
      return;
    }

    setBusy(true);
    try {
      const res = await fetch('/api/auth/mfa/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ factorId: fId, code }),
      });
      if (res.ok) {
        setDone(true);
        // Navegación completa: los server components deben volver a pintarse con aal2.
        window.location.assign(next);
        return;
      }
      setFailures((n) => n + 1);
      setCode('');
      setError(res.status === 429 ? t('errors.tooMany') : t('errors.invalid'));
      window.requestAnimationFrame(() => codeRef.current?.focus());
    } catch {
      setError(t('errors.network'));
      window.requestAnimationFrame(() => codeRef.current?.focus());
    } finally {
      setBusy(false);
    }
  }

  async function copySecret() {
    if (!secret) return;
    try {
      await navigator.clipboard.writeText(secret);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Sin portapapeles: la clave sigue a la vista para copiarla a mano.
    }
  }

  // Funciones de render, no componentes internos: un componente definido dentro del render
  // se desmonta en cada tecla y el campo pierde el foco.
  const heading = (children: string) => (
    <h1 ref={headingRef} tabIndex={-1} className="type-heading text-text outline-none">
      {children}
    </h1>
  );

  const errorBlock = () =>
    error ? (
      <div ref={alertRef} tabIndex={-1} className="outline-none">
        <Alert severity="error">
          {error}
          {failures >= HINT_AFTER_FAILURES && (
            <span className="mt-1 block">{t('errors.clockHint')}</span>
          )}
        </Alert>
      </div>
    ) : null;

  const codeForm = (submitLabel: string) => (
    <form onSubmit={handleVerify} className="space-y-4" aria-busy={busy || done}>
      <FormField
        label={t('codeLabel')}
        name="code"
        hint={t('codeHint')}
        error={fieldError ?? undefined}
        required
      >
        <FormInput
          ref={codeRef}
          name="code"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          placeholder="000000"
          value={code}
          disabled={done}
          onChange={(e) => {
            setCode(e.target.value.replace(/\D/g, '').slice(0, 6));
            if (fieldError) setFieldError(null);
          }}
          className={CODE_INPUT_CLASS}
        />
      </FormField>
      {done ? (
        <p role="status" className="type-body text-text">
          {t('done')}
        </p>
      ) : (
        <Button type="submit" loading={busy} className="w-full">
          {submitLabel}
        </Button>
      )}
    </form>
  );

  const otherAccount = () => (
    <LogoutButton icon={false} className="type-body text-text-link min-h-touch underline">
      {t('otherAccount')}
    </LogoutButton>
  );

  if (phase === 'checking') {
    return (
      <section className="space-y-6">
        {heading(t('title'))}
        <p role="status" className="type-body text-text-muted">
          {t('checking')}
        </p>
      </section>
    );
  }

  if (phase === 'intro') {
    return (
      <section className="space-y-6">
        {heading(t('title'))}
        <p className="type-body text-text">{t('intro.why')}</p>
        <p className="type-body text-text-muted">{t('intro.need')}</p>
        {errorBlock()}
        <Button onClick={() => void handleEnroll()} loading={busy} className="w-full">
          {t('intro.start')}
        </Button>
        {otherAccount()}
      </section>
    );
  }

  if (phase === 'enrolling' && qrCode) {
    return (
      <section className="space-y-6">
        {heading(t('enroll.title'))}
        <ol className="space-y-5">
          <li className="space-y-3">
            <p className="type-body-emphasis text-text">{t('enroll.step1')}</p>
            <div className="flex justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={qrCode}
                alt={t('enroll.qrAlt')}
                className="border-border rounded-card h-48 w-48 border bg-white p-2"
              />
            </div>
            {secret && (
              <details className="type-caption text-text-muted">
                <summary className="min-h-touch inline-flex cursor-pointer items-center underline">
                  {t('enroll.manual')}
                </summary>
                <p className="mt-2">{t('enroll.manualHint')}</p>
                <p className="mt-2 flex flex-wrap items-center gap-2">
                  {/* En grupos de cuatro: se lee y se dicta; el botón copia la clave entera. */}
                  <code className="bg-surface-sunken rounded-control text-text select-all break-all px-2 py-1 font-mono tracking-[0.15em]">
                    {secret.match(/.{1,4}/g)?.join(' ') ?? secret}
                  </code>
                  <button
                    type="button"
                    onClick={() => void copySecret()}
                    className="text-text-link min-h-touch underline"
                  >
                    {copied ? t('enroll.copied') : t('enroll.copy')}
                  </button>
                </p>
              </details>
            )}
          </li>
          <li className="space-y-3">
            <p className="type-body-emphasis text-text">{t('enroll.step2')}</p>
            {errorBlock()}
            {codeForm(t('enroll.confirm'))}
          </li>
        </ol>
        {otherAccount()}
      </section>
    );
  }

  return (
    <section className="space-y-6">
      {heading(t('title'))}
      <p className="type-body text-text-muted">{t('verify.body')}</p>
      {errorBlock()}
      {codeForm(t('verify.submit'))}
      {otherAccount()}
    </section>
  );
}
