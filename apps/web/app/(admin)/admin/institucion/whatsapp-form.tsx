'use client';

/**
 * WhatsApp de la institución (5/11): el número de Meta que recibe y quienes atienden la bandeja.
 * Aparte del formulario de la institución, con su propio botón, como el registro.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { FormField, FormInput } from '@/components/atoms/form-field';
import { Label } from '@/components/atoms/label';
import { Button } from '@/components/atoms/button';
import { Alert } from '@/components/atoms/alert';
import { PageSection } from '@/components/templates/page';
import { apiErrorText } from '@/lib/http/api-error-text';
import type { WhatsAppSettings } from '@/features/admin/server/whatsapp-settings.service';

export function WhatsAppForm({ settings }: { settings: WhatsAppSettings }) {
  const t = useTranslations('admin.whatsapp');
  const router = useRouter();
  const [phoneNumberId, setPhoneNumberId] = useState(settings.phoneNumberId ?? '');
  const [agents, setAgents] = useState(settings.agentPhones.map((p) => `+${p}`).join('\n'));
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ kind: 'ok' | 'error'; message: string } | null>(null);

  const save = async () => {
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch('/api/admin/institution/whatsapp', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phoneNumberId: phoneNumberId.trim() === '' ? null : phoneNumberId.trim(),
          agentPhones: agents
            .split('\n')
            .map((line) => line.trim())
            .filter(Boolean),
        }),
      });
      if (!res.ok) {
        setResult({
          kind: 'error',
          message: apiErrorText(await res.json().catch(() => null), t('saveError')),
        });
        return;
      }
      setResult({ kind: 'ok', message: t('saved') });
      router.refresh();
    } catch {
      setResult({ kind: 'error', message: t('saveError') });
    } finally {
      setBusy(false);
    }
  };

  return (
    <PageSection id="whatsapp" title={t('title')} description={t('hint')} card>
      <div className="max-w-reading space-y-4">
        {result && (
          <Alert severity={result.kind === 'ok' ? 'success' : 'error'}>{result.message}</Alert>
        )}
        <FormField label={t('phoneNumberId')} name="phoneNumberId" hint={t('phoneNumberIdHint')}>
          <FormInput
            name="phoneNumberId"
            inputMode="numeric"
            value={phoneNumberId}
            onChange={(e) => setPhoneNumberId(e.target.value)}
          />
        </FormField>
        <div className="space-y-1.5">
          <Label htmlFor="whatsapp-agents">{t('agents')}</Label>
          <textarea
            id="whatsapp-agents"
            name="agentPhones"
            rows={4}
            value={agents}
            onChange={(e) => setAgents(e.target.value)}
            aria-describedby="whatsapp-agents-hint"
            className="rounded-control border-border bg-surface-sunken text-text type-body w-full border px-3 py-2"
          />
          <p id="whatsapp-agents-hint" className="type-caption text-text-muted m-0">
            {t('agentsHint')}
          </p>
        </div>
        <Button type="button" variant="secondary" loading={busy} onClick={save}>
          {t('save')}
        </Button>
      </div>
    </PageSection>
  );
}
