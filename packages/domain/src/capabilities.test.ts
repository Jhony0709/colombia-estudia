/**
 * Tests for capabilities.ts
 * SSOT: reference/04-business-logic/acceso-y-cartera.md §1
 *
 * Each row of the table is a test. Each rule in prose (§2, §4, §6, §8) is a test with the quote.
 */

import {
  resolveCapabilities,
  scopeAllows,
  type Capability,
  type EnrollmentWithPayerType,
  type ResolveCapabilitiesInput,
  type ResourceScope,
  type Scope,
} from './capabilities';
import type { Membership, PartnerContact } from './types';

// ─────────────────────────── Test Helpers ───────────────────────────

const NOW = new Date('2024-06-15T12:00:00Z');
const FUTURE = new Date('2025-06-15T12:00:00Z');
const PAST = new Date('2024-01-15T12:00:00Z');

function createMembership(role: Membership['role'], overrides?: Partial<Membership>): Membership {
  return {
    personId: 'person-1',
    institutionId: 'inst-1',
    role,
    revokedAt: null,
    ...overrides,
  };
}

function createEnrollment(overrides?: Partial<EnrollmentWithPayerType>): EnrollmentWithPayerType {
  return {
    id: 'enrollment-1',
    studentId: 'student-1',
    cohortId: 'cohort-1',
    status: 'ACTIVE',
    isMinorAtEnrollment: false,
    accessUntil: FUTURE,
    payerType: 'PERSON',
    ...overrides,
  };
}

function createPartnerContact(overrides?: Partial<PartnerContact>): PartnerContact {
  return {
    personId: 'person-1',
    partnerId: 'partner-1',
    ...overrides,
  };
}

function baseInput(overrides?: Partial<ResolveCapabilitiesInput>): ResolveCapabilitiesInput {
  return {
    memberships: [],
    enrollments: [],
    guardianships: [],
    partnerContactOf: [],
    accountStatusByEnrollment: new Map(),
    restrictionPolicy: null,
    now: NOW,
    ...overrides,
  };
}

function hasCapability(map: Map<Capability, Scope[]>, cap: Capability): boolean {
  return map.has(cap);
}

function getScopes(map: Map<Capability, Scope[]>, cap: Capability): Scope[] {
  return map.get(cap) ?? [];
}

// ─────────────────────────── §1 Table Rows ───────────────────────────

describe('capabilities.ts - §1 Table Rows', () => {
  describe('Row: lesson.read', () => {
    it('Estudiante con matrícula activa tiene lesson.read', () => {
      const result = resolveCapabilities(baseInput({ enrollments: [createEnrollment()] }));
      expect(hasCapability(result, 'lesson.read')).toBe(true);
    });

    it('Instructor tiene lesson.read', () => {
      const result = resolveCapabilities(
        baseInput({ memberships: [createMembership('INSTRUCTOR')] })
      );
      expect(hasCapability(result, 'lesson.read')).toBe(true);
    });

    it('Admin tiene lesson.read', () => {
      const result = resolveCapabilities(baseInput({ memberships: [createMembership('ADMIN')] }));
      expect(hasCapability(result, 'lesson.read')).toBe(true);
    });
  });

  describe('Row: lesson.progress.own', () => {
    it('Solo el estudiante de la matrícula tiene lesson.progress.own', () => {
      const result = resolveCapabilities(baseInput({ enrollments: [createEnrollment()] }));
      expect(hasCapability(result, 'lesson.progress.own')).toBe(true);
      const scopes = getScopes(result, 'lesson.progress.own');
      expect(scopes).toHaveLength(1);
      expect(scopes[0]).toEqual({ enrollmentId: 'enrollment-1' });
    });

    it('ADMIN NO tiene lesson.progress.own', () => {
      const result = resolveCapabilities(baseInput({ memberships: [createMembership('ADMIN')] }));
      expect(hasCapability(result, 'lesson.progress.own')).toBe(false);
    });
  });

  describe('Row: lesson.author', () => {
    it('Instructor tiene lesson.author', () => {
      const result = resolveCapabilities(
        baseInput({ memberships: [createMembership('INSTRUCTOR')] })
      );
      expect(hasCapability(result, 'lesson.author')).toBe(true);
    });

    it('Admin tiene lesson.author', () => {
      const result = resolveCapabilities(baseInput({ memberships: [createMembership('ADMIN')] }));
      expect(hasCapability(result, 'lesson.author')).toBe(true);
    });
  });

  describe('Row: lesson.publish', () => {
    it('ADMIN tiene lesson.publish', () => {
      const result = resolveCapabilities(baseInput({ memberships: [createMembership('ADMIN')] }));
      expect(hasCapability(result, 'lesson.publish')).toBe(true);
    });

    it('INSTRUCTOR NO tiene lesson.publish - AMBIGUO(acceso-y-cartera.md:33)', () => {
      const result = resolveCapabilities(
        baseInput({ memberships: [createMembership('INSTRUCTOR')] })
      );
      expect(hasCapability(result, 'lesson.publish')).toBe(false);
    });
  });

  describe('Row: assessment.take', () => {
    it('Estudiante con matrícula activa tiene assessment.take', () => {
      const result = resolveCapabilities(baseInput({ enrollments: [createEnrollment()] }));
      expect(hasCapability(result, 'assessment.take')).toBe(true);
    });

    it('ADMIN NO tiene assessment.take', () => {
      const result = resolveCapabilities(baseInput({ memberships: [createMembership('ADMIN')] }));
      expect(hasCapability(result, 'assessment.take')).toBe(false);
    });
  });

  describe('Row: assessment.grade', () => {
    it('Instructor tiene assessment.grade', () => {
      const result = resolveCapabilities(
        baseInput({ memberships: [createMembership('INSTRUCTOR')] })
      );
      expect(hasCapability(result, 'assessment.grade')).toBe(true);
    });

    it('Admin tiene assessment.grade', () => {
      const result = resolveCapabilities(baseInput({ memberships: [createMembership('ADMIN')] }));
      expect(hasCapability(result, 'assessment.grade')).toBe(true);
    });
  });

  describe('Row: progress.read.cohort', () => {
    it('Operations tiene progress.read.cohort', () => {
      const result = resolveCapabilities(
        baseInput({ memberships: [createMembership('OPERATIONS')] })
      );
      expect(hasCapability(result, 'progress.read.cohort')).toBe(true);
    });

    it('Admin tiene progress.read.cohort', () => {
      const result = resolveCapabilities(baseInput({ memberships: [createMembership('ADMIN')] }));
      expect(hasCapability(result, 'progress.read.cohort')).toBe(true);
    });

    it('Instructor tiene progress.read.cohort', () => {
      const result = resolveCapabilities(
        baseInput({ memberships: [createMembership('INSTRUCTOR')] })
      );
      expect(hasCapability(result, 'progress.read.cohort')).toBe(true);
    });

    it('Contacto de aliado tiene progress.read.cohort con scope partnerId', () => {
      const result = resolveCapabilities(baseInput({ partnerContactOf: [createPartnerContact()] }));
      expect(hasCapability(result, 'progress.read.cohort')).toBe(true);
      const scopes = getScopes(result, 'progress.read.cohort');
      expect(scopes).toContainEqual({ partnerId: 'partner-1' });
    });
  });

  describe('Row: progress.override', () => {
    it('Operations tiene progress.override', () => {
      const result = resolveCapabilities(
        baseInput({ memberships: [createMembership('OPERATIONS')] })
      );
      expect(hasCapability(result, 'progress.override')).toBe(true);
    });

    it('Admin tiene progress.override', () => {
      const result = resolveCapabilities(baseInput({ memberships: [createMembership('ADMIN')] }));
      expect(hasCapability(result, 'progress.override')).toBe(true);
    });
  });

  describe('Row: score.read.own', () => {
    it('Estudiante tiene score.read.own', () => {
      const result = resolveCapabilities(baseInput({ enrollments: [createEnrollment()] }));
      expect(hasCapability(result, 'score.read.own')).toBe(true);
    });

    it('ADMIN NO tiene score.read.own', () => {
      const result = resolveCapabilities(baseInput({ memberships: [createMembership('ADMIN')] }));
      expect(hasCapability(result, 'score.read.own')).toBe(false);
    });
  });

  describe('Row: accommodation.manage', () => {
    it('Coordinación de inclusión tiene accommodation.manage', () => {
      const result = resolveCapabilities(
        baseInput({ memberships: [createMembership('INCLUSION_COORDINATOR')] })
      );
      expect(hasCapability(result, 'accommodation.manage')).toBe(true);
    });

    it('Admin tiene accommodation.manage', () => {
      const result = resolveCapabilities(baseInput({ memberships: [createMembership('ADMIN')] }));
      expect(hasCapability(result, 'accommodation.manage')).toBe(true);
    });
  });

  describe('Row: billing.manage', () => {
    it('Operations tiene billing.manage', () => {
      const result = resolveCapabilities(
        baseInput({ memberships: [createMembership('OPERATIONS')] })
      );
      expect(hasCapability(result, 'billing.manage')).toBe(true);
    });

    it('Admin tiene billing.manage', () => {
      const result = resolveCapabilities(baseInput({ memberships: [createMembership('ADMIN')] }));
      expect(hasCapability(result, 'billing.manage')).toBe(true);
    });
  });

  describe('Row: billing.read.own', () => {
    it('Estudiante adulto con payerType PERSON tiene billing.read.own', () => {
      const result = resolveCapabilities(
        baseInput({
          enrollments: [createEnrollment({ isMinorAtEnrollment: false, payerType: 'PERSON' })],
        })
      );
      expect(hasCapability(result, 'billing.read.own')).toBe(true);
    });

    it('Contacto de aliado tiene billing.read.own con scope partnerId', () => {
      const result = resolveCapabilities(baseInput({ partnerContactOf: [createPartnerContact()] }));
      expect(hasCapability(result, 'billing.read.own')).toBe(true);
      const scopes = getScopes(result, 'billing.read.own');
      expect(scopes).toContainEqual({ partnerId: 'partner-1' });
    });

    it('ADMIN NO tiene billing.read.own', () => {
      const result = resolveCapabilities(baseInput({ memberships: [createMembership('ADMIN')] }));
      expect(hasCapability(result, 'billing.read.own')).toBe(false);
    });
  });

  describe('Row: people.manage', () => {
    it('Operations tiene people.manage', () => {
      const result = resolveCapabilities(
        baseInput({ memberships: [createMembership('OPERATIONS')] })
      );
      expect(hasCapability(result, 'people.manage')).toBe(true);
    });

    it('Admin tiene people.manage', () => {
      const result = resolveCapabilities(baseInput({ memberships: [createMembership('ADMIN')] }));
      expect(hasCapability(result, 'people.manage')).toBe(true);
    });
  });

  describe('Row: cohort.manage', () => {
    it('Operations tiene cohort.manage', () => {
      const result = resolveCapabilities(
        baseInput({ memberships: [createMembership('OPERATIONS')] })
      );
      expect(hasCapability(result, 'cohort.manage')).toBe(true);
    });

    it('Admin tiene cohort.manage', () => {
      const result = resolveCapabilities(baseInput({ memberships: [createMembership('ADMIN')] }));
      expect(hasCapability(result, 'cohort.manage')).toBe(true);
    });
  });

  describe('Row: institution.manage', () => {
    it('Admin tiene institution.manage', () => {
      const result = resolveCapabilities(baseInput({ memberships: [createMembership('ADMIN')] }));
      expect(hasCapability(result, 'institution.manage')).toBe(true);
    });

    it('Operations NO tiene institution.manage', () => {
      const result = resolveCapabilities(
        baseInput({ memberships: [createMembership('OPERATIONS')] })
      );
      expect(hasCapability(result, 'institution.manage')).toBe(false);
    });
  });
});

// ─────────────────────────── §2 Minor with OVERDUE ───────────────────────────

describe('capabilities.ts - §2 Minor with OVERDUE', () => {
  it('§2: menor con OVERDUE conserva lesson.read, assessment.take, score.read.own', () => {
    const result = resolveCapabilities(
      baseInput({
        enrollments: [createEnrollment({ isMinorAtEnrollment: true })],
        accountStatusByEnrollment: new Map([['enrollment-1', 'OVERDUE']]),
      })
    );

    // Minor OVERDUE still has academic access
    expect(hasCapability(result, 'lesson.read')).toBe(true);
    expect(hasCapability(result, 'assessment.take')).toBe(true);
    expect(hasCapability(result, 'score.read.own')).toBe(true);
  });

  it('OVERDUE no cambia ninguna capacidad para adulto', () => {
    const result = resolveCapabilities(
      baseInput({
        enrollments: [createEnrollment({ isMinorAtEnrollment: false })],
        accountStatusByEnrollment: new Map([['enrollment-1', 'OVERDUE']]),
      })
    );

    // Adult OVERDUE still has academic access (no suspension implemented)
    expect(hasCapability(result, 'lesson.read')).toBe(true);
    expect(hasCapability(result, 'assessment.take')).toBe(true);
    expect(hasCapability(result, 'score.read.own')).toBe(true);
  });
});

// ─────────────────────────── §8 Access Expired ───────────────────────────

describe('capabilities.ts - §8 Access Expired', () => {
  it('§8: acceso vencido pierde lesson.read y assessment.take y conserva score.read.own', () => {
    const result = resolveCapabilities(
      baseInput({
        enrollments: [createEnrollment({ accessUntil: PAST })],
      })
    );

    expect(hasCapability(result, 'lesson.read')).toBe(false);
    expect(hasCapability(result, 'assessment.take')).toBe(false);
    expect(hasCapability(result, 'score.read.own')).toBe(true);
  });
});

// ─────────────────────────── Enrollment Status ───────────────────────────

describe('capabilities.ts - Enrollment Status', () => {
  it('matrícula WITHDRAWN no da lesson.progress.own', () => {
    const result = resolveCapabilities(
      baseInput({
        enrollments: [createEnrollment({ status: 'WITHDRAWN' })],
      })
    );

    expect(hasCapability(result, 'lesson.progress.own')).toBe(false);
    // But still has score.read.own
    expect(hasCapability(result, 'score.read.own')).toBe(true);
  });

  it('matrícula COMPLETED no da lesson.progress.own - AMBIGUO(§8)', () => {
    const result = resolveCapabilities(
      baseInput({
        enrollments: [createEnrollment({ status: 'COMPLETED' })],
      })
    );

    expect(hasCapability(result, 'lesson.progress.own')).toBe(false);
    // Only score.read.own per AMBIGUO
    expect(hasCapability(result, 'lesson.read')).toBe(false);
    expect(hasCapability(result, 'assessment.take')).toBe(false);
    expect(hasCapability(result, 'score.read.own')).toBe(true);
  });
});

// ─────────────────────────── PARTNER_PAID ───────────────────────────

describe('capabilities.ts - PARTNER_PAID', () => {
  it('PARTNER_PAID: estudiante no tiene billing.read.own', () => {
    const result = resolveCapabilities(
      baseInput({
        enrollments: [createEnrollment({ payerType: 'PARTNER' })],
      })
    );

    expect(hasCapability(result, 'billing.read.own')).toBe(false);
  });

  it('PARTNER_PAID: contacto del aliado tiene billing.read.own con scope partnerId', () => {
    const result = resolveCapabilities(
      baseInput({
        partnerContactOf: [createPartnerContact()],
      })
    );

    expect(hasCapability(result, 'billing.read.own')).toBe(true);
    const scopes = getScopes(result, 'billing.read.own');
    expect(scopes).toContainEqual({ partnerId: 'partner-1' });
  });
});

// ─────────────────────────── Minor without billing ───────────────────────────

describe('capabilities.ts - Minor without billing', () => {
  it('Matrícula sin plan de pago (payerType null) → sin billing.read.own', () => {
    const caps = resolveCapabilities({
      ...baseInput(),
      enrollments: [createEnrollment({ isMinorAtEnrollment: false, payerType: null })],
    });
    expect(caps.has('billing.read.own')).toBe(false);
    expect(caps.has('lesson.read')).toBe(true);
  });

  it('Menor con payerType PERSON sin billing.read.own - AMBIGUO(§5, decision 7)', () => {
    const result = resolveCapabilities(
      baseInput({
        enrollments: [createEnrollment({ isMinorAtEnrollment: true, payerType: 'PERSON' })],
      })
    );

    expect(hasCapability(result, 'billing.read.own')).toBe(false);
  });
});

// ─────────────────────────── GUARDIAN ───────────────────────────

describe('capabilities.ts - GUARDIAN (Decision 7)', () => {
  it('GUARDIAN no obtiene nada académico (decisión 7)', () => {
    const result = resolveCapabilities(
      baseInput({
        memberships: [createMembership('GUARDIAN')],
        guardianships: [{ guardianId: 'person-1', studentId: 'student-1' }],
      })
    );

    expect(hasCapability(result, 'lesson.read')).toBe(false);
    expect(hasCapability(result, 'lesson.progress.own')).toBe(false);
    expect(hasCapability(result, 'assessment.take')).toBe(false);
    expect(hasCapability(result, 'score.read.own')).toBe(false);
    expect(result.size).toBe(0);
  });
});

// ─────────────────────────── INCLUSION_COORDINATOR ───────────────────────────

describe('capabilities.ts - INCLUSION_COORDINATOR', () => {
  it('INCLUSION_COORDINATOR tiene accommodation.manage y nada de cartera', () => {
    const result = resolveCapabilities(
      baseInput({
        memberships: [createMembership('INCLUSION_COORDINATOR')],
      })
    );

    expect(hasCapability(result, 'accommodation.manage')).toBe(true);
    expect(hasCapability(result, 'billing.manage')).toBe(false);
    expect(hasCapability(result, 'billing.read.own')).toBe(false);
    // Only accommodation.manage
    expect(result.size).toBe(1);
  });
});

// ─────────────────────────── Revoked Membership ───────────────────────────

describe('capabilities.ts - Revoked Membership', () => {
  it('Membership revocada no otorga capacidades', () => {
    const result = resolveCapabilities(
      baseInput({
        memberships: [createMembership('ADMIN', { revokedAt: PAST })],
      })
    );

    expect(result.size).toBe(0);
  });
});

// ─────────────────────────── scopeAllows ───────────────────────────

// ─────────────────────────── Date handling (Bogota) ───────────────────────────

describe('capabilities.ts - Date handling', () => {
  it('acceso válido todo el día de accessUntil', () => {
    // accessUntil = 2024-06-15 (midnight UTC, i.e. @db.Date)
    // now = 2024-06-15 23:00 UTC = 2024-06-15 18:00 COT (same day in Bogota)
    // Should still have access
    const accessUntil = new Date('2024-06-15T00:00:00.000Z');
    const now = new Date('2024-06-15T23:00:00.000Z');

    const result = resolveCapabilities(
      baseInput({
        enrollments: [createEnrollment({ accessUntil })],
        now,
      })
    );

    expect(hasCapability(result, 'lesson.read')).toBe(true);
    expect(hasCapability(result, 'assessment.take')).toBe(true);
  });

  it('acceso expira al día siguiente en Bogota', () => {
    // accessUntil = 2024-06-15 (midnight UTC)
    // now = 2024-06-16 06:00 UTC = 2024-06-16 01:00 COT (next day in Bogota)
    const accessUntil = new Date('2024-06-15T00:00:00.000Z');
    const now = new Date('2024-06-16T06:00:00.000Z');

    const result = resolveCapabilities(
      baseInput({
        enrollments: [createEnrollment({ accessUntil })],
        now,
      })
    );

    expect(hasCapability(result, 'lesson.read')).toBe(false);
    expect(hasCapability(result, 'assessment.take')).toBe(false);
    // But still has score.read.own
    expect(hasCapability(result, 'score.read.own')).toBe(true);
  });
});

// ─────────────────────────── Partner contact scopes ───────────────────────────

describe('capabilities.ts - Partner contact scopes', () => {
  it('contacto del aliado A ve {cohortId:c1,partnerId:A} y no {cohortId:c2,partnerId:B}', () => {
    const result = resolveCapabilities(
      baseInput({
        partnerContactOf: [createPartnerContact({ partnerId: 'partner-A' })],
      })
    );

    const progressScopes = getScopes(result, 'progress.read.cohort');
    const billingScopes = getScopes(result, 'billing.read.own');

    // Has scopes for partner A
    expect(progressScopes).toContainEqual({ partnerId: 'partner-A' });
    expect(billingScopes).toContainEqual({ partnerId: 'partner-A' });

    // scopeAllows with partner A resource
    expect(scopeAllows(progressScopes, { partnerId: 'partner-A' })).toBe(true);
    expect(scopeAllows(billingScopes, { partnerId: 'partner-A' })).toBe(true);

    // Does NOT allow partner B
    expect(scopeAllows(progressScopes, { partnerId: 'partner-B' })).toBe(false);
    expect(scopeAllows(billingScopes, { partnerId: 'partner-B' })).toBe(false);
  });
});

// ─────────────────────────── Multiple enrollments ───────────────────────────

describe('capabilities.ts - Multiple enrollments', () => {
  it('dos matrículas ACTIVE → dos scopes por capacidad', () => {
    const result = resolveCapabilities(
      baseInput({
        enrollments: [
          createEnrollment({ id: 'enrollment-1', cohortId: 'cohort-1' }),
          createEnrollment({ id: 'enrollment-2', cohortId: 'cohort-2' }),
        ],
      })
    );

    // lesson.read has two cohort scopes
    const lessonReadScopes = getScopes(result, 'lesson.read');
    expect(lessonReadScopes).toContainEqual({ cohortId: 'cohort-1' });
    expect(lessonReadScopes).toContainEqual({ cohortId: 'cohort-2' });
    expect(lessonReadScopes).toHaveLength(2);

    // lesson.progress.own has two enrollment scopes
    const progressScopes = getScopes(result, 'lesson.progress.own');
    expect(progressScopes).toContainEqual({ enrollmentId: 'enrollment-1' });
    expect(progressScopes).toContainEqual({ enrollmentId: 'enrollment-2' });
    expect(progressScopes).toHaveLength(2);
  });
});

// ─────────────────────────── scopeAllows ───────────────────────────

describe('scopeAllows', () => {
  it('institution scope covers everything', () => {
    const granted: Scope[] = [{ institution: true }];

    expect(scopeAllows(granted, { cohortId: 'cohort-1' })).toBe(true);
    expect(scopeAllows(granted, { enrollmentId: 'enrollment-1' })).toBe(true);
    expect(scopeAllows(granted, { partnerId: 'partner-1' })).toBe(true);
  });

  it('cohortId scope covers that cohort', () => {
    const granted: Scope[] = [{ cohortId: 'cohort-1' }];

    expect(scopeAllows(granted, { cohortId: 'cohort-1' })).toBe(true);
    expect(scopeAllows(granted, { cohortId: 'cohort-2' })).toBe(false);
  });

  it('cohortId scope covers enrollments in that cohort', () => {
    const granted: Scope[] = [{ cohortId: 'cohort-1' }];
    const resource: ResourceScope = { enrollmentId: 'enrollment-1', cohortId: 'cohort-1' };

    expect(scopeAllows(granted, resource)).toBe(true);
  });

  it('misma institución, otra cohorte → scopeAllows false', () => {
    const granted: Scope[] = [{ cohortId: 'cohort-1' }];
    const resource: ResourceScope = { enrollmentId: 'enrollment-1', cohortId: 'cohort-2' };

    expect(scopeAllows(granted, resource)).toBe(false);
  });

  it('enrollmentId scope covers only that enrollment', () => {
    const granted: Scope[] = [{ enrollmentId: 'enrollment-1' }];

    expect(scopeAllows(granted, { enrollmentId: 'enrollment-1' })).toBe(true);
    expect(scopeAllows(granted, { enrollmentId: 'enrollment-2' })).toBe(false);
    expect(scopeAllows(granted, { cohortId: 'cohort-1' })).toBe(false);
  });

  it('partnerId scope covers only that partner', () => {
    const granted: Scope[] = [{ partnerId: 'partner-1' }];

    expect(scopeAllows(granted, { partnerId: 'partner-1' })).toBe(true);
    expect(scopeAllows(granted, { partnerId: 'partner-2' })).toBe(false);
  });

  it('multiple scopes: any match returns true', () => {
    const granted: Scope[] = [{ cohortId: 'cohort-1' }, { cohortId: 'cohort-2' }];

    expect(scopeAllows(granted, { cohortId: 'cohort-1' })).toBe(true);
    expect(scopeAllows(granted, { cohortId: 'cohort-2' })).toBe(true);
    expect(scopeAllows(granted, { cohortId: 'cohort-3' })).toBe(false);
  });

  it('empty granted scopes returns false', () => {
    expect(scopeAllows([], { cohortId: 'cohort-1' })).toBe(false);
  });
});
