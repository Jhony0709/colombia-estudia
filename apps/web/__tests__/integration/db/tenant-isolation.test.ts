/**
 * Tenant Isolation Integration Tests
 *
 * Verifies that the tenant-scoped Prisma client properly isolates
 * data between institutions. This is a critical security test.
 *
 * Coverage: All 35 tenant-scoped models from TENANT_SCOPED_MODELS
 *
 * Run with: set -a; source .env; set +a; RUN_DB_TESTS=1 pnpm --filter @colombia-estudia/web test:integration
 */

import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { createTenantClient, TENANT_SCOPED_MODELS } from '@/lib/db/tenant';
import { factories } from '../../factories';

// Skip if RUN_DB_TESTS is not set
const describeWithDb = process.env.RUN_DB_TESTS === '1' ? describe : describe.skip;

// Models with composite primary keys (no single `id` field)
const COMPOSITE_KEY_MODELS = ['LessonVersionAsset'] as const;

// Models with bigint id
const BIGINT_ID_MODELS = ['LearningEvent', 'AuditLog'] as const;

/**
 * Entity identifier - can be string, bigint, or composite key.
 */
type EntityId = string | bigint | Record<string, string>;

/**
 * Static map of parent models for each tenant-scoped model.
 * Used to create the minimum dependency graph needed for testing.
 * Order matters: parents are created first.
 */
const PARENTS: Record<string, readonly string[]> = {
  Person: [],
  Membership: ['Person'],
  Guardianship: ['Person'],
  Consent: ['Person'],
  Partner: [],
  Program: [],
  Module: ['Program'],
  Subject: [],
  Cohort: ['Program'],
  Enrollment: ['Person', 'Cohort'],
  Lesson: ['Program', 'Module', 'Subject', 'Person'],
  LessonVersion: ['Lesson'],
  LessonVersionAsset: ['LessonVersion', 'MediaAsset'],
  Assessment: ['Program', 'Person'],
  AssessmentVersion: ['Assessment'],
  LessonAssignment: ['Cohort', 'Lesson', 'LessonVersion'],
  AssessmentAssignment: ['Cohort', 'Assessment', 'AssessmentVersion'],
  MediaAsset: ['Person'],
  LessonProgress: ['Enrollment', 'LessonAssignment'],
  Attempt: ['Enrollment', 'AssessmentAssignment'],
  Score: ['Enrollment', 'Subject', 'Cohort'],
  LearningEvent: ['Person'],
  Accommodation: ['Enrollment'],
  PaymentPlan: ['Enrollment'],
  Installment: ['PaymentPlan'],
  Payment: ['Installment'],
  PaymentAgreement: ['Enrollment'],
  RestrictionPolicy: ['Person'],
  LiveSession: ['Cohort', 'Person'],
  Submission: ['Enrollment', 'LessonAssignment'],
  Certificate: ['Enrollment'],
  ImportRun: ['Person'],
  AuditLog: [],
  Notification: ['Person'],
  Invitation: ['Person'],
} as const;

/**
 * Topological sort for cleanup: delete children before parents.
 * Returns models in reverse dependency order.
 */
function reverseTopologicalOrder(models: readonly string[]): string[] {
  const visited = new Set<string>();
  const result: string[] = [];

  function visit(model: string): void {
    if (visited.has(model)) return;
    visited.add(model);

    // Visit all models that depend on this one first
    for (const other of models) {
      const parents = PARENTS[other] ?? [];
      if (parents.includes(model)) {
        visit(other);
      }
    }

    result.push(model);
  }

  for (const model of models) {
    visit(model);
  }

  return result;
}

// Order for cleanup: children first
const CLEANUP_ORDER = reverseTopologicalOrder(TENANT_SCOPED_MODELS);

/**
 * Graph context: holds all created entities for an institution.
 */
interface GraphContext {
  institutionId: string;
  entities: Map<string, { id: EntityId }>;
}

/**
 * Get delegate name from model name.
 */
function getDelegateName(model: string): string {
  return model.charAt(0).toLowerCase() + model.slice(1);
}

/**
 * Get a delegate from prisma client.
 */
function getDelegate(client: unknown, model: string): unknown {
  return (client as Record<string, unknown>)[getDelegateName(model)];
}

/**
 * Check if model has composite key.
 */
function hasCompositeKey(model: string): boolean {
  return COMPOSITE_KEY_MODELS.includes(model as (typeof COMPOSITE_KEY_MODELS)[number]);
}

/**
 * Check if model has bigint id.
 */
function hasBigIntId(model: string): boolean {
  return BIGINT_ID_MODELS.includes(model as (typeof BIGINT_ID_MODELS)[number]);
}

/**
 * Extract entity id from created entity.
 */
function extractEntityId(model: string, entity: Record<string, unknown>): EntityId {
  if (model === 'LessonVersionAsset') {
    return {
      lessonVersionId: entity.lessonVersionId as string,
      mediaAssetId: entity.mediaAssetId as string,
    };
  }
  return entity.id as EntityId;
}

/**
 * Compare two entity ids for equality.
 */
function entityIdsEqual(a: EntityId, b: EntityId): boolean {
  if (typeof a === 'string' && typeof b === 'string') {
    return a === b;
  }
  if (typeof a === 'bigint' && typeof b === 'bigint') {
    return a === b;
  }
  if (typeof a === 'object' && typeof b === 'object') {
    const aKeys = Object.keys(a);
    const bKeys = Object.keys(b);
    if (aKeys.length !== bKeys.length) return false;
    return aKeys.every((key) => a[key] === b[key]);
  }
  return false;
}

/**
 * Convert entity id to string for display/comparison.
 */
function entityIdToString(id: EntityId): string {
  if (typeof id === 'bigint') {
    return id.toString();
  }
  if (typeof id === 'object') {
    return JSON.stringify(id);
  }
  return id;
}

/**
 * Creates an entity and all its required parents for a given model.
 * Uses memoization to avoid creating duplicates.
 */
async function createGraphFor(
  model: string,
  ctx: GraphContext,
  db: typeof prisma
): Promise<{ id: EntityId }> {
  // Return cached entity if already created
  const cached = ctx.entities.get(model);
  if (cached) return cached;

  // First create all parents
  const parents = PARENTS[model] ?? [];
  for (const parent of parents) {
    await createGraphFor(parent, ctx, db);
  }

  // Now create the entity itself using the factory
  const rawEntity = await createEntity(model, ctx, db);
  const entity = { id: extractEntityId(model, rawEntity as Record<string, unknown>) };
  ctx.entities.set(model, entity);

  return entity;
}

/**
 * Creates a single entity using its factory.
 */
async function createEntity(model: string, ctx: GraphContext, db: typeof prisma): Promise<unknown> {
  const { institutionId, entities } = ctx;

  const getPerson = () => entities.get('Person')?.id as string;
  const getProgram = () => entities.get('Program')?.id as string;
  const getModule = () => entities.get('Module')?.id as string;
  const getSubject = () => entities.get('Subject')?.id as string;
  const getCohort = () => entities.get('Cohort')?.id as string;
  const getEnrollment = () => entities.get('Enrollment')?.id as string;
  const getLesson = () => entities.get('Lesson')?.id as string;
  const getLessonVersion = () => entities.get('LessonVersion')?.id as string;
  const getAssessment = () => entities.get('Assessment')?.id as string;
  const getAssessmentVersion = () => entities.get('AssessmentVersion')?.id as string;
  const getLessonAssignment = () => entities.get('LessonAssignment')?.id as string;
  const getAssessmentAssignment = () => entities.get('AssessmentAssignment')?.id as string;
  const getMediaAsset = () => entities.get('MediaAsset')?.id as string;
  const getPaymentPlan = () => entities.get('PaymentPlan')?.id as string;
  const getInstallment = () => entities.get('Installment')?.id as string;

  switch (model) {
    case 'Person':
      return factories.person.create(db, institutionId);

    case 'Membership':
      return factories.membership.create(db, institutionId, getPerson());

    case 'Guardianship': {
      // Need two different people for guardian and student
      const guardian = await factories.person.create(db, institutionId);
      const student = await factories.person.create(db, institutionId);
      return factories.guardianship.create(db, institutionId, guardian.id, student.id);
    }

    case 'Consent':
      return factories.consent.create(db, institutionId, getPerson(), getPerson());

    case 'Partner':
      return factories.partner.create(db, institutionId);

    case 'Program':
      return factories.program.create(db, institutionId);

    case 'Module':
      return factories.module.create(db, institutionId, getProgram(), 1);

    case 'Subject':
      return factories.subject.create(db, institutionId);

    case 'Cohort':
      return factories.cohort.create(db, institutionId, getProgram());

    case 'Enrollment':
      return factories.enrollment.create(db, institutionId, getPerson(), getCohort());

    case 'Lesson':
      return factories.lesson.create(
        db,
        institutionId,
        getProgram(),
        getModule(),
        getSubject(),
        getPerson(),
        1
      );

    case 'LessonVersion':
      return factories.lessonVersion.create(db, institutionId, getLesson(), 1);

    case 'LessonVersionAsset':
      return factories.lessonVersionAsset.create(
        db,
        institutionId,
        getLessonVersion(),
        getMediaAsset()
      );

    case 'Assessment':
      return factories.assessment.create(db, institutionId, getProgram(), getPerson());

    case 'AssessmentVersion':
      return factories.assessmentVersion.create(db, institutionId, getAssessment(), 1);

    case 'LessonAssignment':
      return factories.lessonAssignment.create(
        db,
        institutionId,
        getCohort(),
        getLesson(),
        getLessonVersion(),
        getPerson()
      );

    case 'AssessmentAssignment':
      return factories.assessmentAssignment.create(
        db,
        institutionId,
        getCohort(),
        getAssessment(),
        getAssessmentVersion(),
        getPerson()
      );

    case 'MediaAsset':
      return factories.mediaAsset.create(db, institutionId, getPerson());

    case 'LessonProgress':
      return factories.lessonProgress.create(
        db,
        institutionId,
        getEnrollment(),
        getPerson(),
        getLessonAssignment(),
        getLessonVersion()
      );

    case 'Attempt':
      return factories.attempt.create(
        db,
        institutionId,
        getEnrollment(),
        getPerson(),
        getAssessmentAssignment(),
        getAssessmentVersion(),
        1
      );

    case 'Score':
      return factories.score.create(
        db,
        institutionId,
        getEnrollment(),
        getPerson(),
        getSubject(),
        getCohort()
      );

    case 'LearningEvent':
      return factories.learningEvent.create(db, institutionId, getPerson());

    case 'Accommodation':
      return factories.accommodation.create(
        db,
        institutionId,
        getPerson(),
        getEnrollment(),
        getPerson()
      );

    case 'PaymentPlan':
      return factories.paymentPlan.create(db, institutionId, getEnrollment());

    case 'Installment':
      return factories.installment.create(db, institutionId, getPaymentPlan(), 1);

    case 'Payment':
      return factories.payment.create(db, institutionId, getInstallment());

    case 'PaymentAgreement':
      return factories.paymentAgreement.create(db, institutionId, getEnrollment());

    case 'RestrictionPolicy':
      return factories.restrictionPolicy.create(db, institutionId, getPerson());

    case 'LiveSession':
      return factories.liveSession.create(db, institutionId, getCohort(), getPerson());

    case 'Submission':
      return factories.submission.create(db, institutionId, getEnrollment(), getLessonAssignment());

    case 'Certificate':
      return factories.certificate.create(db, institutionId, getEnrollment());

    case 'ImportRun':
      return factories.importRun.create(db, institutionId, getPerson());

    case 'AuditLog':
      return factories.auditLog.create(db, institutionId);

    case 'Notification':
      return factories.notification.create(db, institutionId, getPerson());

    case 'Invitation':
      return factories.invitation.create(db, institutionId, getPerson(), getPerson());

    default:
      throw new Error(`Unknown model: ${model}`);
  }
}

/**
 * Deletes all rows of an institution, children before parents.
 * PARENTS only lists the parents the factories need, not every FK (e.g. LessonProgress.studentId),
 * so a single pass can hit an FK error; we retry up to three passes and only then surface the error,
 * instead of swallowing it and leaving rows behind (which broke re-runs: the slugs collided).
 */
async function cleanupInstitution(institutionId: string): Promise<void> {
  let lastError: unknown = null;
  for (let pass = 0; pass < 3; pass++) {
    lastError = null;
    for (const model of CLEANUP_ORDER) {
      const delegate = getDelegate(prisma, model) as {
        deleteMany: (args: { where: { institutionId: string } }) => Promise<unknown>;
      };
      try {
        await delegate.deleteMany({ where: { institutionId } });
      } catch (error) {
        lastError = error;
      }
    }
    if (!lastError) return;
  }
  throw lastError;
}

const TEST_SLUG_PREFIX = 'test-iso-';

/** Hook timeout: the whole graph (35 models x 2 institutions) is built against staging. */
const GRAPH_TIMEOUT_MS = 120_000;

describeWithDb('Tenant Isolation', () => {
  let institutionA: Awaited<ReturnType<typeof factories.institution.create>>;
  let institutionB: Awaited<ReturnType<typeof factories.institution.create>>;
  let ctxA: GraphContext;
  let ctxB: GraphContext;

  beforeAll(async () => {
    // Rows left by a previous run that died before afterAll (only our own prefix).
    const stale = await prisma.institution.findMany({
      where: { slug: { startsWith: TEST_SLUG_PREFIX } },
      select: { id: true },
    });
    for (const { id } of stale) {
      await cleanupInstitution(id);
      await prisma.institution.delete({ where: { id } });
    }

    const run = Date.now().toString(36);
    institutionA = await factories.institution.create(prisma, {
      slug: `${TEST_SLUG_PREFIX}a-${run}`,
    });
    institutionB = await factories.institution.create(prisma, {
      slug: `${TEST_SLUG_PREFIX}b-${run}`,
    });

    // ONE graph per institution, shared by every model block. Building a graph per block
    // (the previous version) created ~15 cohorts per institution and collided on
    // @@unique([institutionId, code]) (schema.prisma:348), so most blocks failed in beforeAll.
    ctxA = { institutionId: institutionA.id, entities: new Map() };
    ctxB = { institutionId: institutionB.id, entities: new Map() };
    for (const model of TENANT_SCOPED_MODELS) {
      await createGraphFor(model, ctxA, prisma);
      await createGraphFor(model, ctxB, prisma);
    }
  }, GRAPH_TIMEOUT_MS);

  afterAll(async () => {
    try {
      if (institutionA) await cleanupInstitution(institutionA.id);
      if (institutionB) await cleanupInstitution(institutionB.id);
      await prisma.institution.deleteMany({
        where: { id: { in: [institutionA?.id, institutionB?.id].filter(Boolean) as string[] } },
      });
    } finally {
      await prisma.$disconnect();
    }
  }, GRAPH_TIMEOUT_MS);

  describe('TENANT_SCOPED_MODELS coverage', () => {
    it('matches Prisma model count minus Institution', () => {
      const dmmfModels = Prisma.dmmf.datamodel.models.map((m) => m.name);
      const expectedTenantModels = dmmfModels.filter((m) => m !== 'Institution');

      const missingModels = expectedTenantModels.filter(
        (m) => !TENANT_SCOPED_MODELS.includes(m as (typeof TENANT_SCOPED_MODELS)[number])
      );
      const extraModels = TENANT_SCOPED_MODELS.filter((m) => !expectedTenantModels.includes(m));

      expect(missingModels).toEqual([]);
      expect(extraModels).toEqual([]);
      expect(TENANT_SCOPED_MODELS.length).toBe(expectedTenantModels.length);
    });
  });

  describe('PARENTS coverage', () => {
    it.each(TENANT_SCOPED_MODELS)('%s has entry in PARENTS', (model) => {
      expect(PARENTS).toHaveProperty(model);
    });
  });

  describe.each(TENANT_SCOPED_MODELS)('Tenant isolation: %s', (model) => {
    const entityA = () => ctxA.entities.get(model)!;
    const entityB = () => ctxB.entities.get(model)!;

    it('graph has a row for this model in both institutions', () => {
      expect(ctxA.entities.get(model)).toBeDefined();
      expect(ctxB.entities.get(model)).toBeDefined();
    });

    it('findMany from A returns only A rows, including its own', async () => {
      const dbA = createTenantClient(institutionA.id);
      const delegate = getDelegate(dbA, model) as {
        findMany: () => Promise<Record<string, unknown>[]>;
      };

      const results = await delegate.findMany();
      const resultIds = results.map((r) => extractEntityId(model, r));

      expect(results.every((r) => r.institutionId === institutionA.id)).toBe(true);
      expect(resultIds.some((id) => entityIdsEqual(id, entityA().id))).toBe(true);
      expect(resultIds.some((id) => entityIdsEqual(id, entityB().id))).toBe(false);
    });

    it('count from A equals findMany length from A', async () => {
      const dbA = createTenantClient(institutionA.id);
      const delegate = getDelegate(dbA, model) as {
        count: () => Promise<number>;
        findMany: () => Promise<unknown[]>;
      };

      const count = await delegate.count();
      const rows = await delegate.findMany();
      expect(count).toBeGreaterThanOrEqual(1);
      expect(count).toBe(rows.length);
    });

    it('findUnique by B id from A returns null', async () => {
      if (hasCompositeKey(model) || hasBigIntId(model)) {
        return;
      }

      const dbA = createTenantClient(institutionA.id);
      const delegate = getDelegate(dbA, model) as {
        findUnique: (args: { where: { id: string } }) => Promise<unknown | null>;
      };

      const result = await delegate.findUnique({ where: { id: entityB().id as string } });
      expect(result).toBeNull();
    });

    it('update by B id from A throws P2025', async () => {
      if (hasCompositeKey(model) || hasBigIntId(model)) {
        return;
      }

      const dbA = createTenantClient(institutionA.id);
      const delegate = getDelegate(dbA, model) as {
        update: (args: {
          where: { id: string };
          data: Record<string, unknown>;
        }) => Promise<unknown>;
      };

      await expect(
        delegate.update({ where: { id: entityB().id as string }, data: {} })
      ).rejects.toThrow(/P2025|Record to update not found/);
    });

    it('deleteMany from A does not delete B row', async () => {
      if (hasCompositeKey(model) || hasBigIntId(model)) {
        return;
      }

      const dbA = createTenantClient(institutionA.id);
      const dbB = createTenantClient(institutionB.id);

      const delegateB = getDelegate(dbB, model) as {
        findMany: () => Promise<Record<string, unknown>[]>;
      };
      const beforeIds = (await delegateB.findMany()).map((r) => extractEntityId(model, r));

      const delegateA = getDelegate(dbA, model) as {
        deleteMany: (args: { where: { id: string } }) => Promise<{ count: number }>;
      };
      const result = await delegateA.deleteMany({ where: { id: entityB().id as string } });
      expect(result.count).toBe(0);

      const afterIds = (await delegateB.findMany()).map((r) => extractEntityId(model, r));
      expect(afterIds.some((id) => entityIdsEqual(id, entityB().id))).toBe(true);
      expect(afterIds.length).toBe(beforeIds.length);
    });
  });
});
