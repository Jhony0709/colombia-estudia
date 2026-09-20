/**
 * `/certificado/[code]`: verificación pública de una constancia.
 * SSOT: routes.md (§Público), plan/08 §6, endpoints.md:49.
 *
 * Sin sesión. Enseña nombre, programa o módulo, institución, fecha y estado (vigente o
 * revocada) y **nada más**: ni documento, ni correo, ni cohorte. La versión imprimible es
 * la misma página con `@media print` (`globals.css`): «Descargar PDF» es imprimir a PDF
 * desde el navegador, que lo hace cualquier celular sin instalar nada. El pie dice lo que
 * esta constancia no es.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { getFormatter, getTranslations } from 'next-intl/server';
import { Award, CircleX } from 'lucide-react';
import { getPublicCertificate } from '@/features/certificates/server/certificates.service';
import { BrandLogo } from '@/components/atoms/brand-logo';
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

  return (
    <div className="mx-auto max-w-[44rem] px-4 py-10 sm:px-6">
      <div className="mb-6 flex items-center justify-between gap-3 print:hidden">
        <Link href="/" className="min-h-touch inline-flex items-center">
          <BrandLogo variant="horizontal" alt="Colombia Estudia" className="h-8" />
        </Link>
        {c && c.status === 'VALID' && <PrintButton label={t('print')} />}
      </div>

      {!c ? (
        <section className="bg-surface-base border-border-muted rounded-card border p-6">
          <h1 className="type-heading inline-flex items-center gap-2">
            <CircleX className="text-status-error-base size-6" aria-hidden="true" />
            {t('notFoundTitle')}
          </h1>
          <p className="type-body text-text-muted mt-2">{t('notFoundBody', { code })}</p>
        </section>
      ) : (
        <article
          aria-labelledby="constancia-titulo"
          className="bg-surface-base border-border-muted rounded-card border p-6 sm:p-10"
        >
          <p className="type-overline text-text-muted uppercase">{c.institutionName}</p>
          <h1 id="constancia-titulo" className="type-display mt-2 inline-flex items-center gap-3">
            <Award className="text-status-success-base size-8 shrink-0" aria-hidden="true" />
            {t('title')}
          </h1>

          {c.status === 'REVOKED' && (
            <p
              role="status"
              className="border-status-error-base bg-status-error-muted type-body-emphasis rounded-control mt-4 border px-3 py-2"
            >
              {t('revoked')}
            </p>
          )}

          <p className="type-body mt-6">{t('certifies')}</p>
          <p className="type-heading mt-1">{c.studentName}</p>
          <p className="type-body mt-4">
            {c.kind === 'PROGRAM'
              ? t('completedProgram', { program: c.programName })
              : t('completedModule', { module: c.moduleName ?? '', program: c.programName })}
          </p>

          <dl className="mt-6 grid gap-x-8 gap-y-3 sm:grid-cols-2">
            <div>
              <dt className="type-caption text-text-muted">{t('issuedAt')}</dt>
              <dd className="type-body m-0">
                {format.dateTime(new Date(c.issuedAt), {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
              </dd>
            </div>
            <div>
              <dt className="type-caption text-text-muted">{t('code')}</dt>
              <dd className="type-body m-0 font-mono">{c.code}</dd>
            </div>
            <div>
              <dt className="type-caption text-text-muted">{t('status')}</dt>
              <dd className="type-body m-0">
                {c.status === 'VALID' ? t('valid') : t('revokedShort')}
              </dd>
            </div>
          </dl>

          <footer className="border-border-muted type-caption text-text-muted mt-8 border-t pt-4">
            <p>{t('footer')}</p>
            <p className="mt-1">{t('verifyAt', { code: c.code })}</p>
          </footer>
        </article>
      )}
    </div>
  );
}
