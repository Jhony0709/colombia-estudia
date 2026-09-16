/**
 * Unit tests for scopeArgs function
 *
 * Tests the pure function that injects institutionId into Prisma args.
 * No database connection required.
 */

import { scopeArgs, TENANT_SCOPED_MODELS } from '@/lib/db/tenant';

describe('scopeArgs', () => {
  const institutionId = 'test-institution-id';

  describe('read operations (inject into where)', () => {
    it('findFirst should inject institutionId into where', () => {
      const args = { where: { name: 'test' } };
      scopeArgs('findFirst', 'Person', args, institutionId);
      expect(args.where).toEqual({ name: 'test', institutionId });
    });

    it('findFirstOrThrow should inject institutionId into where', () => {
      const args = { where: { email: 'test@example.com' } };
      scopeArgs('findFirstOrThrow', 'Person', args, institutionId);
      expect(args.where).toEqual({ email: 'test@example.com', institutionId });
    });

    it('findUnique should inject institutionId into where', () => {
      const args = { where: { id: 'some-id' } };
      scopeArgs('findUnique', 'Person', args, institutionId);
      expect(args.where).toEqual({ id: 'some-id', institutionId });
    });

    it('findUniqueOrThrow should inject institutionId into where', () => {
      const args = { where: { id: 'some-id' } };
      scopeArgs('findUniqueOrThrow', 'Person', args, institutionId);
      expect(args.where).toEqual({ id: 'some-id', institutionId });
    });

    it('findMany should inject institutionId into where', () => {
      const args = { where: { role: 'STUDENT' } };
      scopeArgs('findMany', 'Membership', args, institutionId);
      expect(args.where).toEqual({ role: 'STUDENT', institutionId });
    });

    it('findMany with empty args should create where with institutionId', () => {
      const args = {};
      scopeArgs('findMany', 'Person', args, institutionId);
      expect((args as { where: unknown }).where).toEqual({ institutionId });
    });

    it('count should inject institutionId into where', () => {
      const args = { where: {} };
      scopeArgs('count', 'Person', args, institutionId);
      expect(args.where).toEqual({ institutionId });
    });

    it('aggregate should inject institutionId into where', () => {
      const args = { where: {}, _count: true };
      scopeArgs('aggregate', 'Payment', args, institutionId);
      expect(args.where).toEqual({ institutionId });
    });

    it('groupBy should inject institutionId into where', () => {
      const args = { where: {}, by: ['status'] };
      scopeArgs('groupBy', 'Enrollment', args, institutionId);
      expect(args.where).toEqual({ institutionId });
    });
  });

  describe('write operations with where (inject into where)', () => {
    it('update should inject institutionId into where', () => {
      const args = { where: { id: 'some-id' }, data: { name: 'new name' } };
      scopeArgs('update', 'Person', args, institutionId);
      expect(args.where).toEqual({ id: 'some-id', institutionId });
    });

    it('updateMany should inject institutionId into where', () => {
      const args = { where: { role: 'STUDENT' }, data: { role: 'INSTRUCTOR' } };
      scopeArgs('updateMany', 'Membership', args, institutionId);
      expect(args.where).toEqual({ role: 'STUDENT', institutionId });
    });

    it('delete should inject institutionId into where', () => {
      const args = { where: { id: 'some-id' } };
      scopeArgs('delete', 'Person', args, institutionId);
      expect(args.where).toEqual({ id: 'some-id', institutionId });
    });

    it('deleteMany should inject institutionId into where', () => {
      const args = { where: { revokedAt: { not: null } } };
      scopeArgs('deleteMany', 'Membership', args, institutionId);
      expect(args.where).toEqual({ revokedAt: { not: null }, institutionId });
    });
  });

  describe('create operations (inject into data)', () => {
    it('create should inject institutionId into data', () => {
      const args = { data: { givenName: 'Test', familyName: 'User' } };
      scopeArgs('create', 'Person', args, institutionId);
      expect(args.data).toEqual({ givenName: 'Test', familyName: 'User', institutionId });
    });

    it('createMany with array should inject institutionId into each item', () => {
      const args = {
        data: [
          { givenName: 'User1', familyName: 'Test' },
          { givenName: 'User2', familyName: 'Test' },
        ],
      };
      scopeArgs('createMany', 'Person', args, institutionId);
      expect(args.data).toEqual([
        { givenName: 'User1', familyName: 'Test', institutionId },
        { givenName: 'User2', familyName: 'Test', institutionId },
      ]);
    });

    it('createMany with single object should inject institutionId', () => {
      const args = { data: { givenName: 'User1', familyName: 'Test' } };
      scopeArgs('createMany', 'Person', args, institutionId);
      expect(args.data).toEqual({ givenName: 'User1', familyName: 'Test', institutionId });
    });
  });

  describe('upsert operation (inject into where and create)', () => {
    it('upsert should inject institutionId into where and create', () => {
      const args = {
        where: { id: 'some-id' },
        create: { givenName: 'New', familyName: 'User' },
        update: { familyName: 'Updated' },
      };
      scopeArgs('upsert', 'Person', args, institutionId);
      expect(args.where).toEqual({ id: 'some-id', institutionId });
      expect(args.create).toEqual({ givenName: 'New', familyName: 'User', institutionId });
      expect(args.update).toEqual({ familyName: 'Updated' }); // update not modified
    });
  });

  describe('non-tenant models', () => {
    it('should not modify args for Institution model', () => {
      const args = { where: { id: 'some-id' } };
      const original = JSON.parse(JSON.stringify(args));
      scopeArgs('findUnique', 'Institution', args, institutionId);
      expect(args).toEqual(original);
    });

    it('should not modify args for unknown models', () => {
      const args = { where: { id: 'some-id' } };
      const original = JSON.parse(JSON.stringify(args));
      scopeArgs('findUnique', 'UnknownModel', args, institutionId);
      expect(args).toEqual(original);
    });
  });

  describe('all 15 operations coverage', () => {
    const operations = [
      'findFirst',
      'findFirstOrThrow',
      'findUnique',
      'findUniqueOrThrow',
      'findMany',
      'count',
      'aggregate',
      'groupBy',
      'create',
      'createMany',
      'update',
      'updateMany',
      'upsert',
      'delete',
      'deleteMany',
    ];

    it.each(operations)('should handle %s operation', (operation) => {
      const args: Record<string, unknown> = {};
      if (['create', 'createMany'].includes(operation)) {
        args.data = { test: 'value' };
      } else if (operation === 'upsert') {
        args.where = {};
        args.create = {};
        args.update = {};
      } else {
        args.where = {};
      }

      // Should not throw
      expect(() => scopeArgs(operation, 'Person', args, institutionId)).not.toThrow();
    });
  });

  describe('TENANT_SCOPED_MODELS list', () => {
    it('should have exactly 35 models', () => {
      expect(TENANT_SCOPED_MODELS.length).toBe(35);
    });

    it('should not include Institution', () => {
      expect(TENANT_SCOPED_MODELS).not.toContain('Institution');
    });

    it.each(TENANT_SCOPED_MODELS)('%s should be recognized as tenant-scoped', (model) => {
      const args = { where: {} };
      scopeArgs('findMany', model, args, institutionId);
      expect((args.where as Record<string, unknown>).institutionId).toBe(institutionId);
    });
  });
});
