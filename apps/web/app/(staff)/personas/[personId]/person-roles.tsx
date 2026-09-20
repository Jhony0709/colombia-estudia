'use client';

/**
 * Role chips: add and revoke.
 * SSOT: plan/06-cohortes-y-personas.md:35 ("Roles como chips añadir/revocar (auditado)").
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { FormField, FormSelect } from '@/components/atoms/form-field';
import { Button } from '@/components/atoms/button';
import { Alert } from '@/components/atoms/alert';
import { ROLES } from '@/lib/people/catalogs';
import type { Role } from '@colombia-estudia/domain';

export function PersonRoles({ personId, roles }: { personId: string; roles: Role[] }) {
  const t = useTranslations('people');
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toAdd, setToAdd] = useState<string>('');

  const available = ROLES.filter((role) => !roles.includes(role));

  async function change(op: 'grant' | 'revoke', role: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/people/${personId}/roles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ op, role }),
      });
      if (!res.ok) {
        const payload = await res.json();
        setError(payload?.error?.message ?? t('roleError'));
        return;
      }
      setToAdd('');
      router.refresh();
    } catch {
      setError(t('roleError'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      {error && <Alert severity="error">{error}</Alert>}

      {roles.length === 0 ? (
        <p className="type-body text-text-muted">{t('noRoles')}</p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {roles.map((role) => (
            <li
              key={role}
              className="border-border rounded-control flex items-center gap-2 border px-3 py-1"
            >
              <span className="type-body text-text">{t(`roles.${role}`)}</span>
              <Button
                variant="quiet"
                disabled={busy}
                onClick={() => change('revoke', role)}
                aria-label={t('revokeRole', { role: t(`roles.${role}`) })}
              >
                {t('revoke')}
              </Button>
            </li>
          ))}
        </ul>
      )}

      {available.length > 0 && (
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (toAdd) void change('grant', toAdd);
          }}
        >
          <div className="w-64">
            <FormField label={t('addRole')} name="role">
              <FormSelect
                name="role"
                value={toAdd}
                onChange={(e) => setToAdd(e.target.value)}
                disabled={busy}
              >
                <option value="">{t('chooseRole')}</option>
                {available.map((role) => (
                  <option key={role} value={role}>
                    {t(`roles.${role}`)}
                  </option>
                ))}
              </FormSelect>
            </FormField>
          </div>
          <Button type="submit" variant="secondary" loading={busy} disabled={toAdd === ''}>
            {t('add')}
          </Button>
        </form>
      )}
    </div>
  );
}
