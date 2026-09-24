/**
 * Enrollments and their cycle.
 * SSOT: plan/06-cohortes-y-personas.md:72-77 (§8), endpoints.md:65-66.
 */

import 'server-only';

import { calculateAgeAt, bogotaDate } from '@colombia-estudia/domain';
import { createTenantClient } from '@/lib/db/tenant';
import { isUniqueViolation } from '@/lib/db/errors';
import { APIError } from '@/lib/core/errors';

export interface CohortDetail {
  id: string;
  code: string;
  name: string;
  status: string;
  progression: string;
  startsOn: string;
  endsOn: string;
  programName: string;
  programId: string;
  /** Los módulos del programa, en orden: para elegir el grado de entrada al matricular (20/9). */
  modules: Array<{ id: string; name: string; position: number }>;
  /**
   * La última apertura o cierre, para la cabecera («Abierta por X el …»; ola 2, 23/9). Sale
   * del `AuditLog` porque la cohorte no guarda quién la abrió; `by` nulo si no hay actor.
   */
  lastTransition: { action: 'opened' | 'closed'; at: string; by: string | null } | null;
  enrollments: Array<{
    id: string;
    personId: string;
    name: string;
    status: string;
    isMinorAtEnrollment: boolean;
    accessUntil: string;
    withdrawReason: string | null;
    /** Posición del módulo por el que empieza; nulo = desde el primero. */
    startsAtModule: number | null;
  }>;
}

const isoDay = (date: Date) => date.toISOString().slice(0, 10);

/** Midnight UTC of "today in Bogotá", which is how `@db.Date` columns compare. */
export function bogotaToday(now: Date): Date {
  return new Date(bogotaDate(now));
}

/**
 * When the student's access ends.
 * The cohort can fix one date for everybody; otherwise each enrollment gets the program's
 * default number of days counted from the day they enrolled.
 */
export function resolveAccessUntil({
  cohortAccessUntil,
  defaultAccessDays,
  enrolledAt,
}: {
  cohortAccessUntil: Date | null;
  defaultAccessDays: number;
  enrolledAt: Date;
}): Date {
  if (cohortAccessUntil) return cohortAccessUntil;

  const until = new Date(enrolledAt);
  until.setUTCDate(until.getUTCDate() + defaultAccessDays);
  return new Date(isoDay(until));
}

export async function getCohortDetail({
  institutionId,
  cohortId,
}: {
  institutionId: string;
  cohortId: string;
}): Promise<CohortDetail | null> {
  const db = createTenantClient(institutionId);

  const cohort = await db.cohort.findFirst({
    where: { id: cohortId },
    select: {
      id: true,
      code: true,
      name: true,
      status: true,
      progression: true,
      startsOn: true,
      endsOn: true,
      program: {
        select: {
          id: true,
          name: true,
          modules: {
            where: { archivedAt: null },
            orderBy: { position: 'asc' },
            select: { id: true, name: true, position: true },
          },
        },
      },
      enrollments: {
        orderBy: { enrolledAt: 'desc' },
        select: {
          id: true,
          status: true,
          isMinorAtEnrollment: true,
          accessUntil: true,
          withdrawReason: true,
          startsAtModule: true,
          student: { select: { id: true, givenName: true, familyName: true } },
        },
      },
    },
  });

  if (!cohort) return null;

  const transition = await db.auditLog.findFirst({
    where: { entity: 'cohort', entityId: cohortId, action: { in: ['opened', 'closed'] } },
    orderBy: { occurredAt: 'desc' },
    select: { action: true, occurredAt: true, actorId: true },
  });
  const actor = transition?.actorId
    ? await db.person.findUnique({
        where: { id: transition.actorId },
        select: { givenName: true, familyName: true },
      })
    : null;

  return {
    id: cohort.id,
    code: cohort.code,
    name: cohort.name,
    status: cohort.status,
    progression: cohort.progression,
    lastTransition: transition
      ? {
          action: transition.action as 'opened' | 'closed',
          at: transition.occurredAt.toISOString(),
          by: actor ? `${actor.givenName} ${actor.familyName}` : null,
        }
      : null,
    startsOn: isoDay(cohort.startsOn),
    endsOn: isoDay(cohort.endsOn),
    programName: cohort.program.name,
    programId: cohort.program.id,
    modules: cohort.program.modules,
    enrollments: cohort.enrollments.map((e) => ({
      id: e.id,
      personId: e.student.id,
      name: `${e.student.familyName}, ${e.student.givenName}`,
      status: e.status,
      isMinorAtEnrollment: e.isMinorAtEnrollment,
      accessUntil: isoDay(e.accessUntil),
      withdrawReason: e.withdrawReason,
      startsAtModule: e.startsAtModule,
    })),
  };
}

/**
 * Enrolls a person, found by document number or email.
 *
 * `birthDate` is required (endpoints.md:65): without it there is no way to know whether the
 * person was a minor when they enrolled, and that single flag drives consent, guardianship
 * and the whole access-suspension policy later on.
 *
 * `startsAtModule` (20/9) is the entry grade: the position of the first module in this
 * student's route. Modules before it stay hidden from them and out of their progress.
 * `null` means the whole program.
 */
export async function enrollPerson({
  institutionId,
  actorId,
  cohortId,
  personHandle,
  startsAtModule = null,
  now = new Date(),
}: {
  institutionId: string;
  actorId: string | null;
  cohortId: string;
  personHandle: string;
  startsAtModule?: number | null;
  now?: Date;
}): Promise<{ enrollmentId: string; warning: string | null }> {
  const db = createTenantClient(institutionId);

  const handle = personHandle.trim();
  const person = await db.person.findFirst({
    where: {
      anonymizedAt: null,
      OR: [{ documentNumber: handle }, { email: handle.toLowerCase() }],
    },
    select: { id: true, birthDate: true },
  });
  if (!person) {
    throw new APIError(
      'No hay ninguna persona con ese documento o correo en la institución',
      'NOT_FOUND'
    );
  }
  if (!person.birthDate) {
    throw new APIError(
      'La persona no tiene fecha de nacimiento; sin ella no se puede matricular',
      'VALIDATION_ERROR'
    );
  }

  const isMinor = calculateAgeAt(person.birthDate, now) < 18;

  if (isMinor) {
    const guardianship = await db.guardianship.findFirst({
      where: { studentId: person.id, institutionId },
      select: { id: true },
    });
    if (!guardianship) {
      throw new APIError(
        'Es menor de edad y no tiene acudiente registrado; regístralo antes de matricular',
        'VALIDATION_ERROR'
      );
    }
  }

  const cohort = await db.cohort.findFirst({
    where: { id: cohortId },
    select: {
      id: true,
      status: true,
      accessUntil: true,
      program: {
        select: {
          defaultAccessDays: true,
          modules: { where: { archivedAt: null }, select: { position: true } },
        },
      },
    },
  });
  if (!cohort) {
    throw new APIError('Cohort not found', 'NOT_FOUND');
  }
  if (cohort.status !== 'PLANNED' && cohort.status !== 'OPEN') {
    throw new APIError('La cohorte ya no admite matrículas', 'CONFLICT');
  }

  // The entry module has to exist in the program: an enrollment starting past the last
  // module would show the student an empty route with nothing to explain it.
  if (
    startsAtModule !== null &&
    !cohort.program.modules.some((m) => m.position === startsAtModule)
  ) {
    throw new APIError('El programa no tiene un módulo en esa posición', 'VALIDATION_ERROR');
  }

  const accessUntil = resolveAccessUntil({
    cohortAccessUntil: cohort.accessUntil,
    defaultAccessDays: cohort.program.defaultAccessDays,
    enrolledAt: now,
  });

  // `requireAgreementForNextCohort` (plan/09 §7): con mora en otra matrícula y sin acuerdo
  // vigente se **avisa**; no se bloquea. La política es de la cartera, no del acceso.
  const warning = await overdueWithoutAgreementWarning({ institutionId, personId: person.id, now });

  try {
    return await db.$transaction(async (tx) => {
      const enrollment = await tx.enrollment.create({
        data: {
          institutionId,
          cohortId,
          studentId: person.id,
          isMinorAtEnrollment: isMinor,
          accessUntil,
          startsAtModule,
        },
        select: { id: true },
      });

      const hasRole = await tx.membership.findFirst({
        where: { personId: person.id, role: 'STUDENT', revokedAt: null },
        select: { id: true },
      });
      if (!hasRole) {
        await tx.membership.create({
          data: { institutionId, personId: person.id, role: 'STUDENT' },
        });
        await tx.auditLog.create({
          data: {
            institutionId,
            actorId,
            entity: 'membership',
            entityId: person.id,
            action: 'granted',
            after: { role: 'STUDENT', reason: 'enrollment' },
          },
        });
      }

      await tx.auditLog.create({
        data: {
          institutionId,
          actorId,
          entity: 'enrollment',
          entityId: enrollment.id,
          action: 'created',
          after: {
            cohortId,
            studentId: person.id,
            isMinorAtEnrollment: isMinor,
            accessUntil: isoDay(accessUntil),
            startsAtModule,
          },
        },
      });

      return { enrollmentId: enrollment.id, warning };
    });
  } catch (err) {
    if (isUniqueViolation(err)) {
      throw new APIError('Esa persona ya está matriculada en esta cohorte', 'CONFLICT');
    }
    throw err;
  }
}

export interface EnrollmentPreview {
  person: {
    id: string;
    name: string;
    /** Sin fecha de nacimiento no se puede matricular; se dice antes de intentarlo. */
    hasBirthDate: boolean;
    isMinor: boolean;
    /** Solo con menor de edad: si tiene acudiente registrado, y quién. */
    guardianName: string | null;
  } | null;
  /** Ya matriculada en esta cohorte (cualquier estado). */
  alreadyEnrolled: boolean;
  /** Otras matrículas activas, para que quien matricula sepa qué más está cursando. */
  activeElsewhere: Array<{ cohortCode: string; programName: string }>;
  /** Hasta cuándo tendría acceso si se matricula hoy. */
  accessUntil: string | null;
  /** El aviso de cartera (`requireAgreementForNextCohort`), si aplica. */
  warning: string | null;
  /** Lo que impide matricular, en el orden en que `enrollPerson` lo rechazaría. */
  blockers: Array<'NOT_FOUND' | 'NO_BIRTH_DATE' | 'MINOR_WITHOUT_GUARDIAN' | 'ALREADY_ENROLLED'>;
}

/**
 * Lo que pasaría al matricular, sin matricular (23/9, pieza 5): la misma persona y las
 * mismas reglas que `enrollPerson`, para que la hoja de matrícula enseñe a quién va a
 * matricular y qué lo impide **antes** de pulsar. No escribe nada ni audita: es una lectura.
 */
export async function previewEnrollment({
  institutionId,
  cohortId,
  personHandle,
  now = new Date(),
}: {
  institutionId: string;
  cohortId: string;
  personHandle: string;
  now?: Date;
}): Promise<EnrollmentPreview> {
  const db = createTenantClient(institutionId);
  const handle = personHandle.trim();

  const empty: EnrollmentPreview = {
    person: null,
    alreadyEnrolled: false,
    activeElsewhere: [],
    accessUntil: null,
    warning: null,
    blockers: ['NOT_FOUND'],
  };
  if (handle === '') return empty;

  const person = await db.person.findFirst({
    where: {
      anonymizedAt: null,
      OR: [{ documentNumber: handle }, { email: handle.toLowerCase() }],
    },
    select: {
      id: true,
      givenName: true,
      familyName: true,
      birthDate: true,
      guardians: {
        take: 1,
        select: { guardian: { select: { givenName: true, familyName: true } } },
      },
      enrollments: {
        where: { OR: [{ cohortId }, { status: 'ACTIVE' }] },
        select: {
          cohortId: true,
          status: true,
          cohort: { select: { code: true, program: { select: { name: true } } } },
        },
      },
    },
  });
  if (!person) return empty;

  const cohort = await db.cohort.findFirst({
    where: { id: cohortId },
    select: { accessUntil: true, program: { select: { defaultAccessDays: true } } },
  });
  if (!cohort) throw new APIError('Cohort not found', 'NOT_FOUND');

  const isMinor = person.birthDate ? calculateAgeAt(person.birthDate, now) < 18 : false;
  const guardian = person.guardians[0]?.guardian ?? null;
  const alreadyEnrolled = person.enrollments.some((e) => e.cohortId === cohortId);

  const blockers: EnrollmentPreview['blockers'] = [];
  if (!person.birthDate) blockers.push('NO_BIRTH_DATE');
  if (isMinor && !guardian) blockers.push('MINOR_WITHOUT_GUARDIAN');
  if (alreadyEnrolled) blockers.push('ALREADY_ENROLLED');

  return {
    person: {
      id: person.id,
      name: `${person.givenName} ${person.familyName}`,
      hasBirthDate: person.birthDate !== null,
      isMinor,
      guardianName: guardian ? `${guardian.givenName} ${guardian.familyName}` : null,
    },
    alreadyEnrolled,
    activeElsewhere: person.enrollments
      .filter((e) => e.cohortId !== cohortId && e.status === 'ACTIVE')
      .map((e) => ({ cohortCode: e.cohort.code, programName: e.cohort.program.name })),
    accessUntil: isoDay(
      resolveAccessUntil({
        cohortAccessUntil: cohort.accessUntil,
        defaultAccessDays: cohort.program.defaultAccessDays,
        enrolledAt: now,
      })
    ),
    warning: await overdueWithoutAgreementWarning({ institutionId, personId: person.id, now }),
    blockers,
  };
}

/**
 * El aviso de `requireAgreementForNextCohort`: si la persona tiene otra matrícula con cuota
 * vencida y sin acuerdo vigente, se devuelve una frase para la pantalla. `null` si la
 * política está apagada o no hay mora.
 */
async function overdueWithoutAgreementWarning({
  institutionId,
  personId,
  now,
}: {
  institutionId: string;
  personId: string;
  now: Date;
}): Promise<string | null> {
  const db = createTenantClient(institutionId);
  const policy = await db.restrictionPolicy.findFirst({
    where: { institutionId },
    select: { requireAgreementForNextCohort: true },
  });
  if (!policy?.requireAgreementForNextCohort) return null;

  const overdue = await db.installment.findFirst({
    where: {
      status: { in: ['OPEN', 'PARTIALLY_PAID'] },
      dueOn: { lt: now },
      agreementId: null,
      paymentPlan: {
        payerType: 'PERSON',
        enrollment: { studentId: personId, paymentAgreements: { none: { status: 'ACTIVE' } } },
      },
    },
    select: {
      id: true,
      paymentPlan: { select: { enrollment: { select: { cohort: { select: { code: true } } } } } },
    },
  });
  if (!overdue) return null;
  return `Esta persona tiene cartera vencida en ${overdue.paymentPlan.enrollment.cohort.code} y ningún acuerdo de pago vigente. La política de la institución pide un acuerdo antes de matricularla en otra cohorte; la matrícula se hizo igual.`;
}

/**
 * Withdraws the student and voids the instalments that have not fallen due.
 *
 * Only `OPEN` ones: a `PARTIALLY_PAID` instalment has money against it, and voiding it would
 * orphan that payment. The plan says "cuotas no vencidas → VOID"; this is that rule with the
 * one case it does not mention made safe.
 */
export async function withdrawEnrollment({
  institutionId,
  actorId,
  enrollmentId,
  reason,
  now = new Date(),
}: {
  institutionId: string;
  actorId: string | null;
  enrollmentId: string;
  reason: string;
  now?: Date;
}): Promise<{ id: string; voidedInstallments: number }> {
  const db = createTenantClient(institutionId);
  const today = bogotaToday(now);

  return db.$transaction(async (tx) => {
    const enrollment = await tx.enrollment.findFirst({
      where: { id: enrollmentId, institutionId },
      select: { id: true, status: true, paymentPlan: { select: { id: true } } },
    });
    if (!enrollment) {
      throw new APIError('Enrollment not found', 'NOT_FOUND');
    }
    if (enrollment.status === 'WITHDRAWN') {
      throw new APIError('La matrícula ya está retirada', 'CONFLICT');
    }

    await tx.enrollment.update({
      where: { id: enrollmentId },
      data: { status: 'WITHDRAWN', withdrawnAt: now, withdrawReason: reason },
    });

    let voided = 0;
    if (enrollment.paymentPlan) {
      const result = await tx.installment.updateMany({
        where: {
          paymentPlanId: enrollment.paymentPlan.id,
          status: 'OPEN',
          dueOn: { gt: today },
        },
        data: { status: 'VOID' },
      });
      voided = result.count;
    }

    await tx.auditLog.create({
      data: {
        institutionId,
        actorId,
        entity: 'enrollment',
        entityId: enrollmentId,
        action: 'withdrawn',
        after: { reason, voidedInstallments: voided },
      },
    });

    return { id: enrollmentId, voidedInstallments: voided };
  });
}

/**
 * Extends access. Forward only: shortening someone's access is a different decision
 * (withdrawing them), and it should not hide behind a button labelled "prorrogar".
 */
export async function extendEnrollment({
  institutionId,
  actorId,
  enrollmentId,
  accessUntil,
}: {
  institutionId: string;
  actorId: string | null;
  enrollmentId: string;
  accessUntil: Date;
}): Promise<{ id: string; accessUntil: string }> {
  const db = createTenantClient(institutionId);

  return db.$transaction(async (tx) => {
    const enrollment = await tx.enrollment.findFirst({
      where: { id: enrollmentId, institutionId },
      select: { id: true, status: true, accessUntil: true },
    });
    if (!enrollment) {
      throw new APIError('Enrollment not found', 'NOT_FOUND');
    }
    if (enrollment.status === 'WITHDRAWN') {
      throw new APIError('No se prorroga una matrícula retirada', 'CONFLICT');
    }
    if (accessUntil <= enrollment.accessUntil) {
      throw new APIError(
        'La nueva fecha debe ser posterior a la actual; para recortar el acceso, retira la matrícula',
        'VALIDATION_ERROR'
      );
    }

    await tx.enrollment.update({ where: { id: enrollmentId }, data: { accessUntil } });
    await tx.auditLog.create({
      data: {
        institutionId,
        actorId,
        entity: 'enrollment',
        entityId: enrollmentId,
        action: 'extended',
        before: { accessUntil: isoDay(enrollment.accessUntil) },
        after: { accessUntil: isoDay(accessUntil) },
      },
    });

    return { id: enrollmentId, accessUntil: isoDay(accessUntil) };
  });
}
