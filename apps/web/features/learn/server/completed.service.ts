/**
 * Los cursos que la persona ya terminó (5/10), para «Cursos completados» en `/aprender`.
 *
 * Un curso es un componente (cliente, 25/9), y terminado es tener su constancia de módulo
 * vigente: la emite la regla del dominio (`issueDueCertificatesForEnrollment`), así que la
 * lista y la constancia no pueden discrepar. Cada uno lleva sus talleres, en el orden de su
 * primer tema, como los pinta la ruta.
 */

import 'server-only';

import { createTenantClient } from '@/lib/db/tenant';
import { COVER_URL_SECONDS, createReadUrls } from '@/lib/media/storage';

export interface CompletedWorkshop {
  id: string;
  name: string;
  lessonCount: number;
}

export interface CompletedCourse {
  certificateCode: string;
  issuedAt: string;
  moduleId: string;
  moduleName: string;
  programName: string;
  cohortCode: string;
  cohortName: string;
  coverUrl: string | null;
  workshops: CompletedWorkshop[];
}

export async function listCompletedCourses({
  institutionId,
  personId,
}: {
  institutionId: string;
  personId: string;
}): Promise<CompletedCourse[]> {
  const db = createTenantClient(institutionId);

  const rows = await db.certificate.findMany({
    where: {
      kind: 'MODULE',
      revokedAt: null,
      moduleId: { not: null },
      enrollment: { studentId: personId },
    },
    orderBy: { issuedAt: 'desc' },
    select: {
      code: true,
      issuedAt: true,
      enrollment: {
        select: {
          cohort: { select: { code: true, name: true, program: { select: { name: true } } } },
        },
      },
      module: {
        select: {
          id: true,
          name: true,
          coverMedia: { select: { providerRef: true, status: true } },
          lessons: {
            where: { archivedAt: null },
            orderBy: { position: 'asc' },
            select: { subject: { select: { id: true, name: true } } },
          },
        },
      },
    },
  });

  const courses = rows.flatMap((row) => (row.module ? [{ row, module: row.module }] : []));

  const covers = courses.map(({ module }) =>
    module.coverMedia?.status === 'READY' ? module.coverMedia.providerRef : null
  );
  const paths = covers.filter((path): path is string => path !== null);
  const signed = await createReadUrls(paths, COVER_URL_SECONDS);
  const urlOf = new Map(paths.map((path, index) => [path, signed[index] ?? null]));

  return courses.map(({ row, module }, index) => {
    const workshops: CompletedWorkshop[] = [];
    for (const lesson of module.lessons) {
      const known = workshops.find((w) => w.id === lesson.subject.id);
      if (known) known.lessonCount += 1;
      else workshops.push({ id: lesson.subject.id, name: lesson.subject.name, lessonCount: 1 });
    }
    const cover = covers[index];
    return {
      certificateCode: row.code,
      issuedAt: row.issuedAt.toISOString(),
      moduleId: module.id,
      moduleName: module.name,
      programName: row.enrollment.cohort.program.name,
      cohortCode: row.enrollment.cohort.code,
      cohortName: row.enrollment.cohort.name,
      coverUrl: cover ? (urlOf.get(cover) ?? null) : null,
      workshops,
    };
  });
}
