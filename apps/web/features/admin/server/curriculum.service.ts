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
import {
  PROGRAM_PRICE_SELECT,
  toProgramPriceView,
  withPriceStates,
  type ProgramPriceView,
} from '@/features/billing/server/prices.service';
import { isUniqueViolation } from '@/lib/db/errors';
import { APIError } from '@/lib/core/errors';
import { createReadUrl } from '@/lib/media/storage';

/** Position used for the split second a swap needs a free slot. */
const TEMP_POSITION = -1;

export {
  PROGRAM_KINDS,
  PROGRAM_PRICINGS,
  type ProgramKind,
  type ProgramPricing,
} from '@/lib/programs/kinds';
import type { ProgramKind, ProgramPricing } from '@/lib/programs/kinds';

export interface CurriculumModule {
  id: string;
  /** Código legible `COM-0001` (25/9). */
  code: string;
  name: string;
  position: number;
  /** Grado escolar del componente (25/9); nulo en programas sin grados. */
  grade: number | null;
  /** De qué va y cómo se cierra (25/9, fase 4). */
  description: string | null;
  closingText: string | null;
  /** La imagen de la tarjeta del curso (25/9): el asset y una URL de lectura firmada (10 min). */
  coverMediaId: string | null;
  coverUrl: string | null;
  lessonCount: number;
}

export interface CurriculumProgram {
  id: string;
  code: string;
  name: string;
  description: string | null;
  /** Qué vende el programa (25/9). */
  kind: ProgramKind;
  /** Gratuito o de pago (25/9): en uno gratuito un menor entra sin acudiente. */
  pricing: ProgramPricing;
  defaultAccessDays: number;
  modules: CurriculumModule[];
  /** La lista de precios vigente (no archivada), 25/9. */
  prices: ProgramPriceView[];
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

/**
 * `coverUrls` (25/9): firmar una URL por imagen es una llamada a Storage por componente; solo
 * la pantalla de Programas las enseña, las demás listas (temas, exámenes) solo necesitan
 * nombres y las dejan en nulo.
 */
export async function listCurriculum(
  institutionId: string,
  { coverUrls = false }: { coverUrls?: boolean } = {}
): Promise<Curriculum> {
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
        kind: true,
        pricing: true,
        defaultAccessDays: true,
        modules: {
          where: { archivedAt: null },
          orderBy: { position: 'asc' },
          select: {
            id: true,
            code: true,
            name: true,
            position: true,
            grade: true,
            description: true,
            closingText: true,
            coverMedia: { select: { id: true, providerRef: true, status: true } },
            _count: { select: { lessons: true } },
          },
        },
        prices: {
          where: { archivedAt: null },
          orderBy: [{ gradeFrom: 'asc' }, { validFrom: 'desc' }, { createdAt: 'desc' }],
          select: PROGRAM_PRICE_SELECT,
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
    programs: await Promise.all(
      programs.map(async (p) => ({
        ...p,
        prices: withPriceStates(p.prices.map(toProgramPriceView)),
        modules: await Promise.all(
          p.modules.map(async (m) => ({
            id: m.id,
            code: m.code,
            name: m.name,
            position: m.position,
            grade: m.grade,
            description: m.description,
            closingText: m.closingText,
            coverMediaId: m.coverMedia?.id ?? null,
            coverUrl: coverUrls ? await coverUrlOf(m.coverMedia) : null,
            lessonCount: m._count.lessons,
          }))
        ),
      }))
    ),
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
  data: {
    code: string;
    name: string;
    description: string | null;
    kind: ProgramKind;
    pricing: ProgramPricing;
    defaultAccessDays: number;
  };
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
  data: {
    code: string;
    name: string;
    description: string | null;
    kind: ProgramKind;
    pricing: ProgramPricing;
    defaultAccessDays: number;
  };
}): Promise<{ id: string }> {
  const db = createTenantClient(institutionId);

  try {
    return await db.$transaction(async (tx) => {
      const before = await tx.program.findFirst({
        where: { id: programId, institutionId },
        select: {
          code: true,
          name: true,
          description: true,
          kind: true,
          pricing: true,
          defaultAccessDays: true,
        },
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

/**
 * Nombre y grado del componente (25/9): el grado es lo que el negocio nombra (precio por
 * grados, grado de entrada); la posición sigue siendo el orden de la ruta.
 */
/**
 * URL de lectura de la imagen de la tarjeta (25/9). Solo si el asset quedó `READY`: uno
 * `PENDING` es una subida que no terminó y no hay nada que enseñar.
 */
export async function coverUrlOf(
  cover: { providerRef: string; status: string } | null
): Promise<string | null> {
  if (!cover || cover.status !== 'READY') return null;
  return createReadUrl(cover.providerRef, { asAttachment: false });
}

export async function updateModule({
  institutionId,
  actorId,
  moduleId,
  name,
  grade,
  description,
  closingText,
  coverMediaId,
}: {
  institutionId: string;
  actorId: string | null;
  moduleId: string;
  name: string;
  grade: number | null;
  description: string | null;
  closingText: string | null;
  /** `undefined` = no tocar; `null` = quitar la imagen; id = un `MediaAsset` IMAGE `READY`. */
  coverMediaId?: string | null;
}): Promise<{ id: string }> {
  const db = createTenantClient(institutionId);

  return db.$transaction(async (tx) => {
    const before = await tx.module.findFirst({
      where: { id: moduleId, institutionId },
      select: { name: true, grade: true, description: true, closingText: true, coverMediaId: true },
    });
    if (!before) {
      throw new APIError('Module not found', 'NOT_FOUND');
    }

    // La imagen tiene que ser una imagen ya subida y comprobada (`confirm`), de esta
    // institución: el id viene del cliente y se trata como tal.
    if (typeof coverMediaId === 'string') {
      const asset = await tx.mediaAsset.findFirst({
        where: { id: coverMediaId, kind: 'IMAGE', status: 'READY', archivedAt: null },
        select: { id: true },
      });
      if (!asset) {
        throw new APIError('La imagen no existe o no terminó de subirse', 'VALIDATION_ERROR');
      }
    }

    const data = {
      name,
      grade,
      description,
      closingText,
      ...(coverMediaId !== undefined ? { coverMediaId } : {}),
    };
    await tx.module.update({ where: { id: moduleId }, data });
    await tx.auditLog.create({
      data: {
        institutionId,
        actorId,
        entity: 'module',
        entityId: moduleId,
        action: 'updated',
        before,
        after: data,
      },
    });
    return { id: moduleId };
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

/**
 * Eliminar un componente (24/9): solo uno **vacío** —sin temas (ni archivados), sin
 * exámenes y sin constancias emitidas—; con cualquiera de los tres, archivar. Es la misma
 * excepción acotada que la de los temas: borrar lo que nadie ha visto no le quita nada a
 * nadie. Las posiciones de los demás componentes no se recompactan: el orden relativo se
 * conserva y `position` es solo orden.
 */
export async function deleteModule({
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
      where: { id: moduleId, institutionId },
      select: {
        id: true,
        name: true,
        _count: {
          select: {
            lessons: true,
            assessments: true,
            certificates: true,
            enrollmentModules: true,
            accessRequests: true,
          },
        },
      },
    });
    if (!target) throw new APIError('Module not found', 'NOT_FOUND');
    if (target._count.lessons > 0) {
      throw new APIError(
        'Este componente tiene temas (contando los archivados). Elimínalos o archiva el componente.',
        'CONFLICT'
      );
    }
    if (target._count.assessments > 0) {
      throw new APIError('Este componente tiene cuestionarios: archívalo.', 'CONFLICT');
    }
    if (target._count.certificates > 0) {
      throw new APIError('Este componente ya emitió constancias: archívalo.', 'CONFLICT');
    }
    // Habilitado para alguien (3/10) o pedido por un estudiante (6/10): la fila lo referencia.
    if (target._count.enrollmentModules > 0 || target._count.accessRequests > 0) {
      throw new APIError('Este componente ya tiene estudiantes: archívalo.', 'CONFLICT');
    }

    await tx.module.delete({ where: { id: moduleId } });
    await tx.auditLog.create({
      data: {
        institutionId,
        actorId,
        entity: 'module',
        entityId: moduleId,
        action: 'deleted',
        before: { name: target.name },
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
      throw new APIError('El componente ya está en el extremo de la lista', 'CONFLICT');
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
    asConflict(err, `Ya existe un taller llamado ${data.name}`);
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
    asConflict(err, `Ya existe un taller llamado ${data.name}`);
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
