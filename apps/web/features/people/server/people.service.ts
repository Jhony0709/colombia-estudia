/**
 * People service: the operations list at /personas.
 * SSOT: plan/06-cohortes-y-personas.md:31-37 (§4 Personas), routes.md:51.
 *
 * The list carries no sensitive PII: name, masked email, roles, invitation state. The full
 * record is one audited click away (`GET /api/people/[personId]` → `person.pii_read`).
 */

import 'server-only';

import type { Role } from '@colombia-estudia/domain';
import {
  ROLES as ROLE_LIST,
  INVITATION_STATES as INVITATION_LIST,
  type InvitationState,
} from '@/lib/people/catalogs';
import { calculateAgeAt, dateOnly } from '@colombia-estudia/domain';
import { createTenantClient } from '@/lib/db/tenant';
import { byCodeOrId } from '@/lib/core/entity-code';
import { APIError } from '@/lib/core/errors';
import { maskEmail } from '@/lib/pii/mask';
import { toCsv } from '@/lib/csv/serialize';
import { listRecentActivity, type RecentActivity } from '@/lib/audit/recent-activity';
import {
  progressByEnrollment,
  type EnrollmentProgress,
} from '@/features/cohorts/server/progress.service';

export { toCsv };

const PAGE_SIZE = 50;

/**
 * Los catálogos se mudaron a `lib/people/catalogs.ts` porque el cliente los necesita y este
 * archivo es `server-only`. Se reexportan para no cambiar a quien ya los importaba de aquí.
 */
export { ROLES, INVITATION_STATES, type InvitationState } from '@/lib/people/catalogs';

export const PEOPLE_SORTS = ['nombre', 'reciente', 'avance'] as const;
export type PeopleSort = (typeof PEOPLE_SORTS)[number];
export const PAGE_SIZES = [20, 50, 100] as const;

export interface PeopleFilters {
  q: string;
  role: Role | null;
  invitation: InvitationState | null;
  /** `registro`: solo quien se dio de alta en `/registro` (1/11). */
  origin: 'registro' | null;
  page: number;
  /** `nombre`, `reciente` (alta más nueva primero) o `avance` (menos avance primero, 1/11). */
  sort: PeopleSort;
  pageSize: number;
}

export interface PersonRow {
  id: string;
  /** Código legible `PER-0001` (25/9). */
  code: string;
  givenName: string;
  familyName: string;
  emailMasked: string;
  roles: Role[];
  invitation: InvitationState;
  createdAt: Date;
  /** Se dio de alta sola en `/registro` (`AuditLog person.registered`). */
  registered: boolean;
  /** Avance de su matrícula principal: la activa más reciente, o la última. */
  progress: EnrollmentProgress | null;
  enrollmentCount: number;
}

export interface PeoplePage {
  rows: PersonRow[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

// ─────────────────────────── Pure helpers ───────────────────────────

/**
 * State of a person's invitations, as one word.
 *
 * Deliberately mirrors the SQL in `whereFor` below: accepted wins over everything, a live
 * token is pending, and anything else that exists at all is expired. If these two ever
 * disagree, the filter and the column would contradict each other on screen.
 */
export function deriveInvitationState(
  invitations: Array<{ acceptedAt: Date | null; expiresAt: Date }>,
  now: Date
): InvitationState {
  if (invitations.length === 0) return 'none';
  if (invitations.some((i) => i.acceptedAt !== null)) return 'accepted';
  if (invitations.some((i) => i.expiresAt > now)) return 'pending';
  return 'expired';
}

/** Reads the filters off the URL; anything unknown is simply not a filter. */
export function parsePeopleFilters(
  params: Record<string, string | string[] | undefined>
): PeopleFilters {
  const one = (key: string): string => {
    const value = params[key];
    return (Array.isArray(value) ? value[0] : value)?.trim() ?? '';
  };

  const role = one('rol').toUpperCase();
  const invitation = one('invitacion');
  const page = Number.parseInt(one('pagina'), 10);
  const sort = one('orden');
  const pageSize = Number.parseInt(one('mostrar'), 10);

  return {
    q: one('q').slice(0, 120),
    role: (ROLE_LIST as readonly string[]).includes(role) ? (role as Role) : null,
    invitation: (INVITATION_LIST as readonly string[]).includes(invitation)
      ? (invitation as InvitationState)
      : null,
    origin: one('origen') === 'registro' ? 'registro' : null,
    page: Number.isFinite(page) && page > 1 ? page : 1,
    sort: (PEOPLE_SORTS as readonly string[]).includes(sort) ? (sort as PeopleSort) : 'nombre',
    pageSize: (PAGE_SIZES as readonly number[]).includes(pageSize) ? pageSize : PAGE_SIZE,
  };
}

// ─────────────────────────── Queries ───────────────────────────

/** Quién se dio de alta en `/registro`: la única marca es su `AuditLog` (registration.service). */
async function registeredPersonIds(db: ReturnType<typeof createTenantClient>): Promise<string[]> {
  const rows = await db.auditLog.findMany({
    where: { entity: 'person', action: 'registered' },
    select: { entityId: true },
  });
  return rows.map((r) => r.entityId);
}

/** La matrícula que resume a la persona: la activa más reciente; si no hay, la última. */
export function mainEnrollmentId(
  enrollments: Array<{ id: string; status: string; enrolledAt: Date }>
): string | null {
  const recent = [...enrollments].sort((a, b) => b.enrolledAt.getTime() - a.enrolledAt.getTime());
  return (recent.find((e) => e.status === 'ACTIVE') ?? recent[0])?.id ?? null;
}

function whereFor(filters: PeopleFilters, now: Date, registered: readonly string[]) {
  const where: Record<string, unknown> = { anonymizedAt: null };
  if (filters.origin === 'registro') where.id = { in: [...registered] };

  if (filters.q) {
    where.OR = [
      { code: { contains: filters.q, mode: 'insensitive' } },
      { givenName: { contains: filters.q, mode: 'insensitive' } },
      { familyName: { contains: filters.q, mode: 'insensitive' } },
      { documentNumber: { contains: filters.q } },
      { email: { contains: filters.q, mode: 'insensitive' } },
    ];
  }

  if (filters.role) {
    where.memberships = { some: { role: filters.role, revokedAt: null } };
  }

  const accepted = { some: { acceptedAt: { not: null } } };
  const live = { some: { acceptedAt: null, expiresAt: { gt: now } } };

  switch (filters.invitation) {
    case 'accepted':
      where.invitations = accepted;
      break;
    case 'pending':
      where.AND = [{ invitations: live }, { NOT: { invitations: accepted } }];
      break;
    case 'expired':
      where.AND = [
        { invitations: { some: {} } },
        { NOT: { invitations: accepted } },
        { NOT: { invitations: live } },
      ];
      break;
    case 'none':
      where.invitations = { none: {} };
      break;
    default:
      break;
  }

  return where;
}

/** Con `orden=avance` se ordena en memoria: hasta aquí, el resto queda fuera del orden. */
const PROGRESS_SORT_LIMIT = 2000;

export async function listPeople({
  institutionId,
  filters,
  now = new Date(),
}: {
  institutionId: string;
  filters: PeopleFilters;
  now?: Date;
}): Promise<PeoplePage> {
  const db = createTenantClient(institutionId);
  const registered = await registeredPersonIds(db);
  const where = whereFor(filters, now, registered);
  const skip = (filters.page - 1) * filters.pageSize;
  const enrollmentsSelect = {
    where: { isPreview: false },
    select: { id: true, status: true, enrolledAt: true },
  } as const;
  const select = {
    id: true,
    code: true,
    givenName: true,
    familyName: true,
    email: true,
    createdAt: true,
    memberships: { where: { revokedAt: null }, select: { role: true } },
    invitations: { select: { acceptedAt: true, expiresAt: true } },
    enrollments: enrollmentsSelect,
  } as const;

  let total: number;
  let people;
  let progress: Map<string, EnrollmentProgress>;
  if (filters.sort === 'avance') {
    const [count, all] = await Promise.all([
      db.person.count({ where }),
      db.person.findMany({
        where,
        orderBy: [{ familyName: 'asc' }, { givenName: 'asc' }],
        take: PROGRESS_SORT_LIMIT,
        select: {
          id: true,
          enrollments: enrollmentsSelect,
          memberships: { where: { revokedAt: null, role: 'STUDENT' }, select: { role: true } },
        },
      }),
    ]);
    total = count;
    const mains = all.map((p) => ({
      id: p.id,
      main: mainEnrollmentId(p.enrollments),
      student: p.memberships.length > 0,
    }));
    progress = await progressByEnrollment({
      institutionId,
      enrollmentIds: mains.flatMap((m) => (m.main ? [m.main] : [])),
      now,
    });
    // Menos avance primero: un estudiante sin matrícula va antes que todos; el equipo, al final.
    const pct = (m: (typeof mains)[number]) =>
      m.main ? (progress.get(m.main)?.percent ?? 0) : m.student ? -1 : 101;
    const pageIds = mains
      .map((m, index) => ({ ...m, index }))
      .sort((a, b) => pct(a) - pct(b) || a.index - b.index)
      .slice(skip, skip + filters.pageSize)
      .map((m) => m.id);
    const rows = await db.person.findMany({ where: { id: { in: pageIds } }, select });
    people = pageIds.flatMap((id) => rows.filter((r) => r.id === id));
  } else {
    [total, people] = await Promise.all([
      db.person.count({ where }),
      db.person.findMany({
        where,
        orderBy:
          filters.sort === 'reciente'
            ? [{ createdAt: 'desc' }, { familyName: 'asc' }]
            : [{ familyName: 'asc' }, { givenName: 'asc' }],
        skip,
        take: filters.pageSize,
        select,
      }),
    ]);
    progress = await progressByEnrollment({
      institutionId,
      enrollmentIds: people.flatMap((p) => {
        const main = mainEnrollmentId(p.enrollments);
        return main ? [main] : [];
      }),
      now,
    });
  }

  const registeredSet = new Set(registered);
  return {
    rows: people.map((person) => {
      const main = mainEnrollmentId(person.enrollments);
      return {
        id: person.id,
        code: person.code,
        givenName: person.givenName,
        familyName: person.familyName,
        emailMasked: maskEmail(person.email),
        roles: person.memberships.map((m) => m.role),
        invitation: deriveInvitationState(person.invitations, now),
        createdAt: person.createdAt,
        registered: registeredSet.has(person.id),
        progress: main ? (progress.get(main) ?? null) : null,
        enrollmentCount: person.enrollments.length,
      };
    }),
    total,
    page: filters.page,
    pageSize: filters.pageSize,
    pageCount: Math.max(Math.ceil(total / filters.pageSize), 1),
  };
}

// ─────────────────────────── Indicadores y carril (19/9) ───────────────────────────

export interface PeopleStats {
  /** Personas no anonimizadas. */
  total: number;
  /** Con membresía STUDENT vigente. */
  students: number;
  /** Invitación viva y sin aceptar. */
  pendingInvitations: number;
  /** Con invitaciones, ninguna aceptada y ninguna viva. */
  expiredInvitations: number;
}

/**
 * Cuatro `count` sobre índices que ya existen. Solo el número actual: sin «vs. mes anterior»
 * hasta que AuditLog acumule histórico (decisión de Jhonny, 19/9).
 */
export async function getPeopleStats({
  institutionId,
  now = new Date(),
}: {
  institutionId: string;
  now?: Date;
}): Promise<PeopleStats> {
  const db = createTenantClient(institutionId);
  const base = { anonymizedAt: null };
  const accepted = { some: { acceptedAt: { not: null } } };
  const live = { some: { acceptedAt: null, expiresAt: { gt: now } } };
  const [total, students, pendingInvitations, expiredInvitations] = await Promise.all([
    db.person.count({ where: base }),
    db.person.count({
      where: { ...base, memberships: { some: { role: 'STUDENT', revokedAt: null } } },
    }),
    db.person.count({
      where: { ...base, AND: [{ invitations: live }, { NOT: { invitations: accepted } }] },
    }),
    db.person.count({
      where: {
        ...base,
        AND: [
          { invitations: { some: {} } },
          { NOT: { invitations: accepted } },
          { NOT: { invitations: live } },
        ],
      },
    }),
  ]);
  return { total, students, pendingInvitations, expiredInvitations };
}

export interface ExpiringInvitation {
  personId: string;
  /** Código legible de la persona, para el enlace a su ficha (25/9). */
  personCode: string;
  givenName: string;
  familyName: string;
  expiresAt: Date;
}

/** Invitaciones vivas que vencen en los próximos `days` días, las más urgentes primero. */
export async function listExpiringInvitations({
  institutionId,
  days = 7,
  take = 5,
  now = new Date(),
}: {
  institutionId: string;
  days?: number;
  take?: number;
  now?: Date;
}): Promise<ExpiringInvitation[]> {
  const db = createTenantClient(institutionId);
  const until = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
  const rows = await db.invitation.findMany({
    where: { acceptedAt: null, expiresAt: { gt: now, lte: until }, person: { anonymizedAt: null } },
    orderBy: { expiresAt: 'asc' },
    take,
    select: {
      personId: true,
      expiresAt: true,
      person: { select: { code: true, givenName: true, familyName: true } },
    },
  });
  return rows.map((r) => ({
    personId: r.personId,
    personCode: r.person.code,
    givenName: r.person.givenName,
    familyName: r.person.familyName,
    expiresAt: r.expiresAt,
  }));
}

export type PeopleActivity = RecentActivity;

const PEOPLE_ENTITIES = ['person', 'invitation', 'membership', 'guardianship', 'consent'] as const;

/** Lo último que pasó con personas. Sin `pii_read`: cada apertura de ficha se audita y taparía el resto. */
export function listRecentPeopleActivity({
  institutionId,
  take = 6,
}: {
  institutionId: string;
  take?: number;
}) {
  return listRecentActivity({
    institutionId,
    entities: PEOPLE_ENTITIES,
    excludeActions: ['pii_read'],
    take,
  });
}

/**
 * CSV of everything the current filter matches — not just the page on screen.
 *
 * This one carries real PII (document and email in the clear), which is the point: it is
 * what operations pastes into their spreadsheet. So it audits `person.pii_export` with the
 * filter and the row count. The plan only asks for an audit when opening a detail; a bulk
 * export of the same data without a trace would be the bigger hole.
 */
export async function exportPeople({
  institutionId,
  actorId,
  filters,
  now = new Date(),
}: {
  institutionId: string;
  actorId: string | null;
  filters: PeopleFilters;
  now?: Date;
}): Promise<string> {
  const db = createTenantClient(institutionId);
  const where = whereFor(filters, now, await registeredPersonIds(db));

  const people = await db.person.findMany({
    where,
    orderBy: [{ familyName: 'asc' }, { givenName: 'asc' }],
    select: {
      id: true,
      givenName: true,
      familyName: true,
      documentType: true,
      documentNumber: true,
      email: true,
      phone: true,
      memberships: { where: { revokedAt: null }, select: { role: true } },
      invitations: { select: { acceptedAt: true, expiresAt: true } },
    },
  });

  await db.auditLog.create({
    data: {
      institutionId,
      actorId,
      entity: 'person',
      entityId: 'export',
      action: 'pii_export',
      after: {
        count: people.length,
        filters: { q: filters.q, role: filters.role, invitation: filters.invitation },
      },
    },
  });

  return toCsv(
    [
      'documentType',
      'documentNumber',
      'givenName',
      'familyName',
      'email',
      'phone',
      'roles',
      'invitacion',
    ],
    people.map((person) => [
      person.documentType ?? '',
      person.documentNumber ?? '',
      person.givenName,
      person.familyName,
      person.email ?? '',
      person.phone ?? '',
      person.memberships.map((m) => m.role).join(' '),
      deriveInvitationState(person.invitations, now),
    ])
  );
}

// ─────────────────────────── Detail ───────────────────────────

/** De `PER-0001` o de un `cuid` al id y al código de la persona (25/9). Nulo si no existe. */
export async function resolvePerson({
  institutionId,
  ref,
}: {
  institutionId: string;
  ref: string;
}): Promise<{ id: string; code: string } | null> {
  const db = createTenantClient(institutionId);
  return db.person.findFirst({ where: byCodeOrId(ref), select: { id: true, code: true } });
}

export interface PersonDetail {
  id: string;
  /** Código legible `PER-0001` (25/9). */
  code: string;
  givenName: string;
  familyName: string;
  documentType: string | null;
  documentNumber: string | null;
  birthDate: string | null;
  isMinor: boolean;
  email: string | null;
  phone: string | null;
  roles: Role[];
  invitation: InvitationState;
  enrollments: Array<{
    id: string;
    cohortId: string;
    cohortCode: string;
    cohortName: string;
    status: string;
    accessUntil: string;
    /** Su avance (1/11), con las reglas de `/cohortes/[id]/avance`. */
    progress: EnrollmentProgress | null;
  }>;
  /** `hasAccount` (Fase C, 23/9): si el acudiente ya puede entrar a `/familia` o hay que invitarlo. */
  guardians: Array<{
    id: string;
    code: string;
    name: string;
    relationship: string;
    hasAccount: boolean;
  }>;
  wards: Array<{ id: string; name: string; relationship: string }>;
  /** Ley 1581: fecha de anonimización, si la hubo. La ficha lo dice y no ofrece nada más. */
  anonymizedAt: string | null;
  consents: Array<{
    id: string;
    policyVersion: string;
    channel: string;
    grantedAt: string;
    revokedAt: string | null;
    signedBy: string;
  }>;
}

const fullName = (p: { givenName: string; familyName: string }) => `${p.givenName} ${p.familyName}`;

/**
 * The full record, PII included — and therefore audited.
 *
 * `AuditLog person.pii_read` is written on every read, including the re-read that follows a
 * role change: it is a real read of the data, and an audit trail that quietly skips some of
 * them is worse than one with a few extra rows.
 */
export async function getPersonDetail({
  institutionId,
  actorId,
  personId,
  now = new Date(),
}: {
  institutionId: string;
  actorId: string | null;
  personId: string;
  now?: Date;
}): Promise<PersonDetail | null> {
  const db = createTenantClient(institutionId);

  const person = await db.person.findFirst({
    where: { id: personId },
    select: {
      id: true,
      code: true,
      givenName: true,
      familyName: true,
      documentType: true,
      documentNumber: true,
      birthDate: true,
      email: true,
      phone: true,
      anonymizedAt: true,
      memberships: { where: { revokedAt: null }, select: { role: true } },
      invitations: { select: { acceptedAt: true, expiresAt: true } },
      enrollments: {
        where: { isPreview: false },
        select: {
          id: true,
          status: true,
          accessUntil: true,
          cohort: { select: { id: true, code: true, name: true } },
        },
        orderBy: { enrolledAt: 'desc' },
      },
      guardians: {
        select: {
          relationship: true,
          guardian: {
            select: { id: true, code: true, givenName: true, familyName: true, authUserId: true },
          },
        },
      },
      guardianOf: {
        select: {
          relationship: true,
          student: { select: { id: true, code: true, givenName: true, familyName: true } },
        },
      },
      consentsAbout: {
        select: {
          id: true,
          policyVersion: true,
          channel: true,
          grantedAt: true,
          revokedAt: true,
          signedBy: { select: { givenName: true, familyName: true } },
        },
        orderBy: { grantedAt: 'desc' },
      },
    },
  });

  if (!person) return null;

  await db.auditLog.create({
    data: {
      institutionId,
      actorId,
      entity: 'person',
      entityId: personId,
      action: 'pii_read',
    },
  });

  const progress = await progressByEnrollment({
    institutionId,
    enrollmentIds: person.enrollments.map((e) => e.id),
    now,
  });

  return {
    id: person.id,
    code: person.code,
    givenName: person.givenName,
    familyName: person.familyName,
    documentType: person.documentType,
    documentNumber: person.documentNumber,
    birthDate: person.birthDate ? dateOnly(person.birthDate) : null,
    isMinor: person.birthDate ? calculateAgeAt(person.birthDate, now) < 18 : false,
    email: person.email,
    phone: person.phone,
    anonymizedAt: person.anonymizedAt ? person.anonymizedAt.toISOString() : null,
    roles: person.memberships.map((m) => m.role),
    invitation: deriveInvitationState(person.invitations, now),
    enrollments: person.enrollments.map((e) => ({
      id: e.id,
      cohortId: e.cohort.id,
      cohortCode: e.cohort.code,
      cohortName: e.cohort.name,
      status: e.status,
      accessUntil: dateOnly(e.accessUntil),
      progress: progress.get(e.id) ?? null,
    })),
    guardians: person.guardians.map((g) => ({
      id: g.guardian.id,
      code: g.guardian.code,
      name: fullName(g.guardian),
      relationship: g.relationship,
      hasAccount: g.guardian.authUserId !== null,
    })),
    wards: person.guardianOf.map((w) => ({
      id: w.student.id,
      code: w.student.code,
      name: fullName(w.student),
      relationship: w.relationship,
    })),
    consents: person.consentsAbout.map((c) => ({
      id: c.id,
      policyVersion: c.policyVersion,
      channel: c.channel,
      grantedAt: c.grantedAt.toISOString(),
      revokedAt: c.revokedAt ? c.revokedAt.toISOString() : null,
      signedBy: fullName(c.signedBy),
    })),
  };
}

// ─────────────────────────── Roles ───────────────────────────

/**
 * Granting or revoking ADMIN is not something `people.manage` should allow on its own.
 *
 * OPERATIONS holds `people.manage` (packages/domain/src/capabilities.ts:162-168), so without
 * this an operations account could grant itself ADMIN from this very screen. Touching the
 * ADMIN role additionally requires `institution.manage`, which only ADMIN has.
 */
export function roleChangeNeedsInstitutionManage(role: Role): boolean {
  return role === 'ADMIN';
}

export async function grantRole({
  institutionId,
  actorId,
  personId,
  role,
}: {
  institutionId: string;
  actorId: string | null;
  personId: string;
  role: Role;
}): Promise<{ granted: boolean }> {
  const db = createTenantClient(institutionId);

  return db.$transaction(async (tx) => {
    const person = await tx.person.findFirst({ where: { id: personId }, select: { id: true } });
    if (!person) {
      throw new APIError('Person not found', 'NOT_FOUND');
    }

    const existing = await tx.membership.findFirst({
      where: { personId, role, revokedAt: null },
      select: { id: true },
    });
    if (existing) {
      return { granted: false };
    }

    await tx.membership.create({ data: { institutionId, personId, role } });
    await tx.auditLog.create({
      data: {
        institutionId,
        actorId,
        entity: 'membership',
        entityId: personId,
        action: 'granted',
        after: { role },
      },
    });

    return { granted: true };
  });
}

export async function revokeRole({
  institutionId,
  actorId,
  personId,
  role,
}: {
  institutionId: string;
  actorId: string | null;
  personId: string;
  role: Role;
}): Promise<{ revoked: boolean }> {
  const db = createTenantClient(institutionId);

  return db.$transaction(async (tx) => {
    const active = await tx.membership.findMany({
      where: { personId, role, revokedAt: null },
      select: { id: true },
    });
    if (active.length === 0) {
      return { revoked: false };
    }

    // Removing the last ADMIN locks everyone out of the institution's own settings.
    if (role === 'ADMIN') {
      const admins = await tx.membership.count({
        where: { institutionId, role: 'ADMIN', revokedAt: null },
      });
      if (admins <= active.length) {
        throw new APIError(
          'No se puede revocar el último rol de administración de la institución',
          'CONFLICT'
        );
      }
    }

    await tx.membership.updateMany({
      where: { personId, role, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await tx.auditLog.create({
      data: {
        institutionId,
        actorId,
        entity: 'membership',
        entityId: personId,
        action: 'revoked',
        before: { role },
      },
    });

    return { revoked: true };
  });
}
