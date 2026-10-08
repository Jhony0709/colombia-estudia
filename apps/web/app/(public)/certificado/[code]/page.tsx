/**
 * `/certificado/[code]`: verificación pública de una constancia.
 * SSOT: routes.md (§Público), plan/08 §6, endpoints.md:49.
 *
 * Sin sesión. Enseña nombre, programa o componente, institución, fecha y estado (vigente o
 * revocada) y **nada más**: ni documento, ni correo, ni cohorte.
 *
 * Rehecha el 8/10 (Jhonny: «mejora la UI/UX de la constancia, agrégale la marca»): arriba, para
 * quien la verifica, si es auténtica y vigente; debajo, la constancia como documento de la
 * marca —logo, onda y sello—, siempre en claro (es un papel). «Descargar PDF» es imprimir: la
 * hoja sale sola en A4 apaisado (`globals.css`, `.certificate-sheet`).
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { getFormatter, getTranslations } from 'next-intl/server';
import { CircleX, ShieldAlert, ShieldCheck } from 'lucide-react';
import { getPublicCertificate } from '@/features/certificates/server/certificates.service';
import { BrandLogo } from '@/components/atoms/brand-logo';
import { BrandWave } from '@/components/atoms/brand-wave';
import { CopyLinkButton } from '@/components/molecules/copy-link-button';
import { cn } from '@/lib/utils';
import { PrintButton } from './print-button';

export const metadata: Metadata = { title: 'Verificar constancia' };

export default async function PublicCertificatePage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const t = await getTranslations('certificatePublic');
  const format = await getFormatter();
  const c = await getPublicCertificate(code);
  const valid = c?.status === 'VALID';
  const issued = c
    ? format.dateTime(new Date(c.issuedAt), { day: 'numeric', month: 'long', year: 'numeric' })
    : '';

  return (
    // La web pública es clara (19/9), y una constancia es un papel: claro con cualquier tema.
    <div className="theme-light-scope bg-surface-sunken min-h-screen print:min-h-0 print:bg-transparent">
      <div className="max-w-content mx-auto space-y-6 px-4 py-8 sm:px-6 sm:py-12 print:max-w-none print:p-0">
        <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
          <Link href="/" className="min-h-touch inline-flex items-center">
            <BrandLogo variant="horizontal" className="h-8" />
          </Link>
          {valid && (
            <div className="flex flex-wrap gap-2">
              <CopyLinkButton
                path={`/certificado/${c.code}`}
                label={t('copyLink')}
                copiedLabel={t('copied')}
              />
              <PrintButton label={t('print')} />
            </div>
          )}
        </div>

        {!c ? (
          <section className="bg-surface-base border-border-muted rounded-card border p-6">
            <h1 className="type-heading m-0 inline-flex items-center gap-2">
              <CircleX className="text-status-error-base size-6" aria-hidden="true" />
              {t('notFoundTitle')}
            </h1>
            <p className="type-body text-text-muted mt-2">{t('notFoundBody', { code })}</p>
          </section>
        ) : (
          <>
            {/* Lo primero que busca quien verifica: si es auténtica y vigente. */}
            <p
              role="status"
              className={cn(
                'rounded-card type-body m-0 flex items-start gap-3 border p-4 print:hidden',
                valid
                  ? 'border-status-success-base bg-status-success-muted text-text'
                  : 'border-status-error-base bg-status-error-muted text-text'
              )}
            >
              {valid ? (
                <ShieldCheck aria-hidden className="text-status-success-base size-5 shrink-0" />
              ) : (
                <ShieldAlert aria-hidden className="text-status-error-base size-5 shrink-0" />
              )}
              <span>
                <strong className="type-body-emphasis">
                  {valid ? t('verifiedTitle') : t('revoked')}
                </strong>{' '}
                {valid && t('verifiedBody', { institution: c.institutionName, date: issued })}
              </span>
            </p>

            <article
              aria-labelledby="constancia-titulo"
              className="certificate-sheet bg-surface-base border-border-muted rounded-card elevation-floating relative flex flex-col overflow-hidden border lg:aspect-[297/210]"
            >
              {/* El isotipo grande y tenue, como marca de agua. */}
              <BrandLogo
                variant="isotipo"
                alt=""
                className="pointer-events-none absolute -right-16 -top-16 h-72 opacity-5"
              />

              <div className="relative flex flex-1 flex-col gap-8 p-6 sm:p-10 lg:p-14">
                <header className="flex flex-wrap items-start justify-between gap-4">
                  <BrandLogo variant="horizontal" className="h-10 sm:h-12" />
                  <div className="text-right">
                    <p className="type-overline text-text-muted m-0 uppercase">{t('code')}</p>
                    <p className="type-body-emphasis text-text m-0 font-mono">{c.code}</p>
                  </div>
                </header>

                <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
                  <p className="type-overline text-text-muted m-0 uppercase">{c.institutionName}</p>
                  <h1 id="constancia-titulo" className="type-heading text-text m-0">
                    {t('title')}
                  </h1>
                  <span aria-hidden className="bg-brand-yellow h-1 w-16 rounded-full" />
                  <p className="type-body text-text-muted m-0 pt-2">{t('certifies')}</p>
                  <p className="type-display text-accent-base m-0 text-balance">{c.studentName}</p>
                  <p className="type-body text-text max-w-reading m-0 text-balance">
                    {c.kind === 'PROGRAM'
                      ? t('completedProgram', { program: c.programName })
                      : t('completedModule', {
                          module: c.moduleName ?? '',
                          program: c.programName,
                        })}
                  </p>
                </div>

                <footer className="grid items-end gap-6 sm:grid-cols-[1fr_auto_1fr]">
                  <dl className="m-0 grid gap-3">
                    <div>
                      <dt className="type-caption text-text-muted">{t('issuedAt')}</dt>
                      <dd className="type-body-emphasis m-0">{issued}</dd>
                    </div>
                    <div>
                      <dt className="type-caption text-text-muted">{t('status')}</dt>
                      <dd
                        className={cn(
                          'type-body-emphasis m-0',
                          valid ? 'text-status-success-base' : 'text-status-error-base'
                        )}
                      >
                        {valid ? t('valid') : t('revokedShort')}
                      </dd>
                    </div>
                  </dl>
                  {/* El sello: el isotipo en un círculo con el anillo del sol. */}
                  <span
                    aria-hidden
                    className="border-brand-yellow bg-surface-base hidden size-20 items-center justify-center rounded-full border-4 sm:inline-flex"
                  >
                    <BrandLogo variant="isotipo" alt="" className="h-11" />
                  </span>
                  <p className="type-caption text-text-muted m-0 sm:text-right">
                    {t('verifyAt', { code: c.code })}
                  </p>
                </footer>
                {/* Lo que no es, también en el papel impreso. */}
                <p className="type-caption text-text-muted max-w-reading m-0 self-center text-center">
                  {t('footer')}
                </p>
              </div>

              <BrandWave base="accent" className="h-14 sm:h-20" />
            </article>
          </>
        )}
      </div>
    </div>
  );
}
