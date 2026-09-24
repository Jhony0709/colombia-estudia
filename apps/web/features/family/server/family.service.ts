/**
 * El área del acudiente (Fase C, 23/9): lo que ve de cada pupilo, solo lectura.
 * SSOT: docs/plan-redefinicion-2009.md Fase C, reference/04-business-logic/acceso-y-cartera.md
 * (decisión 7, revisada), capabilities.ts `progress.read.ward`.
 *
 * No calcula nada propio: el avance sale de `getEnrollmentDetail` (la vista de operación
 * sobre esa matrícula, con el grado de entrada ya aplicado), las notas de
 * `getResultsForStudent` (la vista del propio estudiante, que respeta `reviewPolicy`: el
 * acudiente no ve una nota que el estudiante aún no puede ver) y la cartera de
 * `getAccount`. Lo que el acudiente ve es exactamente lo que ya existe, filtrado por lo que
 * sus alcances le dejan.
 */

import 'server-only';

import { scopeAllows, type Scope } from '@colombia-estudia/domain';
import { createTenantClient } from '@/lib/db/tenant';
import {
  getEnrollmentDetail,
  type EnrollmentDetail,
} from '@/features/cohorts/server/enrollment-detail.service';
import { getResultsForStudent } from '@/features/learn/server/attempt.service';
import { getAccount, type AccountView } from '@/features/billing/server/billing.service';

export interface WardSummary {
  enrollmentId: string;
  student: { id: string; name: string };
  cohort: { code: string; name: string; programName: string; status: string; startsOn: string };
  status: string;
  accessUntil: string;
  progress: { completed: number; total: number; percent: number };
  /**
   * Solo si el acudiente tiene `billing.read.own` sobre esta matrícula. `overdue` es el monto
   * vencido (pesos); `overdueCount`, cuántas cuotas (23/9: la portada decía «200.000 cuotas»).
   */
  account: { status: string | null; overdue: number; overdueCount: number } | null;
}

export interface WardDetail {
  enrollment: EnrollmentDetail;
  /** Por módulo: temas completados sobre asignados. */
  modules: Array<{ name: string; position: number; completed: number; total: number }>;
  /** Los exámenes de esta cohorte con la mejor nota que el estudiante puede ver. */
  assessments: Array<{
    title: string;
    moduleName: string;
    status: string;
    best: { percent: number; passed: boolean } | null;
  }>;
  /** Notas por asignatura de esta cohorte. */
  scores: Array<{ subjectName: string; value: number; updatedAt: string }>;
  account: AccountView | null;
}

const percent = (completed: number, total: number) =>
  total === 0 ? 0 : Math.round((completed / total) * 100);

/** Los ids de matrícula que un conjunto de alcances cubre uno a uno. */
export function enrollmentIdsOf(scopes: readonly Scope[]): string[] {
  return [...new Set(scopes.flatMap((s) => ('enrollmentId' in s ? [s.enrollmentId] : [])))];
}

export async function listWards({
  institutionId,
  wardScopes,
  billingScopes,
  now = new Date(),
}: {
  institutionId: string;
  wardScopes: readonly Scope[];
  billingScopes: readonly Scope[];
  now?: Date;
}): Promise<WardSummary[]> {
  const db = createTenantClient(institutionId);
  const ids = enrollmentIdsOf(wardScopes);
  if (ids.length === 0) return [];

  const rows = await db.enrollment.findMany({
    where: { id: { in: ids } },
    orderBy: [{ student: { familyName: 'asc' } }, { enrolledAt: 'desc' }],
    select: { id: true, cohortId: true },
  });

  const out: WardSummary[] = [];
  for (const row of rows) {
    const detail = await getEnrollmentDetail({
      institutionId,
      cohortId: row.cohortId,
      enrollmentId: row.id,
    });
    if (!detail) continue;
    const canBill = scopeAllows([...billingScopes], { enrollmentId: row.id });
    const account = canBill ? await getAccount({ institutionId, enrollmentId: row.id, now }) : null;
    out.push({
      enrollmentId: detail.id,
      student: detail.student,
      cohort: {
        code: detail.cohort.code,
        name: detail.cohort.name,
        programName: detail.cohort.programName,
        status: detail.cohort.status,
        startsOn: detail.cohort.startsOn,
      },
      status: detail.status,
      accessUntil: detail.accessUntil,
      progress: {
        ...detail.progress,
        percent: percent(detail.progress.completed, detail.progress.total),
      },
      account:
        canBill && account?.plan
          ? {
              status: account.status,
              overdue: account.summary.overdue,
              overdueCount: account.installments.filter((i) => i.overdue).length,
            }
          : null,
    });
  }
  return out;
}

export async function getWardDetail({
  institutionId,
  enrollmentId,
  wardScopes,
  billingScopes,
  now = new Date(),
}: {
  institutionId: string;
  enrollmentId: string;
  wardScopes: readonly Scope[];
  billingScopes: readonly Scope[];
  now?: Date;
}): Promise<WardDetail | null> {
  // El alcance decide, no el `where`: una matrícula existente pero ajena es «no existe».
  if (!scopeAllows([...wardScopes], { enrollmentId })) return null;

  const db = createTenantClient(institutionId);
  const row = await db.enrollment.findFirst({
    where: { id: enrollmentId },
    select: { cohortId: true, studentId: true },
  });
  if (!row) return null;

  const enrollment = await getEnrollmentDetail({
    institutionId,
    cohortId: row.cohortId,
    enrollmentId,
  });
  if (!enrollment) return null;

  const byModule = new Map<
    number,
    { name: string; position: number; completed: number; total: number }
  >();
  for (const lesson of enrollment.lessons) {
    const bucket = byModule.get(lesson.modulePosition) ?? {
      name: lesson.moduleName,
      position: lesson.modulePosition,
      completed: 0,
      total: 0,
    };
    bucket.total += 1;
    if (lesson.status === 'COMPLETED') bucket.completed += 1;
    byModule.set(lesson.modulePosition, bucket);
  }

  const results = await getResultsForStudent({ institutionId, personId: row.studentId, now });
  const code = enrollment.cohort.code;

  const canBill = scopeAllows([...billingScopes], { enrollmentId });
  const account = canBill ? await getAccount({ institutionId, enrollmentId, now }) : null;

  return {
    enrollment,
    modules: [...byModule.values()].sort((a, b) => a.position - b.position),
    assessments: results.assessments
      .filter((a) => a.cohortCode === code)
      .map((a) => ({ title: a.title, moduleName: a.moduleName, status: a.status, best: a.best })),
    scores: results.scores
      .filter((s) => s.cohortCode === code)
      .map(({ subjectName, value, updatedAt }) => ({ subjectName, value, updatedAt })),
    account: account?.plan ? account : null,
  };
}
