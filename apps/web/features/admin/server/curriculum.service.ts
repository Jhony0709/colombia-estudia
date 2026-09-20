/**
 * Curriculum service: programs, modules and subjects for /admin/institucion.
 * SSOT: plan/06-cohortes-y-personas.md:19-22 (§2 Programa, módulos, asignaturas).
 *
 * Nothing is deleted here, ever: archiving keeps the audit trail and the foreign keys
 * (`Restrict`) intact, which is what the plan asks for and what the business needs — a
 * module with lessons behind it cannot vanish.
 */

import 'server-only';

import { createTenantClient } from '@/lib/db/tenant';
import { isUniqueViolation } from '@/lib/db/errors';
import { APIError } from '@/lib/core/errors';

/** Position used for the split second a swap needs a free slot. */
const TEMP_POSITION = -1;

export interface CurriculumModule {
  id: string;
  name: string;
  position: number;
  lessonCount: number;
}

export interface CurriculumProgram {
  id: string;
  code: string;
  name: string;
  description: string | null;
  defaultAccessDays: number;
  modules: CurriculumModule[];
}

export interface CurriculumSubject {
  id: string;
  name: string;
  code: string | null;
  lessonCount: number;
}

export interface Curriculum {
  programs: CurriculumProgram[];
  subjects: CurriculumSubject[];
}

/**
 * `@@unique([institutionId, code])` on Program and `@@unique([institutionId, name])` on
 * Subject turn a duplicate into P2002. Without this it would surface as a 500.
 */
function asConflict(err: unknown, message: string): never {
  if (isUniqueViolation(err)) {
    throw new APIError(message, 'CONFLICT');
  }
  throw err;
}

// ─────────────────────────── Read ───────────────────────────

export async function listCurriculum(institutionId: string): Promise<Curriculum> {
  const db = createTenantClient(institutionId);

  const [programs, subjects] = await Promise.all([
    db.program.findMany({
      where: { archivedAt: null },
      orderBy: { code: 'asc' },
      select: {
        id: true,
        code: true,
        name: true,
        description: true,
        defaultAccessDays: true,
        modules: {
          where: { archivedAt: null },
          orderBy: { position: 'asc' },
          select: { id: true, name: true, position: true, _count: { select: { lessons: true } } },
        },
      },
    }),
    db.subject.findMany({
      where: { archivedAt: null },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, code: true, _count: { select: { lessons: true } } },
    }),
  ]);

  return {
    programs: programs.map((p) => ({
      ...p,
      modules: p.modules.map((m) => ({
        id: m.id,
        name: m.name,
        position: m.position,
        lessonCount: m._count.lessons,
      })),
    })),
    subjects: subjects.map((s) => ({
      id: s.id,
      name: s.name,
      code: s.code,
      lessonCount: s._count.lessons,
    })),
  };
}

// ─────────────────────────── Programs ───────────────────────────

export async function createProgram({
  institutionId,
  actorId,
  data,
}: {
  institutionId: string;
  actorId: string | null;
  data: { code: string; name: string; description: string | null; defaultAccessDays: number };
}): Promise<{ id: string }> {
  const db = createTenantClient(institutionId);

  try {
    return await db.$transaction(async (tx) => {
      const program = await tx.program.create({
        data: { institutionId, ...data },
        select: { id: true },
      });
      await tx.auditLog.create({
        data: {
          institutionId,
          actorId,
          entity: 'program',
          entityId: program.id,
          action: 'created',
          after: { ...data },
        },
      });
      return program;
    });
  } catch (err) {
    asConflict(err, `Ya existe un programa con el código ${data.code}`);
  }
}

export async function updateProgram({
  institutionId,
  actorId,
  programId,
  data,
}: {
  institutionId: string;
  actorId: string | null;
  programId: string;
  data: { code: string; name: string; description: string | null; defaultAccessDays: number };
}): Promise<{ id: string }> {
  const db = createTenantClient(institutionId);

  try {
    return await db.$transaction(async (tx) => {
      const before = await tx.program.findFirst({
        where: { id: programId, institutionId },
        select: { code: true, name: true, description: true, defaultAccessDays: true },
      });
      if (!before) {
        throw new APIError('Program not found', 'NOT_FOUND');
      }

      await tx.program.update({ where: { id: programId }, data });
      await tx.auditLog.create({
        data: {
          institutionId,
          actorId,
          entity: 'program',
          entityId: programId,
          action: 'updated',
          before,
          after: { ...data },
        },
      });
      return { id: programId };
    });
  } catch (err) {
    asConflict(err, `Ya existe un programa con el código ${data.code}`);
  }
}

export async function archiveProgram({
  institutionId,
  actorId,
  programId,
}: {
  institutionId: string;
  actorId: string | null;
  programId: string;
}): Promise<{ id: string }> {
  const db = createTenantClient(institutionId);

  return db.$transaction(async (tx) => {
    const program = await tx.program.findFirst({
      where: { id: programId, institutionId, archivedAt: null },
      select: { id: true },
    });
    if (!program) {
      throw new APIError('Program not found', 'NOT_FOUND');
    }

    const cohorts = await tx.cohort.count({ where: { programId, institutionId } });
    if (cohorts > 0) {
      throw new APIError(
        'No se puede archivar un programa con cohortes; archiva las cohortes primero',
        'CONFLICT'
      );
    }

    await tx.program.update({ where: { id: programId }, data: { archivedAt: new Date() } });
    await tx.auditLog.create({
      data: {
        institutionId,
        actorId,
        entity: 'program',
        entityId: programId,
        action: 'archived',
      },
    });
    return { id: programId };
  });
}

// ─────────────────────────── Modules ───────────────────────────

export async function createModule({
  institutionId,
  actorId,
  programId,
  name,
}: {
  institutionId: string;
  actorId: string | null;
  programId: string;
  name: string;
}): Promise<{ id: string }> {
  const db = createTenantClient(institutionId);

  return db.$transaction(async (tx) => {
    const program = await tx.program.findFirst({
      where: { id: programId, institutionId, archivedAt: null },
      select: { id: true },
    });
    if (!program) {
      throw new APIError('Program not found', 'NOT_FOUND');
    }

    // Archived modules keep their position: the unique constraint covers every row,
    // so the next position comes from the maximum, not from the visible count.
    const last = await tx.module.findFirst({
      where: { programId },
      orderBy: { position: 'desc' },
      select: { position: true },
    });

    const created = await tx.module.create({
      data: { institutionId, programId, name, position: (last?.position ?? 0) + 1 },
      select: { id: true, position: true },
    });

    await tx.auditLog.create({
      data: {
        institutionId,
        actorId,
        entity: 'module',
        entityId: created.id,
        action: 'created',
        after: { programId, name, position: created.position },
      },
    });

    return { id: created.id };
  });
}

export async function renameModule({
  institutionId,
  actorId,
  moduleId,
  name,
}: {
  institutionId: string;
  actorId: string | null;
  moduleId: string;
  name: string;
}): Promise<{ id: string }> {
  const db = createTenantClient(institutionId);

  return db.$transaction(async (tx) => {
    const before = await tx.module.findFirst({
      where: { id: moduleId, institutionId },
      select: { name: true },
    });
    if (!before) {
      throw new APIError('Module not found', 'NOT_FOUND');
    }

    await tx.module.update({ where: { id: moduleId }, data: { name } });
    await tx.auditLog.create({
      data: {
        institutionId,
        actorId,
        entity: 'module',
        entityId: moduleId,
        action: 'updated',
        before,
        after: { name },
      },
    });
    return { id: moduleId };
  });
}

export async function archiveModule({
  institutionId,
  actorId,
  moduleId,
}: {
  institutionId: string;
  actorId: string | null;
  moduleId: string;
}): Promise<{ id: string }> {
  const db = createTenantClient(institutionId);

  return db.$transaction(async (tx) => {
    const target = await tx.module.findFirst({
      where: { id: moduleId, institutionId, archivedAt: null },
      select: { id: true, _count: { select: { lessons: true } } },
    });
    if (!target) {
      throw new APIError('Module not found', 'NOT_FOUND');
    }

    await tx.module.update({ where: { id: moduleId }, data: { archivedAt: new Date() } });
    await tx.auditLog.create({
      data: {
        institutionId,
        actorId,
        entity: 'module',
        entityId: moduleId,
        action: 'archived',
        after: { lessonCount: target._count.lessons },
      },
    });
    return { id: moduleId };
  });
}

/**
 * Swap a module with its neighbour.
 *
 * `Module` carries `@@unique([programId, position])`, so the obvious two updates collide
 * mid-transaction: Postgres checks the constraint per statement, not at commit. The swap
 * goes through a temporary position instead.
 */
export async function moveModule({
  institutionId,
  actorId,
  moduleId,
  direction,
}: {
  institutionId: string;
  actorId: string | null;
  moduleId: string;
  direction: 'up' | 'down';
}): Promise<{ id: string; position: number }> {
  const db = createTenantClient(institutionId);

  return db.$transaction(async (tx) => {
    const current = await tx.module.findFirst({
      where: { id: moduleId, institutionId, archivedAt: null },
      select: { id: true, programId: true, position: true },
    });
    if (!current) {
      throw new APIError('Module not found', 'NOT_FOUND');
    }

    const neighbour = await tx.module.findFirst({
      where: {
        programId: current.programId,
        archivedAt: null,
        position: direction === 'up' ? { lt: current.position } : { gt: current.position },
      },
      orderBy: { position: direction === 'up' ? 'desc' : 'asc' },
      select: { id: true, position: true },
    });
    if (!neighbour) {
      throw new APIError('El módulo ya está en el extremo de la lista', 'CONFLICT');
    }

    await tx.module.update({ where: { id: current.id }, data: { position: TEMP_POSITION } });
    await tx.module.update({ where: { id: neighbour.id }, data: { position: current.position } });
    await tx.module.update({ where: { id: current.id }, data: { position: neighbour.position } });

    await tx.auditLog.create({
      data: {
        institutionId,
        actorId,
        entity: 'module',
        entityId: moduleId,
        action: 'reordered',
        before: { position: current.position },
        after: { position: neighbour.position },
      },
    });

    return { id: moduleId, position: neighbour.position };
  });
}

// ─────────────────────────── Subjects ───────────────────────────

export async function createSubject({
  institutionId,
  actorId,
  data,
}: {
  institutionId: string;
  actorId: string | null;
  data: { name: string; code: string | null };
}): Promise<{ id: string }> {
  const db = createTenantClient(institutionId);

  try {
    return await db.$transaction(async (tx) => {
      const subject = await tx.subject.create({
        data: { institutionId, ...data },
        select: { id: true },
      });
      await tx.auditLog.create({
        data: {
          institutionId,
          actorId,
          entity: 'subject',
          entityId: subject.id,
          action: 'created',
          after: { ...data },
        },
      });
      return subject;
    });
  } catch (err) {
    asConflict(err, `Ya existe una asignatura llamada ${data.name}`);
  }
}

export async function updateSubject({
  institutionId,
  actorId,
  subjectId,
  data,
}: {
  institutionId: string;
  actorId: string | null;
  subjectId: string;
  data: { name: string; code: string | null };
}): Promise<{ id: string }> {
  const db = createTenantClient(institutionId);

  try {
    return await db.$transaction(async (tx) => {
      const before = await tx.subject.findFirst({
        where: { id: subjectId, institutionId },
        select: { name: true, code: true },
      });
      if (!before) {
        throw new APIError('Subject not found', 'NOT_FOUND');
      }

      await tx.subject.update({ where: { id: subjectId }, data });
      await tx.auditLog.create({
        data: {
          institutionId,
          actorId,
          entity: 'subject',
          entityId: subjectId,
          action: 'updated',
          before,
          after: { ...data },
        },
      });
      return { id: subjectId };
    });
  } catch (err) {
    asConflict(err, `Ya existe una asignatura llamada ${data.name}`);
  }
}

export async function archiveSubject({
  institutionId,
  actorId,
  subjectId,
}: {
  institutionId: string;
  actorId: string | null;
  subjectId: string;
}): Promise<{ id: string }> {
  const db = createTenantClient(institutionId);

  return db.$transaction(async (tx) => {
    const subject = await tx.subject.findFirst({
      where: { id: subjectId, institutionId, archivedAt: null },
      select: { id: true },
    });
    if (!subject) {
      throw new APIError('Subject not found', 'NOT_FOUND');
    }

    await tx.subject.update({ where: { id: subjectId }, data: { archivedAt: new Date() } });
    await tx.auditLog.create({
      data: {
        institutionId,
        actorId,
        entity: 'subject',
        entityId: subjectId,
        action: 'archived',
      },
    });
    return { id: subjectId };
  });
}
