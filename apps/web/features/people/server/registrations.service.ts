/**
 * Embudo del registro público (1/11): quién se dio de alta en `/registro` y hasta dónde llegó —
 * empezó la Introducción, la terminó, pidió un componente de pago, quedó matriculado en uno—.
 *
 * El alta se lee del `AuditLog person.registered` (registration.service), que es la única marca.
 * La Introducción es cualquier programa gratuito y «de pago» cualquier programa `PAID`, sin
 * depender de cuál sea hoy la cohorte de introducción. El avance sale de `progressByEnrollment`,
 * el mismo cálculo de `/cohortes/[id]/avance`.
 */

import 'server-only';

import { createTenantClient } from '@/lib/db/tenant';
import {
  progressByEnrollment,
  type EnrollmentProgress,
} from '@/features/cohorts/server/progress.service';

export const REGISTRATION_PERIODS = [7, 30, 90, 0] as const;
export type RegistrationPeriod = (typeof REGISTRATION_PERIODS)[number];

export const REGISTRATION_STEPS = [
  'registered',
  'startedIntro',
  'finishedIntro',
  'requested',
  'enrolled',
] as const;
export type RegistrationStep = (typeof REGISTRATION_STEPS)[number];

export interface RegistrationRow {
  personId: string;
  code: string;
  name: string;
  /** ISO */
  registeredAt: string;
  step: RegistrationStep;
  intro: EnrollmentProgress | null;
  paid: { cohortCode: string; programName: string } | null;
}

export interface RegistrationFunnel {
  /** ISO, o `null` con «todo». */
  since: string | null;
  steps: Array<{ step: RegistrationStep; people: number }>;
  rows: RegistrationRow[];
  /** La tabla muestra hasta `ROW_LIMIT`; el embudo cuenta a todos. */
  truncated: boolean;
}

const ROW_LIMIT = 300;

export function parseRegistrationPeriod(value: string | string[] | undefined): RegistrationPeriod {
  const n = Number.parseInt(Array.isArray(value) ? (value[0] ?? '') : (value ?? ''), 10);
  return (REGISTRATION_PERIODS as readonly number[]).includes(n) ? (n as RegistrationPeriod) : 30;
}

/** Lo que hizo cada persona, sin orden obligado: se cuenta cada paso por separado. */
export interface RegistrationFacts {
  startedIntro: boolean;
  finishedIntro: boolean;
  requested: boolean;
  enrolled: boolean;
}

/** El paso más avanzado que dio. */
export function furthestStep(facts: RegistrationFacts): RegistrationStep {
  if (facts.enrolled) return 'enrolled';
  if (facts.requested) return 'requested';
  if (facts.finishedIntro) return 'finishedIntro';
  if (facts.startedIntro) return 'startedIntro';
  return 'registered';
}

export function introFacts(intro: EnrollmentProgress | null): {
  startedIntro: boolean;
  finishedIntro: boolean;
} {
  if (!intro) return { startedIntro: false, finishedIntro: false };
  const done = intro.evidenceCompleted + intro.manualCompleted;
  return {
    startedIntro: intro.lastActivityAt !== null || done > 0,
    finishedIntro: intro.status === 'COMPLETED' || (intro.assigned > 0 && done >= intro.assigned),
  };
}

export async function getRegistrationFunnel({
  institutionId,
  period,
  now = new Date(),
}: {
  institutionId: string;
  period: RegistrationPeriod;
  now?: Date;
}): Promise<RegistrationFunnel> {
  const db = createTenantClient(institutionId);
  const since = period === 0 ? null : new Date(now.getTime() - period * 24 * 3600 * 1000);

  const logs = await db.auditLog.findMany({
    where: {
      entity: 'person',
      action: 'registered',
      ...(since ? { occurredAt: { gte: since } } : {}),
    },
    orderBy: { occurredAt: 'desc' },
    select: { entityId: true, occurredAt: true },
  });
  const registeredAt = new Map<string, Date>();
  for (const log of logs)
    if (!registeredAt.has(log.entityId)) registeredAt.set(log.entityId, log.occurredAt);
  const ids = [...registeredAt.keys()];

  const [people, requests] = await Promise.all([
    db.person.findMany({
      where: { id: { in: ids }, anonymizedAt: null },
      select: {
        id: true,
        code: true,
        givenName: true,
        familyName: true,
        enrollments: {
          where: { isPreview: false },
          orderBy: { enrolledAt: 'desc' },
          select: {
            id: true,
            cohort: { select: { code: true, program: { select: { name: true, pricing: true } } } },
          },
        },
      },
    }),
    db.accessRequest.findMany({
      where: { personId: { in: ids }, kind: 'ENROLL' },
      select: { personId: true },
    }),
  ]);

  const introOf = new Map(
    people.flatMap((p) => {
      const intro = p.enrollments.find((e) => e.cohort.program.pricing !== 'PAID');
      return intro ? [[p.id, intro.id] as const] : [];
    })
  );
  const progress = await progressByEnrollment({
    institutionId,
    enrollmentIds: [...introOf.values()],
    now,
  });
  const asked = new Set(requests.map((r) => r.personId));

  const all = people
    .map((p) => {
      const introId = introOf.get(p.id);
      const intro = introId ? (progress.get(introId) ?? null) : null;
      const paid = p.enrollments.find((e) => e.cohort.program.pricing === 'PAID') ?? null;
      const facts: RegistrationFacts = {
        ...introFacts(intro),
        requested: asked.has(p.id),
        enrolled: paid !== null,
      };
      return {
        facts,
        row: {
          personId: p.id,
          code: p.code,
          name: `${p.familyName}, ${p.givenName}`,
          registeredAt: registeredAt.get(p.id)!.toISOString(),
          step: furthestStep(facts),
          intro,
          paid: paid
            ? { cohortCode: paid.cohort.code, programName: paid.cohort.program.name }
            : null,
        } satisfies RegistrationRow,
      };
    })
    .sort((a, b) => b.row.registeredAt.localeCompare(a.row.registeredAt));

  const count = (key: keyof RegistrationFacts) => all.filter((x) => x.facts[key]).length;
  return {
    since: since ? since.toISOString() : null,
    steps: [
      { step: 'registered', people: all.length },
      { step: 'startedIntro', people: count('startedIntro') },
      { step: 'finishedIntro', people: count('finishedIntro') },
      { step: 'requested', people: count('requested') },
      { step: 'enrolled', people: count('enrolled') },
    ],
    rows: all.slice(0, ROW_LIMIT).map((x) => x.row),
    truncated: all.length > ROW_LIMIT,
  };
}
