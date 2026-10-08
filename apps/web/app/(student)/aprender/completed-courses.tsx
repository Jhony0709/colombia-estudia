/**
 * «Cursos completados» en `/aprender` (5/10): cada componente terminado —lo que el estudiante
 * llama curso— con su portada, de qué programa y grupo viene, sus talleres y la constancia.
 * Misma tarjeta que «Cursos abiertos» (imagen arriba a sangre), para que lo hecho y lo que
 * sigue se lean como la misma cosa.
 *
 * Programa › grupo va como línea de contexto y no como `nav` de migas: no es dónde está la
 * página, es de dónde viene el curso. Los talleres son hermanos, no niveles: van en lista.
 *
 * Server Component. Sin cursos completados no se pinta nada.
 */

import Link from 'next/link';
import { getFormatter, getTranslations } from 'next-intl/server';
import { Award, ChevronRight, CircleCheck, Image as ImageIcon } from 'lucide-react';
import { PageSection } from '@/components/templates/page';
import type { CompletedCourse } from '@/features/learn/server/completed.service';

export async function CompletedCourses({ courses }: { courses: CompletedCourse[] }) {
  if (courses.length === 0) return null;
  const [t, format] = await Promise.all([getTranslations('learn.completed'), getFormatter()]);

  return (
    <PageSection id="cursos-completados" title={t('title')} description={t('hint')}>
      <ul className="motion-stagger m-0 grid list-none gap-4 p-0 sm:grid-cols-2 xl:grid-cols-3">
        {courses.map((course) => {
          const id = `completado-${course.certificateCode}`;
          return (
            <li key={course.certificateCode} className="min-w-0">
              <article
                aria-labelledby={id}
                className="bg-surface-base border-border-muted rounded-card elevation-resting flex h-full flex-col overflow-hidden border"
              >
                {/* Decorativa: el nombre va debajo (WCAG 1.1.1). Sin portada, el bloque hundido
                    de «Cursos abiertos». */}
                {course.coverUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- URL firmada de Storage.
                  <img
                    src={course.coverUrl}
                    alt=""
                    className="bg-surface-sunken aspect-[16/9] w-full object-cover"
                  />
                ) : (
                  <div
                    aria-hidden="true"
                    className="bg-surface-sunken text-text-subtle flex aspect-[16/9] w-full items-center justify-center"
                  >
                    <ImageIcon className="size-8" />
                  </div>
                )}

                <div className="flex flex-1 flex-col gap-3 p-4">
                  <div className="space-y-1">
                    <p className="type-caption text-text-muted m-0 flex min-w-0 items-center gap-1">
                      <span className="truncate">{course.programName}</span>
                      <ChevronRight aria-hidden className="size-3.5 shrink-0" />
                      <span className="shrink-0">{course.cohortCode}</span>
                    </p>
                    <h3 id={id} className="type-body-emphasis text-text m-0 line-clamp-2">
                      {course.moduleName}
                    </h3>
                    <p className="type-caption text-status-success-base m-0 inline-flex items-center gap-1.5">
                      <CircleCheck aria-hidden className="size-4 shrink-0" />
                      {t('finishedOn', {
                        date: format.dateTime(new Date(course.issuedAt), {
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric',
                        }),
                      })}
                    </p>
                  </div>

                  {course.workshops.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="type-overline text-text-muted m-0 uppercase">
                        {t('workshops', { count: course.workshops.length })}
                      </p>
                      <ul className="m-0 list-none space-y-1 p-0">
                        {course.workshops.map((workshop) => (
                          <li key={workshop.id} className="type-caption text-text flex gap-2">
                            <CircleCheck
                              aria-hidden
                              className="text-status-success-base mt-0.5 size-3.5 shrink-0"
                            />
                            <span className="min-w-0">
                              {workshop.name}
                              <span className="text-text-muted">
                                {' · '}
                                {t('lessons', { count: workshop.lessonCount })}
                              </span>
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <p className="mt-auto flex flex-wrap gap-x-4 gap-y-1 pt-1">
                    <Link
                      href={`/certificado/${course.certificateCode}`}
                      className="type-caption text-text-link min-h-touch inline-flex items-center gap-1.5 underline"
                    >
                      <Award aria-hidden className="size-4 shrink-0" />
                      {t('certificate')}
                    </Link>
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
