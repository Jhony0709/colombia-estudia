'use client';

/**
 * Guardianship and off-platform consent, from the person's detail.
 * SSOT: plan/06-cohortes-y-personas.md:36-37, endpoints.md:75.
 */

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { FormField, FormInput, FormSelect } from '@/components/atoms/form-field';
import { Button } from '@/components/atoms/button';
import { Alert } from '@/components/atoms/alert';

function useMutation() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  async function send(url: string, body: unknown, okMessage: string): Promise<boolean> {
    setBusy(true);
    setError(null);
    setDone(null);
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const payload = await res.json();
      if (!res.ok) {
        setError(payload?.error?.message ?? 'No se pudo completar la acción.');
        return false;
      }
      setDone(okMessage);
      router.refresh();
      return true;
    } catch {
      setError('No se pudo completar la acción.');
      return false;
    } finally {
      setBusy(false);
    }
  }

  return { busy, error, done, send };
}

export function PersonGuardians({
  personId,
  guardians,
}: {
  personId: string;
  guardians: Array<{
    id: string;
    code: string;
    name: string;
    relationship: string;
    hasAccount: boolean;
  }>;
}) {
  const t = useTranslations('people');
  const { busy, error, done, send } = useMutation();
  const [handle, setHandle] = useState('');
  const [relationship, setRelationship] = useState('');
  const [financial, setFinancial] = useState(false);

  return (
    <div className="space-y-4">
      <div role="status" aria-live="polite">
        {error && <Alert severity="error">{error}</Alert>}
        {done && <Alert severity="success">{done}</Alert>}
      </div>

      {guardians.length === 0 ? (
        <p className="type-body text-text-muted">{t('noGuardians')}</p>
      ) : (
        <ul className="space-y-2">
          {guardians.map((g) => (
            <li key={g.id} className="flex flex-wrap items-center gap-2">
              <span className="type-body text-text flex-1">
                {t('guardianIs', { name: g.name, relationship: g.relationship })}
                {/* Fase C (23/9): el acudiente entra a /familia con su propia cuenta; la
                    invitación se manda desde su ficha, como a cualquier persona. */}
                <span className="type-caption text-text-muted block">
                  {g.hasAccount ? t('guardianHasAccount') : t('guardianNoAccount')}{' '}
                  <Link href={`/personas/${g.code}`} className="text-text-link underline">
                    {g.hasAccount ? t('guardianOpen') : t('guardianInvite')}
                  </Link>
                </span>
              </span>
              <Button
                variant="quiet"
                disabled={busy}
                aria-label={t('unlinkGuardianNamed', { name: g.name })}
                onClick={() =>
                  send(
                    `/api/people/${personId}/guardians`,
                    { op: 'unlink', guardianId: g.id },
                    t('guardianUnlinked')
                  )
                }
              >
                {t('unlink')}
              </Button>
            </li>
          ))}
        </ul>
      )}

      <form
        className="max-w-reading space-y-3"
        noValidate
        onSubmit={async (e) => {
          e.preventDefault();
          const ok = await send(
            `/api/people/${personId}/guardians`,
            {
              op: 'link',
              guardianHandle: handle,
              relationship,
              isFinancialResponsible: financial,
            },
            t('guardianLinked')
          );
          if (ok) {
            setHandle('');
            setRelationship('');
            setFinancial(false);
          }
        }}
      >
        <FormField
          label={t('guardianHandle')}
          name="guardianHandle"
          required
          hint={t('guardianHandleHint')}
        >
          <FormInput
            name="guardianHandle"
            value={handle}
            onChange={(e) => setHandle(e.target.value)}
          />
        </FormField>

        <FormField
          label={t('relationship')}
          name="relationship"
          required
          hint={t('relationshipHint')}
        >
          <FormInput
            name="relationship"
            value={relationship}
            onChange={(e) => setRelationship(e.target.value)}
          />
        </FormField>

        <div className="flex items-center gap-2">
          <input
            id="isFinancialResponsible"
            name="isFinancialResponsible"
            type="checkbox"
            checked={financial}
            onChange={(e) => setFinancial(e.target.checked)}
            className="size-5"
          />
          <label htmlFor="isFinancialResponsible" className="type-body text-text">
            {t('isFinancialResponsible')}
          </label>
        </div>

        <Button type="submit" variant="secondary" loading={busy}>
          {t('linkGuardian')}
        </Button>
      </form>
    </div>
  );
}

export function PersonConsent({ personId, isMinor }: { personId: string; isMinor: boolean }) {
  const t = useTranslations('people');
  const { busy, error, done, send } = useMutation();
  const [channel, setChannel] = useState<'PAPER' | 'EMAIL'>('PAPER');
  const [signedBy, setSignedBy] = useState('');

  return (
    <form
      className="max-w-reading space-y-3"
      noValidate
      onSubmit={async (e) => {
        e.preventDefault();
        const ok = await send(
          `/api/people/${personId}/consent`,
          { channel, signedByHandle: signedBy },
          t('consentRecorded')
        );
        if (ok) setSignedBy('');
      }}
    >
      <div role="status" aria-live="polite">
        {error && <Alert severity="error">{error}</Alert>}
        {done && <Alert severity="success">{done}</Alert>}
      </div>

      <div className="w-64">
        <FormField label={t('consentChannel')} name="channel" required>
          <FormSelect
            name="channel"
            value={channel}
            onChange={(e) => setChannel(e.target.value as 'PAPER' | 'EMAIL')}
          >
            <option value="PAPER">{t('channelPaper')}</option>
            <option value="EMAIL">{t('channelEmail')}</option>
          </FormSelect>
        </FormField>
      </div>

      <FormField
        label={t('signedBy')}
        name="signedByHandle"
        required={isMinor}
        hint={isMinor ? t('signedByMinorHint') : t('signedByAdultHint')}
      >
        <FormInput
          name="signedByHandle"
          value={signedBy}
          onChange={(e) => setSignedBy(e.target.value)}
        />
      </FormField>

      <p className="type-caption text-text-muted">{t('consentVersionNote')}</p>

      <Button type="submit" variant="secondary" loading={busy}>
        {t('recordConsent')}
      </Button>
    </form>
  );
}
