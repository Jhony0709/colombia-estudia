/**
 * «Cursos completados» en `/aprender` (5/10): lo que la persona ya terminó, con la fecha y la
 * constancia del programa cuando existe. Al terminar, el panel enseña esto y los cursos
 * abiertos en vez de solo «Terminaste el programa».
 *
 * Server Component. Sin matrículas completadas no se pinta nada.
 */

import Link from 'next/link';
import { getFormatter, getTranslations } from 'next-intl/server';
import { Award, CircleCheck } from 'lucide-react';
import { PageSection } from '@/components/templates/page';
import type { MyEnrollment } from '@/features/learn/server/cohort.service';
import type { CertificateView } from '@/features/certificates/server/certificates.service';

export async function CompletedCourses({
  rows,
  certificates,
}: {
  rows: MyEnrollment[];
  certificates: CertificateView[];
}) {
  if (rows.length === 0) return null;
  const [t, format] = await Promise.all([getTranslations('learn.completed'), getFormatter()]);

  // La constancia de programa vigente de cada cohorte: da la fecha y el enlace verificable.
  const programCertificate = (cohortCode: string) =>
    certificates.find(
      (c) => c.kind === 'PROGRAM' && c.cohortCode === cohortCode && c.revokedAt === null
    ) ?? null;

  return (
    <PageSection id="cursos-completados" title={t('title')} description={t('hint')}>
      <ul className="m-0 grid list-none gap-4 p-0 sm:grid-cols-2">
        {rows.map((row) => {
          const certificate = programCertificate(row.cohort.code);
          const id = `completado-${row.enrollmentId}`;
          return (
            <li key={row.enrollmentId} className="min-w-0">
              <article
                aria-labelledby={id}
                className="bg-surface-base border-border-muted rounded-card elevation-resting flex h-full gap-3 border p-4"
              >
                <CircleCheck
                  aria-hidden
                  className="text-status-success-base mt-0.5 size-5 shrink-0"
                />
                <div className="min-w-0 flex-1 space-y-1">
                  <h3 id={id} className="type-body-emphasis text-text m-0">
                    {row.cohort.programName}
                  </h3>
                  <p className="type-caption text-text-muted m-0 truncate">
                    {row.cohort.code} · {row.cohort.name}
                  </p>
                  <p className="type-caption text-text m-0">
                    {certificate
                      ? t('finishedOn', {
                          date: format.dateTime(new Date(certificate.issuedAt), {
                            day: 'numeric',
                            month: 'long',
                            year: 'numeric',
                          }),
                        })
                      : t('finished')}
                  </p>
                  <p className="m-0 flex flex-wrap gap-x-4 gap-y-1 pt-1">
                    {certificate && (
                      <Link
                        href={`/certificado/${certificate.code}`}
                        className="type-caption text-text-link min-h-touch inline-flex items-center gap-1.5 underline"
                      >
                        <Award aria-hidden className="size-4 shrink-0" />
                        {t('certificate')}
                      </Link>
                    )}
                    <Link
                      href="/aprender/resultados"
                      className="type-caption text-text-link min-h-touch inline-flex items-center underline"
                    >
                      {t('results')}
                    </Link>
                  </p>
                </div>
              </article>
            </li>
          );
        })}
      </ul>
    </PageSection>
  );
}
