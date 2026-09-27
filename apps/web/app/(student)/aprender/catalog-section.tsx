/**
 * «Cursos abiertos» en `/aprender` (25/9): una tarjeta por curso —el componente, que es lo
 * que el estudiante toma (cliente, 25/9)— gratuito y abierto en el que la persona no está,
 * con lo que hay que saber antes de entrar: de qué va, grado, cuántos temas, si hay examen,
 * de qué programa y grupo, cuándo. Y el botón para inscribirse.
 *
 * Server Component: la lista viene de `listOpenFreeCourses`; solo el botón lleva JavaScript.
 * Sin cursos, no se pinta nada: el título «Cursos abiertos» sobre un vacío sería una promesa.
 */

import { getFormatter, getTranslations } from 'next-intl/server';
import { PageSection } from '@/components/templates/page';
import { Image as ImageIcon } from 'lucide-react';
import { Badge } from '@/components/atoms/badge';
import type { CatalogCourse } from '@/features/learn/server/catalog.service';
import { EnrollButton } from './enroll-button';

export async function CatalogSection({ courses }: { courses: CatalogCourse[] }) {
  if (courses.length === 0) return null;
  const [t, format] = await Promise.all([getTranslations('learn.catalog'), getFormatter()]);
  // `@db.Date` llega como medianoche UTC: se pinta en UTC para no retroceder un día en Bogotá.
  const day = (iso: string) =>
    format.dateTime(new Date(`${iso}T00:00:00.000Z`), {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC',
    });

  return (
    <PageSection id="cursos-abiertos" title={t('title')} description={t('hint')}>
      {/* Tarjeta de catálogo (27/9, referencia de Jhonny: Udemy): imagen arriba a sangre,
          nombre, programa · grupo, una línea de descripción y los datos en una fila; el botón
          al pie. Cuatro por fila en pantallas grandes, dos en tableta, una en el teléfono. */}
      <ul className="m-0 grid list-none gap-4 p-0 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {courses.map((course) => {
          const id = `curso-${course.cohortId}-${course.moduleId}`;
          return (
            <li key={id} className="min-w-0">
              <article
                aria-labelledby={id}
                className="bg-surface-base border-border-muted rounded-card elevation-resting flex h-full flex-col overflow-hidden border"
              >
                {/* Decorativa: el nombre del curso va debajo (WCAG 1.1.1). URL firmada de
                    Storage, sin dominio fijo para next/image. Sin imagen, un bloque hundido
                    del mismo tamaño para que la rejilla no baile. */}
                {course.coverUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
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
                <div className="flex flex-1 flex-col gap-2 p-4">
                  <h3 id={id} className="type-body-emphasis text-text m-0 line-clamp-2">
                    {course.name}
                  </h3>
                  <p className="type-caption text-text-muted m-0 truncate">
                    {course.programName} · {course.cohortName}
                  </p>
                  {course.description && (
                    <p className="type-caption text-text m-0 line-clamp-2">{course.description}</p>
                  )}
                  <p className="type-caption text-text-muted m-0 flex flex-wrap items-center gap-x-2 gap-y-1">
                    <Badge variant="success">{t('free')}</Badge>
                    <span>{t('lessonCount', { count: course.lessonCount })}</span>
                    {course.hasAssessment && <span>· {t('withAssessment')}</span>}
                    {course.grade !== null && <span>· {t('grade', { grade: course.grade })}</span>}
                  </p>
                  <p className="type-caption text-text-muted m-0">
                    {t('dateRange', { from: day(course.startsOn), to: day(course.endsOn) })}
                  </p>
                  <div className="mt-auto pt-2">
                    <EnrollButton
                      cohortId={course.cohortId}
                      moduleId={course.moduleId}
                      courseName={course.name}
                    />
                  </div>
                </div>
              </article>
            </li>
          );
        })}
      </ul>
    </PageSection>
  );
}
