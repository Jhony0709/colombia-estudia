import 'server-only';

/**
 * Las solicitudes del estudiante (6/10): inscribirse en un curso de pago (`ENROLL`), que le
 * habiliten el siguiente componente (`UNLOCK`) u otra oportunidad en un examen que perdió con
 * todos los intentos (`ATTEMPT`, 5/11). Las resuelve operación desde `/solicitudes`, la ficha
 * de la matrícula o la cohorte.
 *
 * Una solicitud no se resuelve a mano: se cierra sola cuando lo pedido ocurre —`enrollPerson`
 * crea la matrícula, `setModuleAccess` habilita el componente— desde donde sea (`closeRequests`).
 * Descartar sí es explícito. Pedir dos veces lo mismo devuelve la abierta (índice único parcial
 * en la migración) y no vuelve a avisar.
 *
 * Mostrar la cartera junto a la solicitud es información para decidir; la regla «la mora no
 * toca el acceso académico de un menor» sigue en RestrictionPolicy, no aquí.
 */

import { calculateAgeAt } from '@colombia-estudia/domain';
import { createTenantClient, prisma } from '@/lib/db/tenant';
import { APIError } from '@/lib/core/errors';
import { isUniqueViolation } from '@/lib/db/errors';
import {
  notify,
  notifyMany,
  staffPersonIds,
} from '@/features/notifications/server/notifications.service';
import { getCohortOutline } from '@/features/learn/server/cohort.service';
import { getAssessmentForStudent } from '@/features/learn/server/attempt.service';
import { logger } from '@/lib/observability/logger';
import { SERVICE_WINDOW_MS, sendTemplate, sendText } from '@/lib/whatsapp/cloud-api';
import { siteUrl } from '@/lib/seo/site-url';

export type RequestKind = 'ENROLL' | 'UNLOCK' | 'ATTEMPT';
export type RequestStatus = 'PENDING' | 'DONE' | 'DISMISSED';

export interface OpenedRequest {
  id: string;
  /** ISO */
  createdAt: string;
  /** Ya había una abierta: no se creó otra ni se avisó otra vez. */
  already: boolean;
}

async function openRequest(
  institutionId: string,
  data: {
    personId: string;
    kind: RequestKind;
    cohortId: string;
    moduleId: string;
    enrollmentId: string | null;
    assessmentAssignmentId?: string | null;
    now: Date;
  }
): Promise<OpenedRequest> {
  const db = createTenantClient(institutionId);
  const where = {
    personId: data.personId,
    kind: data.kind,
    cohortId: data.cohortId,
    moduleId: data.moduleId,
    assessmentAssignmentId: data.assessmentAssignmentId ?? null,
    status: 'PENDING' as const,
  };
  const found = await db.accessRequest.findFirst({ where, select: { id: true, createdAt: true } });
  if (found) return { id: found.id, createdAt: found.createdAt.toISOString(), already: true };
  try {
    const created = await db.accessRequest.create({
      data: {
        institutionId,
        personId: data.personId,
        kind: data.kind,
        cohortId: data.cohortId,
        moduleId: data.moduleId,
        enrollmentId: data.enrollmentId,
        assessmentAssignmentId: data.assessmentAssignmentId ?? null,
        createdAt: data.now,
      },
      select: { id: true, createdAt: true },
    });
    return { id: created.id, createdAt: created.createdAt.toISOString(), already: false };
  } catch (err) {
    // Dos clics a la vez: la otra petición ganó el índice único.
    if (!isUniqueViolation(err)) throw err;
    const again = await db.accessRequest.findFirst({
      where,
      select: { id: true, createdAt: true },
    });
    if (!again) throw err;
    return { id: again.id, createdAt: again.createdAt.toISOString(), already: true };
  }
}

async function notifyStaff(
  institutionId: string,
  input: {
    type: 'enrollment_requested' | 'unlock_requested' | 'attempt_requested';
    title: string;
    body: string;
    key: string;
  }
) {
  const staff = await staffPersonIds(institutionId, ['OPERATIONS', 'ADMIN']);
  await notifyMany(institutionId, staff, {
    type: input.type,
    title: input.title,
    body: input.body,
    href: '/solicitudes',
    dedupeKey: input.key,
  });
}

/**
 * La persona pide un curso de pago. `cohortId`/`moduleId` ya validados por el catálogo
 * (`requestEnrollment`), que es quien sabe qué está abierto para ella.
 */
export async function openEnrollRequest({
  institutionId,
  personId,
  cohortId,
  moduleId,
  courseName,
  cohortCode,
  personName,
  now = new Date(),
}: {
  institutionId: string;
  personId: string;
  cohortId: string;
  moduleId: string;
  courseName: string;
  cohortCode: string;
  personName: string;
  now?: Date;
}): Promise<OpenedRequest> {
  const opened = await openRequest(institutionId, {
    personId,
    kind: 'ENROLL',
    cohortId,
    moduleId,
    enrollmentId: null,
    now,
  });
  if (!opened.already) {
    await notifyStaff(institutionId, {
      type: 'enrollment_requested',
      title: 'Solicitud de matrícula',
      body: `${personName} quiere inscribirse en ${courseName} (${cohortCode}).`,
      key: `access_request:${opened.id}`,
    });
  }
  return opened;
}

/**
 * La persona pide que le habiliten un componente de su matrícula. Solo uno que su ruta
 * muestra bloqueado a la espera de operación (`LOCKED`): no uno abierto, ni uno con fechas, ni
 * de una matrícula que no puede estudiar hoy.
 */
export async function requestUnlock({
  institutionId,
  personId,
  enrollmentId,
  moduleId,
  now = new Date(),
}: {
  institutionId: string;
  personId: string;
  enrollmentId: string;
  moduleId: string;
  now?: Date;
}): Promise<OpenedRequest> {
  const outline = await getCohortOutline({ institutionId, personId, enrollmentId, now });
  const component = outline.modules.find((m) => m.id === moduleId);
  if (!outline.cohort || !outline.enrollmentId || !component) {
    throw new APIError('Not found', 'NOT_FOUND');
  }
  if (outline.gate) {
    throw new APIError('Esta matrícula no está activa', 'CONFLICT');
  }
  // Solo el siguiente bloqueado, como en la pantalla: pedir los de más adelante es ruido para
  // operación (PRODUCT_DECISIONS 6/10, descartado).
  const nextLocked = outline.modules.find((m) => m.access.state === 'LOCKED');
  if (component.access.state !== 'LOCKED' || nextLocked?.id !== moduleId) {
    throw new APIError('Este componente no está esperando habilitación', 'CONFLICT');
  }

  const db = createTenantClient(institutionId);
  const person = await db.person.findFirst({
    where: { id: personId },
    select: { givenName: true, familyName: true },
  });

  const opened = await openRequest(institutionId, {
    personId,
    kind: 'UNLOCK',
    cohortId: outline.cohort.id,
    moduleId,
    enrollmentId: outline.enrollmentId,
    now,
  });
  if (!opened.already) {
    await notifyStaff(institutionId, {
      type: 'unlock_requested',
      title: 'Solicitud de habilitación',
      body: `${person?.givenName ?? ''} ${person?.familyName ?? ''} pide habilitar ${component.name} (${outline.cohort.code}).`.trim(),
      key: `access_request:${opened.id}`,
    });
  }
  return opened;
}

/**
 * La persona perdió un examen con todos sus intentos y pide otra oportunidad (5/11, Kris).
 * Solo si su examen está detenido (`blocked`): con intentos por delante no hay nada que pedir.
 */
export async function requestAttempt({
  institutionId,
  personId,
  assignmentId,
  now = new Date(),
}: {
  institutionId: string;
  personId: string;
  assignmentId: string;
  now?: Date;
}): Promise<OpenedRequest> {
  const view = await getAssessmentForStudent({ institutionId, personId, assignmentId, now });
  if (view.gate || !view.assessment) throw new APIError('Not found', 'NOT_FOUND');
  if (!view.blocked) {
    throw new APIError('Este examen no está esperando otra oportunidad', 'CONFLICT');
  }

  const db = createTenantClient(institutionId);
  const [assignment, person] = await Promise.all([
    db.assessmentAssignment.findFirst({
      where: { id: assignmentId },
      select: {
        cohortId: true,
        cohort: { select: { code: true } },
        assessment: { select: { moduleId: true } },
      },
    }),
    db.person.findFirst({
      where: { id: personId },
      select: { givenName: true, familyName: true },
    }),
  ]);
  if (!assignment?.assessment.moduleId) throw new APIError('Not found', 'NOT_FOUND');

  const opened = await openRequest(institutionId, {
    personId,
    kind: 'ATTEMPT',
    cohortId: assignment.cohortId,
    moduleId: assignment.assessment.moduleId,
    enrollmentId: view.assessment.enrollmentId,
    assessmentAssignmentId: assignmentId,
    now,
  });
  if (!opened.already) {
    await notifyStaff(institutionId, {
      type: 'attempt_requested',
      title: 'Solicitud de otra oportunidad',
      body: `${person?.givenName ?? ''} ${person?.familyName ?? ''} perdió ${view.assessment.title} (${assignment.cohort.code}) y pide otra oportunidad.`.trim(),
      key: `access_request:${opened.id}`,
    });
  }
  return opened;
}

/** `wa_id` de un teléfono guardado: solo dígitos y, si es un celular colombiano, con el 57. */
export function whatsappIdOf(phone: string | null): string | null {
  const digits = phone?.replace(/\D/g, '') ?? '';
  if (/^3\d{9}$/.test(digits)) return `57${digits}`;
  return digits.length >= 11 ? digits : null;
}

/**
 * Operación concede otra oportunidad (5/11): la solicitud `ATTEMPT` queda hecha y eso suma un
 * intento a ese examen (`attempt.service`). Audita, avisa en la plataforma y, si se puede, por
 * WhatsApp: libre dentro de las 24 h de su último mensaje, con plantilla después.
 */
export async function grantAttempt({
  institutionId,
  actorId,
  requestId,
  now = new Date(),
}: {
  institutionId: string;
  actorId: string;
  requestId: string;
  now?: Date;
}): Promise<{ status: 'DONE'; whatsapp: 'sent' | 'skipped' | 'failed' }> {
  const db = createTenantClient(institutionId);
  const row = await db.accessRequest.findFirst({
    where: { id: requestId },
    select: {
      id: true,
      status: true,
      kind: true,
      personId: true,
      whatsappId: true,
      whatsappAt: true,
      assessmentAssignmentId: true,
      assessmentAssignment: { select: { assessment: { select: { title: true } } } },
      person: { select: { givenName: true, phone: true } },
    },
  });
  if (!row) throw new APIError('Not found', 'NOT_FOUND');
  if (row.kind !== 'ATTEMPT' || !row.assessmentAssignmentId || !row.assessmentAssignment) {
    throw new APIError('Esta solicitud no es de un examen', 'CONFLICT');
  }
  if (row.status !== 'PENDING') throw new APIError('Esta solicitud ya está cerrada', 'CONFLICT');

  await db.$transaction(async (tx) => {
    await tx.accessRequest.update({
      where: { id: row.id },
      data: { status: 'DONE', resolvedAt: now, resolvedById: actorId },
    });
    await tx.auditLog.create({
      data: {
        institutionId,
        actorId,
        entity: 'access_request',
        entityId: row.id,
        action: 'attempt_granted',
        after: { personId: row.personId, assessmentAssignmentId: row.assessmentAssignmentId },
        occurredAt: now,
      },
    });
  });

  const title = row.assessmentAssignment.assessment.title;
  const href = `/aprender/examen/${row.assessmentAssignmentId}`;
  await notify(institutionId, {
    personId: row.personId,
    type: 'attempt_granted',
    title: 'Tienes otra oportunidad',
    body: `Ya puedes presentar de nuevo ${title}.`,
    href,
    dedupeKey: `attempt_granted:${row.id}`,
  });

  const to = row.whatsappId ?? whatsappIdOf(row.person.phone);
  if (!to) return { status: 'DONE', whatsapp: 'skipped' };
  const institution = await prisma.institution.findUnique({
    where: { id: institutionId },
    select: { whatsappPhoneNumberId: true },
  });
  const from = institution?.whatsappPhoneNumberId ?? null;
  const inWindow =
    row.whatsappId !== null &&
    row.whatsappAt !== null &&
    now.getTime() - row.whatsappAt.getTime() < SERVICE_WINDOW_MS;
  const template = process.env.WHATSAPP_TEMPLATE_ATTEMPT_GRANTED;
  const result = inWindow
    ? await sendText(
        to,
        `Hola, ${row.person.givenName}. Ya tienes otra oportunidad en «${title}». Puedes presentarlo aquí: ${siteUrl()}${href}`,
        from
      )
    : template
      ? await sendTemplate(to, template, [row.person.givenName, title], { phoneNumberId: from })
      : null;
  if (!result) return { status: 'DONE', whatsapp: 'skipped' };
  if (!result.sent) {
    logger.warn({ event: 'whatsapp-send-failed', requestId: row.id, reason: result.reason });
    return { status: 'DONE', whatsapp: result.reason === 'not_configured' ? 'skipped' : 'failed' };
  }
  return { status: 'DONE', whatsapp: 'sent' };
}

/**
 * Cierra como hechas las solicitudes abiertas que lo pedido acaba de cumplir. Va dentro de
 * la transacción de quien lo cumple (`enrollPerson`, `setModuleAccess`).
 */
export async function closeRequests(
  tx: Pick<ReturnType<typeof createTenantClient>, 'accessRequest'>,
  where:
    | { kind: 'ENROLL'; personId: string; programId: string }
    | { kind: 'UNLOCK'; enrollmentId: string; moduleId: string },
  { actorId, now }: { actorId: string | null; now: Date }
): Promise<number> {
  // ENROLL por programa: si operación lo matricula en otra cohorte del mismo programa, también
  // quedó hecho lo que pidió.
  const scope =
    where.kind === 'ENROLL'
      ? {
          kind: 'ENROLL' as const,
          personId: where.personId,
          cohort: { programId: where.programId },
        }
      : where;
  const result = await tx.accessRequest.updateMany({
    where: { ...scope, status: 'PENDING' },
    data: { status: 'DONE', resolvedAt: now, resolvedById: actorId },
  });
  return result.count;
}

/** Clave de `enroll`: se pide por componente, no por cohorte (1/11). */
export function pendingEnrollKey(cohortId: string, moduleId: string): string {
  return `${cohortId}:${moduleId}`;
}

/** Una solicitud de matrícula abierta: cuándo y por qué componente pidió entrar. */
export interface PendingEnroll {
  /** ISO */
  at: string;
  moduleId: string;
}

/** Lo que la persona tiene pedido y sin resolver, para que `/aprender` diga «Lo pediste el …». */
export async function listMyPendingRequests({
  institutionId,
  personId,
}: {
  institutionId: string;
  personId: string;
}): Promise<{ enroll: Record<string, PendingEnroll>; unlock: Record<string, string> }> {
  const db = createTenantClient(institutionId);
  const rows = await db.accessRequest.findMany({
    where: { personId, status: 'PENDING' },
    select: { kind: true, cohortId: true, moduleId: true, enrollmentId: true, createdAt: true },
  });
  const enroll: Record<string, PendingEnroll> = {};
  const unlock: Record<string, string> = {};
  for (const row of rows) {
    if (row.kind === 'ENROLL') {
      enroll[pendingEnrollKey(row.cohortId, row.moduleId)] = {
        at: row.createdAt.toISOString(),
        moduleId: row.moduleId,
      };
    } else if (row.kind === 'UNLOCK' && row.enrollmentId) {
      unlock[`${row.enrollmentId}:${row.moduleId}`] = row.createdAt.toISOString();
    }
  }
  return { enroll, unlock };
}

export interface StaffRequestRow {
  id: string;
  kind: RequestKind;
  status: RequestStatus;
  /** ISO */
  createdAt: string;
  resolvedAt: string | null;
  resolvedByName: string | null;
  person: {
    id: string;
    code: string;
    name: string;
    /** Correo o documento: con lo que la hoja de matrícula la encuentra. */
    handle: string | null;
    isMinor: boolean;
    hasGuardian: boolean;
  };
  cohort: {
    id: string;
    code: string;
    name: string;
    programName: string;
    open: boolean;
    /** En LINEAR, al matricular se eligen qué componentes quedan abiertos (4/11). */
    progression: 'LINEAR' | 'FREE';
    /** Los componentes, para la hoja de matrícula (punto de entrada). */
    modules: Array<{ id: string; name: string; position: number; grade: number | null }>;
  };
  module: { id: string; name: string; position: number; grade: number | null };
  /** UNLOCK y ATTEMPT: la matrícula, para habilitar y enlazar la ficha. */
  enrollmentId: string | null;
  /** ATTEMPT: el examen en el que pide otra oportunidad. */
  assessment: { assignmentId: string; title: string } | null;
  /** ISO: su último mensaje por WhatsApp con el código de la solicitud; nulo si no escribió. */
  whatsappAt: string | null;
  /**
   * La cartera de la matrícula, para decidir sin salir de la fila. `null` sin plan de pagos
   * (o en ENROLL, que aún no tiene matrícula).
   */
  billing: { overdue: number } | null;
}

/** La bandeja: las abiertas primero y por antigüedad; las cerradas, las últimas 50. */
export async function listRequests({
  institutionId,
  status,
  now = new Date(),
}: {
  institutionId: string;
  status: 'PENDING' | 'CLOSED';
  now?: Date;
}): Promise<StaffRequestRow[]> {
  const db = createTenantClient(institutionId);
  const rows = await db.accessRequest.findMany({
    where: status === 'PENDING' ? { status: 'PENDING' } : { status: { not: 'PENDING' } },
    orderBy: status === 'PENDING' ? { createdAt: 'asc' } : { resolvedAt: 'desc' },
    take: status === 'PENDING' ? undefined : 50,
    select: {
      id: true,
      kind: true,
      status: true,
      createdAt: true,
      resolvedAt: true,
      resolvedBy: { select: { givenName: true, familyName: true } },
      enrollmentId: true,
      person: {
        select: {
          id: true,
          code: true,
          givenName: true,
          familyName: true,
          email: true,
          documentNumber: true,
          birthDate: true,
          guardians: { select: { id: true }, take: 1 },
        },
      },
      cohort: {
        select: {
          id: true,
          code: true,
          name: true,
          status: true,
          progression: true,
          program: {
            select: {
              name: true,
              modules: {
                where: { archivedAt: null },
                orderBy: { position: 'asc' },
                select: { id: true, name: true, position: true, grade: true },
              },
            },
          },
        },
      },
      module: { select: { id: true, name: true, position: true, grade: true } },
      assessmentAssignment: { select: { id: true, assessment: { select: { title: true } } } },
      whatsappAt: true,
      enrollment: {
        select: {
          paymentPlan: {
            select: {
              installments: {
                where: { status: { in: ['OPEN', 'PARTIALLY_PAID'] }, dueOn: { lt: now } },
                select: { id: true },
              },
            },
          },
        },
      },
    },
  });

  return rows.map((row) => ({
    id: row.id,
    kind: row.kind,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    resolvedAt: row.resolvedAt?.toISOString() ?? null,
    resolvedByName: row.resolvedBy
      ? `${row.resolvedBy.givenName} ${row.resolvedBy.familyName}`
      : null,
    person: {
      id: row.person.id,
      code: row.person.code,
      name: `${row.person.givenName} ${row.person.familyName}`,
      handle: row.person.email ?? row.person.documentNumber,
      isMinor: row.person.birthDate ? calculateAgeAt(row.person.birthDate, now) < 18 : false,
      hasGuardian: row.person.guardians.length > 0,
    },
    cohort: {
      id: row.cohort.id,
      code: row.cohort.code,
      name: row.cohort.name,
      programName: row.cohort.program.name,
      open: row.cohort.status === 'OPEN',
      progression: row.cohort.progression,
      modules: row.cohort.program.modules,
    },
    module: row.module,
    enrollmentId: row.enrollmentId,
    assessment: row.assessmentAssignment
      ? {
          assignmentId: row.assessmentAssignment.id,
          title: row.assessmentAssignment.assessment.title,
        }
      : null,
    whatsappAt: row.whatsappAt?.toISOString() ?? null,
    billing: row.enrollment?.paymentPlan
      ? { overdue: row.enrollment.paymentPlan.installments.length }
      : null,
  }));
}

export async function countPendingRequests(institutionId: string): Promise<number> {
  const db = createTenantClient(institutionId);
  return db.accessRequest.count({ where: { status: 'PENDING' } });
}

/** Operación la descarta sin hacerla (no corresponde, ya se resolvió por fuera…). Audita. */
export async function dismissRequest({
  institutionId,
  actorId,
  requestId,
  now = new Date(),
}: {
  institutionId: string;
  actorId: string;
  requestId: string;
  now?: Date;
}): Promise<{ status: 'DISMISSED' }> {
  const db = createTenantClient(institutionId);
  const row = await db.accessRequest.findFirst({
    where: { id: requestId },
    select: {
      id: true,
      status: true,
      kind: true,
      personId: true,
      module: { select: { name: true } },
      cohort: { select: { program: { select: { name: true } } } },
      assessmentAssignment: { select: { assessment: { select: { title: true } } } },
    },
  });
  if (!row) throw new APIError('Not found', 'NOT_FOUND');
  if (row.status !== 'PENDING') throw new APIError('Esta solicitud ya está cerrada', 'CONFLICT');

  await db.$transaction(async (tx) => {
    await tx.accessRequest.update({
      where: { id: row.id },
      data: { status: 'DISMISSED', resolvedAt: now, resolvedById: actorId },
    });
    await tx.auditLog.create({
      data: {
        institutionId,
        actorId,
        entity: 'access_request',
        entityId: row.id,
        action: 'dismissed',
        after: { kind: row.kind, personId: row.personId },
        occurredAt: now,
      },
    });
  });

  // Sin esto el estudiante solo veía reaparecer el botón: que sepa que se cerró y qué hacer.
  const subject =
    row.kind === 'ENROLL'
      ? row.cohort.program.name
      : (row.assessmentAssignment?.assessment.title ?? row.module.name);
  await notify(institutionId, {
    personId: row.personId,
    type: 'request_dismissed',
    title: 'Tu solicitud se cerró',
    body: `El equipo cerró tu solicitud de ${subject}. Si todavía la necesitas, escríbenos o vuelve a pedirla.`,
    href: '/aprender',
    dedupeKey: `request_dismissed:${row.id}`,
  });
  return { status: 'DISMISSED' };
}
