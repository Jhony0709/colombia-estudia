import 'server-only';

/**
 * El catálogo del estudiante (25/9): los cursos gratuitos abiertos que puede tomar, y la
 * inscripción por su cuenta.
 *
 * Jhonny, 25/9: «debería poder ver el curso en una sección en /aprender, una card con la
 * información del curso y un cta para inscribirme», y después, del cliente: «los componentes
 * son los cursos a tomar, por lo que se deben listar los cursos no los programas». El curso
 * que el estudiante elige es el componente (`Module`); el programa es la ruta que los ordena
 * y la cohorte, el grupo con fechas.
 *
 * Qué entra: cada componente sin archivar de un programa `FREE` con una cohorte `OPEN` en la
 * que la persona no está —en ningún estado: retirado o terminado, volver a entrar es de
 * operación—. Nada de pago: plan de pagos y, si es menor, acudiente, lo hace operación.
 *
 * Inscribirse en un curso es matricularse en esa cohorte entrando por ese componente
 * (`entryGrade` si el programa va por grados, `startsAtModule` si no; nada si es el primero),
 * por `enrollPerson` con la persona como actor: mismas reglas (menor sin acudiente solo en
 * gratuito, cohorte abierta, duplicado = 409) y misma auditoría. La ruta del estudiante
 * muestra ese componente y los que le siguen.
 */

import { createTenantClient } from '@/lib/db/tenant';
import { APIError } from '@/lib/core/errors';
import { createReadUrl } from '@/lib/media/storage';
import { enrollPerson } from '@/features/cohorts/server/enrollments.service';

export interface CatalogCourse {
  cohortId: string;
  moduleId: string;
  /** `COM-0001` */
  code: string;
  name: string;
  description: string | null;
  grade: number | null;
  /** La imagen de la tarjeta (25/9): URL de lectura firmada, 10 minutos; nula si no hay. */
  coverUrl: string | null;
  lessonCount: number;
  hasAssessment: boolean;
  programName: string;
  cohortCode: string;
  cohortName: string;
  /** `YYYY-MM-DD` */
  startsOn: string;
  endsOn: string;
}

const dateOnly = (d: Date) => d.toISOString().slice(0, 10);

const OPEN_FREE_WHERE = (personId: string) => ({
  status: 'OPEN' as const,
  program: { pricing: 'FREE' as const, archivedAt: null },
  enrollments: { none: { studentId: personId } },
});

export async function listOpenFreeCourses({
  institutionId,
  personId,
}: {
  institutionId: string;
  personId: string;
}): Promise<CatalogCourse[]> {
  const db = createTenantClient(institutionId);

  const cohorts = await db.cohort.findMany({
    where: OPEN_FREE_WHERE(personId),
    orderBy: [{ startsOn: 'asc' }, { code: 'asc' }],
    select: {
      id: true,
      code: true,
      name: true,
      startsOn: true,
      endsOn: true,
      program: {
        select: {
          name: true,
          modules: {
            where: { archivedAt: null },
            orderBy: { position: 'asc' },
            select: {
              id: true,
              code: true,
              name: true,
              description: true,
              grade: true,
              coverMedia: { select: { providerRef: true, status: true } },
              _count: {
                select: {
                  lessons: { where: { archivedAt: null } },
                  assessments: { where: { archivedAt: null } },
                },
              },
            },
          },
        },
      },
    },
  });

  const rows = cohorts.flatMap((c) => c.program.modules.map((m) => ({ c, m })));
  return Promise.all(
    rows.map(async ({ c, m }) => ({
      cohortId: c.id,
      moduleId: m.id,
      code: m.code,
      name: m.name,
      description: m.description,
      grade: m.grade,
      coverUrl:
        m.coverMedia && m.coverMedia.status === 'READY'
          ? await createReadUrl(m.coverMedia.providerRef, { asAttachment: false })
          : null,
      lessonCount: m._count.lessons,
      hasAssessment: m._count.assessments > 0,
      programName: c.program.name,
      cohortCode: c.code,
      cohortName: c.name,
      startsOn: dateOnly(c.startsOn),
      endsOn: dateOnly(c.endsOn),
    }))
  );
}

/**
 * La persona se inscribe sola en un curso. Solo en lo que el catálogo enseña: cohorte abierta
 * y gratuita, componente de ese programa; lo demás es `NOT_FOUND`, no `FORBIDDEN`, porque
 * para esa persona ese curso no existe.
 */
export async function selfEnroll({
  institutionId,
  personId,
  cohortId,
  moduleId,
  now = new Date(),
}: {
  institutionId: string;
  personId: string;
  cohortId: string;
  moduleId: string;
  now?: Date;
}): Promise<{ enrollmentId: string }> {
  const db = createTenantClient(institutionId);

  const cohort = await db.cohort.findFirst({
    where: { id: cohortId, status: 'OPEN', program: { pricing: 'FREE', archivedAt: null } },
    select: {
      program: {
        select: {
          modules: {
            where: { archivedAt: null },
            orderBy: { position: 'asc' },
            select: { id: true, position: true, grade: true },
          },
        },
      },
    },
  });
  const component = cohort?.program.modules.find((m) => m.id === moduleId);
  if (!cohort || !component) {
    throw new APIError('Este curso no está abierto para inscribirse', 'NOT_FOUND');
  }

  // `enrollPerson` busca por correo o documento, no por id: se le da el de la persona.
  const person = await db.person.findFirst({
    where: { id: personId, anonymizedAt: null },
    select: { email: true, documentNumber: true },
  });
  const handle = person?.email ?? person?.documentNumber ?? null;
  if (handle === null) {
    throw new APIError('Tu cuenta no tiene correo ni documento; escríbenos', 'VALIDATION_ERROR');
  }

  // Por dónde entra: el primero de la ruta no necesita decirlo; en un programa con grados la
  // entrada es el grado (enrollments.service.ts), en uno sin grados, la posición.
  const first = cohort.program.modules[0]!;
  const entry =
    component.id === first.id
      ? {}
      : component.grade !== null
        ? { entryGrade: component.grade }
        : { startsAtModule: component.position };

  const { enrollmentId } = await enrollPerson({
    institutionId,
    actorId: personId,
    cohortId,
    personHandle: handle,
    ...entry,
    now,
  });
  return { enrollmentId };
}
