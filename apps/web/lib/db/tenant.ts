/**
 * Tenant-scoped Prisma client
 *
 * SSOT: reference/05-database/schema.md
 *
 * This module provides a tenant-isolated Prisma client that automatically
 * injects institutionId into all queries. This is the ONLY way to access
 * the database from features and routes.
 *
 * Rules:
 * - Every table (except Institution) has institutionId
 * - Every query is scoped to the current tenant
 * - Forgetting to scope is impossible with this client
 */

import { PrismaClient } from '@prisma/client';
import { prisma } from './prisma';

/**
 * Tables that require tenant isolation.
 * These are all tables except Institution itself.
 */
export const TENANT_SCOPED_MODELS = [
  'Person',
  'Membership',
  'Guardianship',
  'Consent',
  'Partner',
  'Program',
  'Module',
  'Subject',
  'Cohort',
  'Enrollment',
  'Lesson',
  'LessonVersion',
  'LessonVersionAsset',
  'Assessment',
  'AssessmentVersion',
  'LessonAssignment',
  'AssessmentAssignment',
  'MediaAsset',
  'LessonProgress',
  'Attempt',
  'Score',
  'LearningEvent',
  'Accommodation',
  'PaymentPlan',
  'Installment',
  'Payment',
  'PaymentAgreement',
  'RestrictionPolicy',
  'LiveSession',
  'Submission',
  'Certificate',
  'ImportRun',
  'AuditLog',
  'Notification',
  'Invitation',
] as const;

type TenantScopedModel = (typeof TENANT_SCOPED_MODELS)[number];

/**
 * Check if a model requires tenant scoping.
 */
function isTenantScoped(model: string): model is TenantScopedModel {
  return TENANT_SCOPED_MODELS.includes(model as TenantScopedModel);
}

/**
 * Operations that need where clause scoping.
 */
const READ_OPS = new Set([
  'findFirst',
  'findFirstOrThrow',
  'findUnique',
  'findUniqueOrThrow',
  'findMany',
  'count',
  'aggregate',
  'groupBy',
]);

const UPDATE_OPS = new Set(['update', 'updateMany', 'delete', 'deleteMany']);

// Helper types for args
interface ArgsWithWhere {
  where?: Record<string, unknown>;
}

interface ArgsWithData {
  data?: Record<string, unknown> | Record<string, unknown>[];
}

interface ArgsWithCreate {
  create?: Record<string, unknown>;
}

interface ArgsWithUpdate {
  update?: Record<string, unknown>;
}

/**
 * Pure function to scope args for a given operation.
 * Injects institutionId into the appropriate place in args.
 *
 * @param operation - The Prisma operation name
 * @param model - The model name
 * @param args - The operation args
 * @param institutionId - The institution ID to scope to
 * @returns The scoped args (mutates the original)
 */
export function scopeArgs<T extends Record<string, unknown>>(
  operation: string,
  model: string,
  args: T,
  institutionId: string
): T {
  if (!isTenantScoped(model)) {
    return args;
  }

  // Read and update operations: inject into where
  if (READ_OPS.has(operation) || UPDATE_OPS.has(operation)) {
    const typedArgs = args as unknown as ArgsWithWhere;
    typedArgs.where = { ...typedArgs.where, institutionId };
  }

  // Create operations: inject into data
  if (operation === 'create') {
    const typedArgs = args as unknown as ArgsWithData;
    if (typedArgs.data && !Array.isArray(typedArgs.data)) {
      typedArgs.data = { ...typedArgs.data, institutionId };
    }
  }

  // CreateMany: inject into each item
  if (operation === 'createMany') {
    const typedArgs = args as unknown as ArgsWithData;
    if (typedArgs.data) {
      if (Array.isArray(typedArgs.data)) {
        typedArgs.data = typedArgs.data.map((item) => ({
          ...item,
          institutionId,
        }));
      } else {
        typedArgs.data = { ...typedArgs.data, institutionId };
      }
    }
  }

  // Upsert: inject into where and create
  if (operation === 'upsert') {
    const typedArgs = args as unknown as ArgsWithWhere & ArgsWithCreate & ArgsWithUpdate;
    typedArgs.where = { ...typedArgs.where, institutionId };
    if (typedArgs.create) {
      typedArgs.create = { ...typedArgs.create, institutionId };
    }
  }

  return args;
}

/**
 * Create a tenant-scoped Prisma client.
 *
 * This client automatically injects institutionId into all queries,
 * making it impossible to accidentally leak data between tenants.
 *
 * @param institutionId - The institution ID to scope all queries to
 * @returns A Prisma client that only operates within the given institution
 *
 * @example
 * ```ts
 * const db = createTenantClient(institutionId);
 * const students = await db.person.findMany(); // automatically filtered by institutionId
 * ```
 */
export function createTenantClient(institutionId: string) {
  return prisma.$extends({
    name: 'tenant-isolation',
    query: {
      $allModels: {
        async findFirst({ model, args, query }) {
          scopeArgs('findFirst', model, args, institutionId);
          return query(args);
        },
        async findFirstOrThrow({ model, args, query }) {
          scopeArgs('findFirstOrThrow', model, args, institutionId);
          return query(args);
        },
        async findUnique({ model, args, query }) {
          scopeArgs('findUnique', model, args, institutionId);
          return query(args);
        },
        async findUniqueOrThrow({ model, args, query }) {
          scopeArgs('findUniqueOrThrow', model, args, institutionId);
          return query(args);
        },
        async findMany({ model, args, query }) {
          scopeArgs('findMany', model, args, institutionId);
          return query(args);
        },
        async count({ model, args, query }) {
          scopeArgs('count', model, args, institutionId);
          return query(args);
        },
        async aggregate({ model, args, query }) {
          scopeArgs('aggregate', model, args, institutionId);
          return query(args);
        },
        async groupBy({ model, args, query }) {
          scopeArgs('groupBy', model, args, institutionId);
          return query(args);
        },
        async create({ model, args, query }) {
          scopeArgs('create', model, args, institutionId);
          return query(args);
        },
        async createMany({ model, args, query }) {
          scopeArgs('createMany', model, args, institutionId);
          return query(args);
        },
        async update({ model, args, query }) {
          scopeArgs('update', model, args, institutionId);
          return query(args);
        },
        async updateMany({ model, args, query }) {
          scopeArgs('updateMany', model, args, institutionId);
          return query(args);
        },
        async upsert({ model, args, query }) {
          scopeArgs('upsert', model, args, institutionId);
          return query(args);
        },
        async delete({ model, args, query }) {
          scopeArgs('delete', model, args, institutionId);
          return query(args);
        },
        async deleteMany({ model, args, query }) {
          scopeArgs('deleteMany', model, args, institutionId);
          return query(args);
        },
      },
    },
  }) as unknown as PrismaClient;
}

/**
 * Type for the tenant-scoped client.
 */
export type TenantClient = ReturnType<typeof createTenantClient>;

/**
 * Get all tenant-scoped model names.
 * Used by the tenant isolation test to verify coverage.
 */
export function getTenantScopedModels(): readonly string[] {
  return TENANT_SCOPED_MODELS;
}

export { prisma };
