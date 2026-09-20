/**
 * Constancias de finalización (módulo y programa).
 * SSOT: plan/08-aprender-y-evaluar.md:85-94 (§6), endpoints.md:48-49,81, prisma `Certificate`,
 * packages/domain `isEnrollmentCompleted`.
 *
 * Lo que es y lo que no es: una **constancia de finalización** que emite la plataforma
 * sola cuando la regla del dominio dice que el módulo (o el programa) está completo. **No es
 * el título de bachiller**: ese lo expide quien tiene la autorización legal, fuera de aquí,
 * y el pie de cada constancia lo dice. Nunca se condiciona a la cartera
 * (acceso-y-cartera.md §2): la mora no toca lo académico.
 *
 * `issueDueCertificates` es idempotente y lo llama el job diario (Fase 5) y, mientras
 * tanto, la pantalla del estudiante al abrirse: emitir dos veces la misma es imposible por
 * el `@@unique` (módulo) y el índice parcial (programa), y lo que ya existe se salta.
 *
 * `code`: 10 caracteres de un alfabeto sin 0/O/1/I. Es público y se dicta por teléfono.
 */

import 'server-only';

import { randomInt } from 'node:crypto';
import { isEnrollmentCompleted, type ModuleInput } from '@colombia-estudia/domain';
import { createTenantClient, prisma } from '@/lib/db/tenant';
import { APIError } from '@/lib/core/errors';
import { notify } from '@/features/notifications/server/notifications.service';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 10;

export function generateCertificateCode(): string {
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i++) code += ALPHABET[randomInt(ALPHABET.length)];
  return code;
}

/** Lo que acepta la verificación pública: mayúsculas del alfabeto, sin espacios ni guiones. */
export function normalizeCertificateCode(raw: string): string | null {
  const code = raw.toUpperCase().replace(/[\s-]/g, '');
  return code.length === CODE_LENGTH && [...code].every((c) => ALPHABET.includes(c)) ? code : null;
}

export interface CertificateView {
  id: string;
  code: string;
  kind: 'MODULE' | 'PROGRAM';
  moduleName: string | null;
  programName: string;
  cohortCode: string;
  issuedAt: string;
  revokedAt: string | null;
}

/** La verificación pública: sin más PII que el nombre (endpoints.md:49). */
export interface PublicCertificate {
  code: string;
  kind: 'MODULE' | 'PROGRAM';
  studentName: string;
  moduleName: string | null;
  programName: string;
  institutionName: string;
  issuedAt: string;
  status: 'VALID' | 'REVOKED';
}

const view = (c: {
  id: string;
  code: string;
  kind: string;
  issuedAt: Date;
  revokedAt: Date | null;
  module: { name: string } | null;
  enrollment: { cohort: { code: string; program: { name: string } } };
}): CertificateView => ({
  id: c.id,
  code: c.code,
  kind: c.kind as 'MODULE' | 'PROGRAM',
  moduleName: c.module?.name ?? null,
  programName: c.enrollment.cohort.program.name,
  cohortCode: c.enrollment.cohort.code,
  issuedAt: c.issuedAt.toISOString(),
  revokedAt: c.revokedAt ? c.revokedAt.toISOString() : null,
});

const CERT_SELECT = {
  id: true,
  code: true,
  kind: true,
  issuedAt: true,
  revokedAt: true,
  module: { select: { name: true } },
  enrollment: {
    select: { cohort: { select: { code: true, program: { select: { name: true } } } } },
  },
} as const;

// ─────────────────────────── emisión ───────────────────────────

/**
 * Emite lo que toque para una matrícula `ACTIVE`: constancia de cada módulo completo que no
 * la tenga y, si el programa entero está completo, `COMPLETED` + constancia de programa.
 * Devuelve cuántas emitió.
 */
export async function issueDueCertificatesForEnrollment({
  institutionId,
  enrollmentId,
  now = new Date(),
}: {
  institutionId: string;
  enrollmentId: string;
  now?: Date;
}): Promise<{ issued: number; completed: boolean }> {
  const db = createTenantClient(institutionId);

  const e = await db.enrollment.findFirst({
    where: { id: enrollmentId, status: 'ACTIVE' },
    select: {
      id: true,
      studentId: true,
      cohort: {
        select: {
          id: true,
          progression: true,
          program: {
            select: {
              id: true,
              modules: {
                where: { archivedAt: null },
                select: { id: true, position: true, name: true },
              },
            },
          },
          lessonAssignments: {
            select: {
              id: true,
              lesson: { select: { id: true, title: true, position: true, moduleId: true } },
              progress: { where: { enrollmentId }, select: { status: true } },
            },
          },
          assessmentAssignments: {
            select: {
              id: true,
              assessment: {
                select: { id: true, title: true, position: true, kind: true, moduleId: true },
              },
              assessmentVersion: { select: { passPercent: true, maxAttempts: true } },
              attempts: {
                where: { enrollmentId },
                select: { status: true, score: true, maxScore: true },
              },
            },
          },
        },
      },
      accommodation: { select: { allowedAttemptsBonus: true } },
      certificates: { select: { kind: true, moduleId: true } },
    },
  });
  if (!e) return { issued: 0, completed: false };

  const bonus = e.accommodation?.allowedAttemptsBonus ?? 0;
  const assessmentInput = (a: (typeof e.cohort.assessmentAssignments)[number]) => ({
    id: a.assessment.id,
    position: a.assessment.position,
    title: a.assessment.title,
    kind: a.assessment.kind as 'DIAGNOSTIC' | 'SUBJECT' | 'FINAL',
    passPercent: a.assessmentVersion.passPercent,
    attemptsAllowed: a.assessmentVersion.maxAttempts + bonus,
    attempts: a.attempts.map((t) => ({
      status: t.status as 'IN_PROGRESS' | 'SUBMITTED' | 'EXPIRED' | 'GRADED',
      score: t.score ? t.score.toNumber() : 0,
      maxScore: t.maxScore ? t.maxScore.toNumber() : 0,
    })),
  });

  // Solo cuentan los módulos con algo asignado en esta cohorte: un módulo del programa sin
  // temas ni evaluaciones asignados no se puede «completar», y tampoco debe bloquear.
  const modules: ModuleInput[] = e.cohort.program.modules
    .map((m) => ({
      id: m.id,
      position: m.position,
      name: m.name,
      lessons: e.cohort.lessonAssignments
        .filter((a) => a.lesson.moduleId === m.id)
        .map((a) => ({
          id: a.lesson.id,
          position: a.lesson.position,
          title: a.lesson.title,
          progressStatus: (a.progress[0]?.status ?? 'NOT_STARTED') as
            'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED',
        })),
      assessments: e.cohort.assessmentAssignments
        .filter((a) => a.assessment.moduleId === m.id)
        .map(assessmentInput),
    }))
    .filter((m) => m.lessons.length > 0 || m.assessments.length > 0);

  const programAssessments = e.cohort.assessmentAssignments
    .filter((a) => a.assessment.moduleId === null)
    .map(assessmentInput);

  const progression = e.cohort.progression as 'LINEAR' | 'FREE';
  const has = (kind: 'MODULE' | 'PROGRAM', moduleId: string | null) =>
    e.certificates.some((c) => c.kind === kind && c.moduleId === moduleId);

  let issued = 0;
  const issuedCodes: Array<{ code: string; label: string }> = [];

  for (const m of modules) {
    if (has('MODULE', m.id)) continue;
    // Un módulo está completo cuando, mirado solo, cumple la regla de finalización.
    if (!isEnrollmentCompleted({ progression, modules: [m] })) continue;
    const code = generateCertificateCode();
    await db.certificate.create({
      data: { institutionId, enrollmentId, kind: 'MODULE', moduleId: m.id, code, issuedAt: now },
    });
    await db.auditLog.create({
      data: {
        institutionId,
        actorId: null,
        entity: 'certificate',
        entityId: code,
        action: 'issued',
        after: { kind: 'MODULE', moduleId: m.id, enrollmentId },
        occurredAt: now,
      },
    });
    issued++;
    issuedCodes.push({ code, label: m.name });
  }

  let completed = false;
  if (
    modules.length > 0 &&
    !has('PROGRAM', null) &&
    isEnrollmentCompleted({ progression, modules, programAssessments })
  ) {
    const code = generateCertificateCode();
    await db.$transaction(async (tx) => {
      await tx.certificate.create({
        data: { institutionId, enrollmentId, kind: 'PROGRAM', moduleId: null, code, issuedAt: now },
      });
      await tx.enrollment.update({
        where: { id: enrollmentId },
        data: { status: 'COMPLETED', completedAt: now },
      });
      await tx.auditLog.createMany({
        data: [
          {
            institutionId,
            actorId: null,
            entity: 'certificate',
            entityId: code,
            action: 'issued',
            after: { kind: 'PROGRAM', enrollmentId },
            occurredAt: now,
          },
          {
            institutionId,
            actorId: null,
            entity: 'enrollment',
            entityId: enrollmentId,
            action: 'completed',
            before: { status: 'ACTIVE' },
            after: { status: 'COMPLETED', completedAt: now.toISOString() },
            occurredAt: now,
          },
        ],
      });
    });
    issued++;
    completed = true;
    issuedCodes.push({ code, label: 'programa' });
  }

  for (const c of issuedCodes) {
    await notify(institutionId, {
      personId: e.studentId,
      type: 'certificate_issued',
      title: 'Tienes una constancia nueva',
      body: `Se emitió tu constancia de ${c.label}. Puedes verla y compartirla desde «Constancias».`,
      href: '/aprender/certificados',
      dedupeKey: `certificate_issued:${c.code}`,
    });
  }

  return { issued, completed };
}

/** Todas las matrículas activas de la institución: es lo que corre el job diario. */
export async function issueDueCertificates({
  institutionId,
  now = new Date(),
}: {
  institutionId: string;
  now?: Date;
}): Promise<{ issued: number; completedEnrollments: number }> {
  const db = createTenantClient(institutionId);
  const active = await db.enrollment.findMany({
    where: { status: 'ACTIVE' },
    select: { id: true },
  });
  let issued = 0;
  let completedEnrollments = 0;
  for (const e of active) {
    const r = await issueDueCertificatesForEnrollment({ institutionId, enrollmentId: e.id, now });
    issued += r.issued;
    if (r.completed) completedEnrollments++;
  }
  return { issued, completedEnrollments };
}

// ─────────────────────────── consulta ───────────────────────────

export async function listCertificatesForStudent({
  institutionId,
  personId,
}: {
  institutionId: string;
  personId: string;
}): Promise<CertificateView[]> {
  const db = createTenantClient(institutionId);
  const rows = await db.certificate.findMany({
    where: { enrollment: { studentId: personId } },
    orderBy: { issuedAt: 'desc' },
    select: CERT_SELECT,
  });
  return rows.map(view);
}

/**
 * Verificación pública por código. Sin tenant en la URL: el código es único en toda la
 * base, así que se busca con el cliente base y se devuelve el nombre de la institución.
 */
export async function getPublicCertificate(rawCode: string): Promise<PublicCertificate | null> {
  const code = normalizeCertificateCode(rawCode);
  if (!code) return null;
  const c = await prisma.certificate.findUnique({
    where: { code },
    select: {
      code: true,
      kind: true,
      issuedAt: true,
      revokedAt: true,
      module: { select: { name: true } },
      institution: { select: { name: true } },
      enrollment: {
        select: {
          student: { select: { givenName: true, familyName: true } },
          cohort: { select: { program: { select: { name: true } } } },
        },
      },
    },
  });
  if (!c) return null;
  return {
    code: c.code,
    kind: c.kind as 'MODULE' | 'PROGRAM',
    studentName: `${c.enrollment.student.givenName} ${c.enrollment.student.familyName}`,
    moduleName: c.module?.name ?? null,
    programName: c.enrollment.cohort.program.name,
    institutionName: c.institution.name,
    issuedAt: c.issuedAt.toISOString(),
    status: c.revokedAt ? 'REVOKED' : 'VALID',
  };
}

export async function revokeCertificate({
  institutionId,
  actorId,
  certificateId,
  reason,
  now = new Date(),
}: {
  institutionId: string;
  actorId: string;
  certificateId: string;
  reason: string;
  now?: Date;
}): Promise<CertificateView> {
  const db = createTenantClient(institutionId);
  const existing = await db.certificate.findFirst({
    where: { id: certificateId },
    select: { id: true, code: true, revokedAt: true },
  });
  if (!existing) throw new APIError('Not found', 'NOT_FOUND');
  if (existing.revokedAt) throw new APIError('Esta constancia ya está revocada', 'CONFLICT');

  const row = await db.$transaction(async (tx) => {
    const updated = await tx.certificate.update({
      where: { id: existing.id },
      data: { revokedAt: now, revokeReason: reason },
      select: CERT_SELECT,
    });
    await tx.auditLog.create({
      data: {
        institutionId,
        actorId,
        entity: 'certificate',
        entityId: existing.code,
        action: 'revoked',
        after: { reason },
        occurredAt: now,
      },
    });
    return updated;
  });
  return view(row);
}

/** Las constancias de una matrícula, para el detalle de staff (y revocar). */
export async function listCertificatesForEnrollment({
  institutionId,
  enrollmentId,
}: {
  institutionId: string;
  enrollmentId: string;
}): Promise<CertificateView[]> {
  const db = createTenantClient(institutionId);
  const rows = await db.certificate.findMany({
    where: { enrollmentId },
    orderBy: { issuedAt: 'desc' },
    select: CERT_SELECT,
  });
  return rows.map(view);
}
