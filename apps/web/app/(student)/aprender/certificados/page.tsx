/**
 * Las constancias del estudiante, con su enlace público.
 * SSOT: routes.md:38, plan/08 §6.
 *
 * Rehecha el 8/10 (Jhonny: «mejora la UI/UX de /aprender/certificados, agrégale la marca»):
 * cada constancia es una miniatura del papel —logo, nombre, fecha y la onda de la marca— con
 * sus acciones (verla, copiar el enlace); las de programa primero. Debajo, «En camino»: lo que
 * falta en cada programa activo para su constancia.
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
import { ArrowRight, Award } from 'lucide-react';
import { getRequestContext } from '@/lib/authz/request-context';
import {
  listCertificatesForStudent,
  issueDueCertificatesForEnrollment,
  type CertificateView,
} from '@/features/certificates/server/certificates.service';
import { listMyEnrollments } from '@/features/learn/server/cohort.service';
import { Page, PageHeader, PageSection } from '@/components/templates/page';
import { EmptyState } from '@/components/molecules/empty-state';
import { CopyLinkButton } from '@/components/molecules/copy-link-button';
import { Badge } from '@/components/atoms/badge';
import { BrandLogo } from '@/components/atoms/brand-logo';
import { BrandWave } from '@/components/atoms/brand-wave';
import { Button } from '@/components/atoms/button';
import { ProgressBar } from '@/components/atoms/progress-bar';
import { cn } from '@/lib/utils';

export const metadata: Metadata = { title: 'Constancias' };

export default async function CertificatesPage() {
  const ctx = await getRequestContext();
  const [t, tc, format] = await Promise.all([
    getTranslations('learn'),
    getTranslations('learn.certificates'),
    getFormatter(),
  ]);

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
  // Las de programa primero: son la meta; dentro, la más reciente antes (ya viene así).
  const ordered = [
    ...certificates.filter((c) => c.kind === 'PROGRAM'),
    ...certificates.filter((c) => c.kind === 'MODULE'),
  ];
  // En camino: los programas activos con pasos por delante.
  const ongoing = mine.filter(
    (row) => !row.gate && row.progress.total > 0 && row.progress.completed < row.progress.total
  );
  // Como lo escribe la constancia pública (`getPublicCertificate`).
  const studentName = `${ctx.person.givenName} ${ctx.person.familyName}`;
  const issued = (iso: string) =>
    format.dateTime(new Date(iso), { day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <Page enter>
      <PageHeader title={tc('title')} description={tc('description')} />

      {ordered.length === 0 ? (
        <EmptyState
          icon={Award}
          title={tc('empty')}
          description={tc('emptyHint')}
          action={
            <Button asChild variant="secondary">
              <Link href="/aprender">{tc('goHome')}</Link>
            </Button>
          }
        />
      ) : (
        <ul className="motion-stagger m-0 grid list-none gap-5 p-0 md:grid-cols-2">
          {ordered.map((c) => (
            <li key={c.id} className="min-w-0">
              <CertificateCard certificate={c} studentName={studentName} issued={issued} />
            </li>
          ))}
        </ul>
      )}

      {ongoing.length > 0 && (
        <PageSection title={tc('ongoingTitle')} description={tc('ongoingHint')}>
          <ul className="m-0 grid list-none gap-4 p-0 md:grid-cols-2">
            {ongoing.map((row) => {
              const left = row.progress.total - row.progress.completed;
              const percent = Math.round((row.progress.completed / row.progress.total) * 100);
              return (
                <li
                  key={row.enrollmentId}
                  className="bg-surface-base border-border-muted rounded-card elevation-resting space-y-3 border p-4 sm:p-5"
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <h3 className="type-body-emphasis text-text m-0">{row.cohort.programName}</h3>
                    <span className="type-caption text-text-muted tabular-nums">{percent} %</span>
                  </div>
                  <ProgressBar
                    percent={percent}
                    label={tc('ongoingBar', { program: row.cohort.programName })}
                  />
                  <p className="type-caption text-text-muted m-0">
                    {tc('ongoingLeft', { count: left })}
                  </p>
                  <Link
                    href={`/aprender/curso/${row.enrollmentId}`}
                    className="type-label text-text-link min-h-touch inline-flex items-center gap-1.5 underline underline-offset-4"
                  >
                    {tc('ongoingCta')}
                    <span className="sr-only"> {row.cohort.programName}</span>
                    <ArrowRight aria-hidden className="size-4 shrink-0" />
                  </Link>
                </li>
              );
            })}
          </ul>
        </PageSection>
      )}
    </Page>
  );
}

/**
 * Una constancia como miniatura del papel (la misma marca que `/certificado/[code]`) y, al pie,
 * sus acciones. Revocada: se ve atenuada, con su estado y sin enlace.
 */
async function CertificateCard({
  certificate: c,
  studentName,
  issued,
}: {
  certificate: CertificateView;
  studentName: string;
  issued: (iso: string) => string;
}) {
  const tc = await getTranslations('learn.certificates');
  const revoked = c.revokedAt !== null;
  const headingId = `constancia-${c.id}`;
  const href = `/certificado/${c.code}`;

  return (
    <article
      aria-labelledby={headingId}
      className="bg-surface-base border-border-muted rounded-card elevation-resting flex h-full flex-col overflow-hidden border"
    >
      {/* La miniatura: claro siempre, como el papel. */}
      <div
        className={cn(
          'theme-light-scope bg-surface-base relative flex flex-1 flex-col overflow-hidden',
          revoked && 'opacity-60'
        )}
      >
        <BrandLogo
          variant="isotipo"
          alt=""
          className="pointer-events-none absolute -right-8 -top-8 h-36 opacity-5"
        />
        <div className="relative space-y-3 p-5 pb-3 text-center">
          <div className="flex items-center justify-between gap-3">
            <BrandLogo variant="horizontal" alt="" className="h-6" />
            <Badge variant={revoked ? 'error' : c.kind === 'PROGRAM' ? 'success' : 'info'}>
              {revoked
                ? tc('revoked')
                : c.kind === 'PROGRAM'
                  ? tc('kindProgram')
                  : tc('kindModule')}
            </Badge>
          </div>
          <p className="type-overline text-text-muted m-0 pt-2 uppercase">{tc('sheetTitle')}</p>
          <span aria-hidden className="bg-brand-yellow mx-auto block h-1 w-10 rounded-full" />
          <p className="type-subheading text-accent-base m-0">{studentName}</p>
          <h2 id={headingId} className="type-body-emphasis text-text m-0 text-balance">
            {c.kind === 'PROGRAM' ? c.programName : c.moduleName}
          </h2>
          {c.kind === 'MODULE' && (
            <p className="type-caption text-text-muted m-0">
              {tc('ofProgram', { program: c.programName })}
            </p>
          )}
          <p className="type-caption text-text-muted m-0">
            {tc('issuedOn', { date: issued(c.issuedAt) })}
          </p>
        </div>
        <BrandWave base="accent" className="mt-auto h-14" />
      </div>

      <div className="border-border-muted flex flex-wrap items-center justify-between gap-3 border-t p-4">
        <p className="type-caption text-text-muted m-0">
          {tc('code')} <span className="text-text font-mono">{c.code}</span>
        </p>
        {!revoked && (
          <div className="flex flex-wrap gap-2">
            <CopyLinkButton
              path={href}
              label={tc('copyLink')}
              copiedLabel={tc('copied')}
              variant="quiet"
            />
            <Button asChild variant="secondary">
              <Link href={href}>
                {tc('open')}
                <span className="sr-only">
                  {' '}
                  {c.kind === 'PROGRAM' ? c.programName : c.moduleName}
                </span>
              </Link>
            </Button>
          </div>
        )}
      </div>
    </article>
  );
}
