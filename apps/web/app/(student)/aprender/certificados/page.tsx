/**
 * Las constancias del estudiante, con su enlace público.
 * SSOT: routes.md:38, plan/08 §6.
 *
 * Al abrirse, emite lo que ya toque (`issueDueCertificatesForEnrollment`): hasta que exista
 * el job diario (Fase 5), esta pantalla es quien mira si el módulo se acabó de completar.
 * Es idempotente, así que abrirla veinte veces no emite veinte constancias.
 *
 * Funciona con el acceso vencido: la guardia del área es por identidad, y `score.read.own`
 * sobrevive al vencimiento.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { getTranslations, getFormatter } from 'next-intl/server';
import { Award } from 'lucide-react';
import { getRequestContext } from '@/lib/authz/request-context';
import {
  listCertificatesForStudent,
  issueDueCertificatesForEnrollment,
} from '@/features/certificates/server/certificates.service';
import { listMyEnrollments } from '@/features/learn/server/cohort.service';
import { Page, PageHeader } from '@/components/templates/page';
import { EmptyState } from '@/components/molecules/empty-state';
import { Badge } from '@/components/atoms/badge';

export const metadata: Metadata = { title: 'Constancias' };

export default async function CertificatesPage() {
  const ctx = await getRequestContext();
  const t = await getTranslations('learn');
  const tc = await getTranslations('learn.certificates');
  const format = await getFormatter();

  if (!ctx.person) {
    return (
      <Page>
        <PageHeader title={tc('title')} />
        <EmptyState title={t('noSession')} description={t('noSessionHint')} />
      </Page>
    );
  }

  // Cada matrícula activa puede tener constancias pendientes de emitir (21/9): antes solo se
  // miraba la más reciente y las de otro programa no salían hasta que alguien las pidiera.
  const mine = await listMyEnrollments({
    institutionId: ctx.institution.id,
    personId: ctx.person.id,
  });
  for (const row of mine) {
    if (row.gate) continue;
    await issueDueCertificatesForEnrollment({
      institutionId: ctx.institution.id,
      enrollmentId: row.enrollmentId,
    });
  }

  const certificates = await listCertificatesForStudent({
    institutionId: ctx.institution.id,
    personId: ctx.person.id,
  });

  return (
    <Page>
      <PageHeader title={tc('title')} description={tc('description')} />

      {certificates.length === 0 ? (
        <EmptyState title={tc('empty')} description={tc('emptyHint')} />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {certificates.map((c) => (
            <li
              key={c.id}
              className="bg-surface-base border-border-muted rounded-card elevation-resting flex items-start gap-3 border p-5"
            >
              <span className="bg-status-success-muted text-status-success-base rounded-control inline-flex size-11 shrink-0 items-center justify-center">
                <Award className="size-5" aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1 space-y-1">
                <p className="type-caption text-text-muted m-0">
                  {c.kind === 'PROGRAM' ? tc('kindProgram') : tc('kindModule')}
                </p>
                <p className="type-body-emphasis m-0">
                  {c.kind === 'PROGRAM' ? c.programName : c.moduleName}
                </p>
                <p className="type-caption text-text-muted m-0">
                  {tc('issuedOn', {
                    date: format.dateTime(new Date(c.issuedAt), {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    }),
                  })}
                  {' · '}
                  <span className="font-mono">{c.code}</span>
                </p>
                {c.revokedAt ? (
                  <Badge variant="error">{tc('revoked')}</Badge>
                ) : (
                  <Link
                    href={`/certificado/${c.code}`}
                    className="text-text-link min-h-touch inline-flex items-center underline underline-offset-4"
                  >
                    {tc('openPublic')}
                  </Link>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Page>
  );
}
