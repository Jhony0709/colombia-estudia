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
 * Qué entra: cada componente sin archivar de un programa con una cohorte `OPEN` en la que la
 * persona no está —en ningún estado: retirado o terminado, volver a entrar es de operación—.
 * Desde el 6/10 también los de pago (Jhonny: «habrá cursos gratis y otros de pago»), con su
 * precio vigente; pero la matrícula de pago la sigue haciendo operación (plan de pagos y, si es
 * menor, acudiente): el estudiante la pide (`requestEnrollment`) y no se inscribe solo.
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
import { getCohortOutline } from './cohort.service';
import { currentPriceFor } from '@/features/billing/server/prices.service';
import { openEnrollRequest } from '@/features/requests/server/requests.service';

export interface CatalogWorkshop {
  name: string;
  lessonCount: number;
  activityCount: number;
  /** Tiene cuestionario de taller. */
  hasQuiz: boolean;
}

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
  /** Temas de lectura o vídeo (sin las actividades). */
  lessonCount: number;
  /** Actividades: temas que se completan con una entrega (7/10). */
  activityCount: number;
  /** Cuestionarios y exámenes del componente. */
  assessmentCount: number;
  hasAssessment: boolean;
  /** Los talleres (asignaturas) en el orden de la ruta (7/10): de qué va y cuánto trae cada uno. */
  workshops: CatalogWorkshop[];
  programId: string;
  programName: string;
  /** Dónde está en su programa (7/10): «Componente 1 de 2». */
  position: number;
  programModules: number;
  cohortCode: string;
  cohortName: string;
  /** `YYYY-MM-DD` */
  startsOn: string;
  endsOn: string;
  /** Gratuito: inscripción propia. De pago: se pide y la hace operación. */
  free: boolean;
  /** Ya está en esa cohorte (7/10): se marca en vez de ofrecer inscribirse. */
  enrollment: { id: string; status: 'ACTIVE' | 'COMPLETED' } | null;
  /**
   * Anterior al componente por el que entró su matrícula (8/10): no está en su ruta, así que se
   * lista sin «En curso» y sin acción (`enrollment` nulo).
   */
  beforeEntry: boolean;
  /** El precio vigente para el grado del componente; nulo si es gratis o no hay uno cargado. */
  price: { amount: number; period: 'ONE_TIME' | 'MONTHLY' | 'PER_MODULE' } | null;
}

const dateOnly = (d: Date) => d.toISOString().slice(0, 10);

/** Los talleres en el orden de la ruta (el de su primer tema), con lo que trae cada uno. */
function workshopsOf(m: {
  lessons: Array<{ requiresSubmission: boolean; subject: { name: string } }>;
  assessments: Array<{ subject: { name: string } | null }>;
}): CatalogWorkshop[] {
  const byName = new Map<string, CatalogWorkshop>();
  for (const lesson of m.lessons) {
    const row = byName.get(lesson.subject.name) ?? {
      name: lesson.subject.name,
      lessonCount: 0,
      activityCount: 0,
      hasQuiz: false,
    };
    if (lesson.requiresSubmission) row.activityCount += 1;
    else row.lessonCount += 1;
    byName.set(row.name, row);
  }
  for (const quiz of m.assessments) {
    const row = quiz.subject ? byName.get(quiz.subject.name) : undefined;
    if (row) row.hasQuiz = true;
  }
  return [...byName.values()];
}

// Desde el 7/10 también las cohortes en las que la persona ya está (Jhonny: «el de introducción
// también debería listarse»): la lista es lo que ofrece la institución, y lo suyo se marca «En
// curso» o «Terminado» en vez de ofrecer inscribirse. Retirado no se lista: volver es de operación.
const OPEN_WHERE = (personId: string) => ({
  status: 'OPEN' as const,
  program: { archivedAt: null },
  enrollments: { none: { studentId: personId, status: 'WITHDRAWN' as const } },
});

export async function listOpenCourses({
  institutionId,
  personId,
}: {
  institutionId: string;
  personId: string;
}): Promise<CatalogCourse[]> {
  const db = createTenantClient(institutionId);

  const cohorts = await db.cohort.findMany({
    where: OPEN_WHERE(personId),
    orderBy: [{ startsOn: 'asc' }, { code: 'asc' }],
    select: {
      id: true,
      code: true,
      name: true,
      enrollments: {
        where: { studentId: personId },
        select: { id: true, status: true, startsAtModule: true },
      },
      startsOn: true,
      endsOn: true,
      program: {
        select: {
          id: true,
          name: true,
          pricing: true,
          modules: {
            where: { archivedAt: null },
            orderBy: { position: 'asc' },
            select: {
              id: true,
              code: true,
              name: true,
              description: true,
              grade: true,
              position: true,
              coverMedia: { select: { providerRef: true, status: true } },
              lessons: {
                where: { archivedAt: null },
                orderBy: { position: 'asc' },
                select: { requiresSubmission: true, subject: { select: { name: true } } },
              },
              assessments: {
                where: { archivedAt: null },
                select: { subject: { select: { name: true } } },
              },
            },
          },
        },
      },
    },
  });

  const cover = async (m: { coverMedia: { providerRef: string; status: string } | null }) =>
    m.coverMedia && m.coverMedia.status === 'READY'
      ? await createReadUrl(m.coverMedia.providerRef, { asAttachment: false })
      : null;
  const courses: CatalogCourse[] = [];
  // Un componente por tarjeta, gratuito o de pago (Jhonny, 7/10: «la lista de componentes, con
  // de qué programa hacen parte»). Del de pago se pide la inscripción entrando por ese componente;
  // operación decide si conviene empezar antes.
  for (const c of cohorts) {
    const free = c.program.pricing === 'FREE';
    const total = c.program.modules.length;
    const own = c.enrollments[0];
    const enrollment =
      own && own.status !== 'WITHDRAWN' ? { id: own.id, status: own.status } : null;
    // La ruta empieza en `startsAtModule` (cohort.service.ts): lo anterior no es suyo.
    const entryAt = enrollment ? (own?.startsAtModule ?? 1) : null;
    for (const [index, m] of c.program.modules.entries()) {
      const beforeEntry = entryAt !== null && m.position < entryAt;
      const price = free
        ? null
        : await currentPriceFor({ institutionId, programId: c.program.id, grade: m.grade });
      courses.push({
        cohortId: c.id,
        moduleId: m.id,
        code: m.code,
        name: m.name,
        description: m.description,
        grade: m.grade,
        coverUrl: await cover(m),
        lessonCount: m.lessons.filter((l) => !l.requiresSubmission).length,
        activityCount: m.lessons.filter((l) => l.requiresSubmission).length,
        assessmentCount: m.assessments.length,
        hasAssessment: m.assessments.length > 0,
        workshops: workshopsOf(m),
        programId: c.program.id,
        programName: c.program.name,
        position: index + 1,
        programModules: total,
        cohortCode: c.code,
        cohortName: c.name,
        startsOn: dateOnly(c.startsOn),
        endsOn: dateOnly(c.endsOn),
        free,
        enrollment: beforeEntry ? null : enrollment,
        beforeEntry,
        price: price ? { amount: price.amount, period: price.period } : null,
      });
    }
  }
  // Lo gratuito primero: es la puerta («regístrate y entra»).
  return courses.sort((a, b) => Number(b.free) - Number(a.free));
}

/** Un paso del contenido de un curso que todavía no se tomó: solo título y forma. */
export interface PreviewItem {
  id: string;
  title: string;
  form: 'MARKDOWN' | 'SUBMISSION' | 'ASSESSMENT';
}

export interface CoursePreview {
  course: CatalogCourse;
  /** Los talleres en el orden de la ruta, con sus temas, actividades y cuestionario. */
  workshops: Array<{ name: string; items: PreviewItem[] }>;
  /** Exámenes del componente que no son de un taller. */
  moduleItems: PreviewItem[];
  /** Los otros componentes de la misma cohorte, para moverse entre ellos. */
  siblings: Array<{ moduleId: string; name: string; position: number }>;
}

/**
 * La página de un curso que la persona todavía no tomó (7/10, Jhonny: «para los cursos
 * bloqueados puedo de igual manera ver los detalles, pero saldrán bloqueados»): lo mismo que la
 * tarjeta del catálogo más el contenido —talleres, temas, actividades, cuestionarios— solo con
 * título y forma; nada se abre. Solo lo que el catálogo enseña: lo demás es `null` (404).
 */
export async function getCoursePreview({
  institutionId,
  personId,
  cohortId,
  moduleId,
}: {
  institutionId: string;
  personId: string;
  cohortId: string;
  moduleId: string;
}): Promise<CoursePreview | null> {
  const courses = await listOpenCourses({ institutionId, personId });
  const course = courses.find((c) => c.cohortId === cohortId && c.moduleId === moduleId);
  if (!course) return null;

  const db = createTenantClient(institutionId);
  const component = await db.module.findFirst({
    where: { id: moduleId, archivedAt: null },
    select: {
      lessons: {
        where: { archivedAt: null },
        orderBy: { position: 'asc' },
        select: {
          id: true,
          title: true,
          requiresSubmission: true,
          subject: { select: { name: true } },
        },
      },
      assessments: {
        where: { archivedAt: null },
        orderBy: { position: 'asc' },
        select: { id: true, title: true, subject: { select: { name: true } } },
      },
    },
  });
  if (!component) return null;

  // Agrupados como la ruta: el taller en el orden de su primer tema; su cuestionario al final.
  const byName = new Map<string, PreviewItem[]>();
  for (const lesson of component.lessons) {
    const items = byName.get(lesson.subject.name) ?? [];
    items.push({
      id: lesson.id,
      title: lesson.title,
      form: lesson.requiresSubmission ? 'SUBMISSION' : 'MARKDOWN',
    });
    byName.set(lesson.subject.name, items);
  }
  const moduleItems: PreviewItem[] = [];
  for (const quiz of component.assessments) {
    const item = { id: quiz.id, title: quiz.title, form: 'ASSESSMENT' as const };
    const items = quiz.subject ? byName.get(quiz.subject.name) : undefined;
    if (items) items.push(item);
    else moduleItems.push(item);
  }

  return {
    course,
    workshops: [...byName.entries()].map(([name, items]) => ({ name, items })),
    moduleItems,
    siblings: courses
      .filter((c) => c.cohortId === cohortId && c.moduleId !== moduleId)
      .map((c) => ({ moduleId: c.moduleId, name: c.name, position: c.position })),
  };
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
}): Promise<{ enrollmentId: string; startHref: string | null }> {
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

  // Inscribirse lleva al primer tema (6/10, crítica del primer día): el panel después de
  // «Inscribirme» era un paso de más.
  const step = (await getCohortOutline({ institutionId, personId, enrollmentId, now })).resume;
  const startHref = step
    ? step.kind === 'LESSON'
      ? `/aprender/tema/${step.assignmentId}`
      : `/aprender/examen/${step.assignmentId}`
    : null;
  return { enrollmentId, startHref };
}

/**
 * La persona pide un curso de pago (6/10): no se matricula; queda una solicitud para operación,
 * que arma el plan de pagos y, si es menor, registra al acudiente. Solo cohortes `OPEN` de
 * programas de pago; lo demás es `NOT_FOUND`.
 */
export async function requestEnrollment({
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
}): Promise<{ requestedAt: string }> {
  const db = createTenantClient(institutionId);

  const cohort = await db.cohort.findFirst({
    where: { id: cohortId, status: 'OPEN', program: { pricing: 'PAID', archivedAt: null } },
    select: {
      code: true,
      program: {
        select: {
          name: true,
          modules: { where: { id: moduleId, archivedAt: null }, select: { name: true } },
        },
      },
    },
  });
  const course = cohort?.program.modules[0];
  if (!cohort || !course) {
    throw new APIError('Este curso no está abierto para pedir matrícula', 'NOT_FOUND');
  }

  const person = await db.person.findFirst({
    where: { id: personId, anonymizedAt: null },
    select: { givenName: true, familyName: true },
  });
  if (!person) throw new APIError('Not found', 'NOT_FOUND');

  // Una solicitud que operación ve en `/solicitudes` y que se cierra sola al matricular.
  const opened = await openEnrollRequest({
    institutionId,
    personId,
    cohortId,
    moduleId,
    courseName: `${cohort.program.name} · ${course.name}`,
    cohortCode: cohort.code,
    personName: `${person.givenName} ${person.familyName}`,
    now,
  });
  return { requestedAt: opened.createdAt };
}
