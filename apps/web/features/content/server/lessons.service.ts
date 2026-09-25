/**
 * Temas y sus versiones: listar, editar el DRAFT, validar y publicar.
 * SSOT: reference/02-api/endpoints.md:55-56, plan/07-contenido-y-migracion.md:20-38.
 *
 * La regla que ordena todo el archivo: **se edita un DRAFT, nunca lo publicado**. Una
 * versión publicada está asignada a cohortes y hay gente estudiándola; cambiarla bajo los
 * pies es cómo alguien pierde el progreso de un tema que ya había terminado. Editar un
 * tema publicado crea la versión siguiente en DRAFT y la deja ahí hasta que se publique.
 *
 * La validación es **la misma función** en el aviso en vivo del editor y en `publish`
 * (`validateLessonForPublish`, del dominio puro). Dos validaciones distintas son dos
 * verdades distintas, y la que gana siempre es la que el autor no vio.
 */

import 'server-only';

import { parseLessonMarkdown, type LessonAssetInfo } from '@colombia-estudia/types';
import {
  isVersionEditable,
  isVersionLive,
  canTransition,
  toPublishStatus,
  validateLessonForPublish,
  type PublishStatus,
  type ValidationResult,
} from '@colombia-estudia/domain';
import { createTenantClient } from '@/lib/db/tenant';
import { byCodeOrId } from '@/lib/core/entity-code';
import { isUniqueViolation } from '@/lib/db/errors';
import { APIError } from '@/lib/core/errors';

export interface LessonListItem {
  id: string;
  /** Código legible `TEM-0001` (25/9). */
  code: string;
  title: string;
  position: number;
  subjectName: string;
  moduleId: string;
  moduleName: string;
  /** El orden del módulo dentro del programa: es el de la ruta, no el de creación. */
  modulePosition: number;
  programId: string;
  programName: string;
  requiresSubmission: boolean;
  /** Estado de la versión más alta: lo que de verdad importa de un vistazo. */
  latestStatus: PublishStatus | null;
  latestNumber: number | null;
  hasPublished: boolean;
}

export type ActivityAccepts = 'TEXT' | 'FILE' | 'TEXT_OR_FILE';

export interface DraftView {
  lessonId: string;
  /** Código legible `TEM-0001` (25/9). */
  code: string;
  title: string;
  language: string;
  subjectName: string;
  /** Los datos corregibles del tema, para el formulario de «Datos del tema». */
  moduleId: string;
  subjectId: string;
  learningObjective: string | null;
  requiresSubmission: boolean;
  /** La actividad (23/9): instrucciones y qué se acepta. Del tema, no de la versión. */
  activityInstructions: string | null;
  activityAccepts: ActivityAccepts;
  /** Enunciados (24/9): con uno o más, el estudiante responde pregunta por pregunta. */
  activityPrompts: string[];
  /**
   * Dónde se usa (24/9), para decidir si se puede **eliminar**: cohortes que lo tienen
   * asignado y exámenes del tema. Con cualquiera de los dos, solo se archiva.
   */
  usage: { assignments: number; assessments: number; versions: number };
  /**
   * Si ya hay alguna versión publicada. Cierra el módulo y la forma de completado: moverlos
   * con gente estudiando reordena la ruta o cambia qué da el tema por hecho.
   */
  hasPublished: boolean;
  versionId: string;
  number: number;
  status: PublishStatus;
  content: string;
  estimatedMinutes: number | null;
  invalidatesProgress: boolean;
}

/**
 * Crea un tema y le abre la versión 1 en borrador, en la misma transacción.
 *
 * Las dos cosas juntas porque un tema sin versión no se puede editar ni publicar: sería una
 * fila que solo sirve para que alguien se pregunte qué le pasa. Quien crea un tema quiere
 * escribirlo, así que el editor debe poder abrirse acto seguido.
 *
 * `position` sale del máximo del módulo y no de contar los que se ven: un tema archivado
 * conserva su posición y `@@unique([moduleId, position])` cubre todas las filas, archivadas
 * incluidas.
 *
 * `programId` sale del módulo, no de quien llama. Es el mismo dato en dos sitios y dejar que
 * el cliente lo mande es dejar que los dos sitios se contradigan.
 */
export async function createLesson({
  institutionId,
  actorId,
  moduleId,
  subjectId,
  title,
  requiresSubmission = false,
  learningObjective,
}: {
  institutionId: string;
  actorId: string;
  moduleId: string;
  subjectId: string;
  title: string;
  requiresSubmission?: boolean;
  learningObjective?: string | null;
}): Promise<{ lessonId: string; code: string; versionId: string }> {
  const db = createTenantClient(institutionId);

  return db.$transaction(async (tx) => {
    const lessonModule = await tx.module.findFirst({
      where: { id: moduleId, archivedAt: null },
      select: { id: true, programId: true },
    });
    if (!lessonModule) throw new APIError('Module not found', 'NOT_FOUND');

    const subject = await tx.subject.findFirst({
      where: { id: subjectId, archivedAt: null },
      select: { id: true },
    });
    if (!subject) throw new APIError('Subject not found', 'NOT_FOUND');

    const last = await tx.lesson.findFirst({
      where: { moduleId },
      orderBy: { position: 'desc' },
      select: { position: true },
    });

    try {
      const lesson = await tx.lesson.create({
        data: {
          institutionId,
          programId: lessonModule.programId,
          moduleId,
          subjectId,
          position: (last?.position ?? 0) + 1,
          title,
          requiresSubmission,
          learningObjective: learningObjective === '' ? null : (learningObjective ?? null),
          authorId: actorId,
        },
        select: { id: true, code: true },
      });

      const version = await tx.lessonVersion.create({
        data: {
          institutionId,
          lessonId: lesson.id,
          number: 1,
          status: 'DRAFT',
          content: '',
        },
        select: { id: true },
      });

      await tx.auditLog.create({
        data: {
          institutionId,
          actorId,
          entity: 'lesson',
          entityId: lesson.id,
          action: 'created',
          after: { title, moduleId, subjectId, requiresSubmission },
        },
      });

      return { lessonId: lesson.id, code: lesson.code, versionId: version.id };
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new APIError(
          'Otro tema ocupó esa posición en el componente mientras se creaba este. Inténtalo otra vez.',
          'CONFLICT'
        );
      }
      throw error;
    }
  });
}

/**
 * Corrige los datos de un tema ya creado: título, objetivo, asignatura, módulo y si se
 * completa con entrega.
 *
 * Existe porque hasta el 18/9 no había forma de corregir nada: el formulario de creación
 * pedía título, módulo y asignatura, y a partir de ahí eran inmutables. Un error de tipeo en
 * el título era permanente, y el objetivo de aprendizaje —que el player enseña bajo el
 * título— no se podía escribir en ninguna parte.
 *
 * Dos campos se cierran en cuanto hay una versión publicada, y no es burocracia:
 *
 * - `moduleId`: mover un tema de módulo cambia el orden de la ruta del programa, y con
 *   progresión lineal eso reordena lo que un estudiante puede abrir **mientras** lo estudia.
 * - `requiresSubmission`: cambia qué evidencia lo completa. A media cohorte, alguien que ya
 *   lo tenía completado dejaría de tenerlo, o al revés.
 *
 * El resto se corrige siempre: un título mal escrito es un título mal escrito esté publicado
 * o no.
 */
export async function updateLessonDetails({
  institutionId,
  actorId,
  lessonId,
  title,
  learningObjective,
  subjectId,
  moduleId,
  requiresSubmission,
}: {
  institutionId: string;
  actorId: string;
  lessonId: string;
  title: string;
  learningObjective: string | null;
  subjectId: string;
  moduleId: string;
  requiresSubmission: boolean;
}): Promise<{ lessonId: string; movedTo: string | null }> {
  const db = createTenantClient(institutionId);

  return db.$transaction(async (tx) => {
    const lesson = await tx.lesson.findFirst({
      where: { id: lessonId, archivedAt: null },
      select: {
        id: true,
        title: true,
        moduleId: true,
        subjectId: true,
        position: true,
        requiresSubmission: true,
        learningObjective: true,
        versions: { where: { status: 'PUBLISHED' }, select: { id: true }, take: 1 },
      },
    });
    if (!lesson) throw new APIError('Lesson not found', 'NOT_FOUND');

    const published = lesson.versions.length > 0;
    const movesModule = moduleId !== lesson.moduleId;
    const changesForm = requiresSubmission !== lesson.requiresSubmission;

    if (published && movesModule) {
      throw new APIError('A published lesson cannot change module', 'CONFLICT');
    }
    if (published && changesForm) {
      throw new APIError('A published lesson cannot change its completion form', 'CONFLICT');
    }

    const subject = await tx.subject.findFirst({
      where: { id: subjectId, archivedAt: null },
      select: { id: true },
    });
    if (!subject) throw new APIError('Subject not found', 'NOT_FOUND');

    // Al mover de módulo el tema va al final del nuevo: `@@unique([moduleId, position])`
    // impide colarlo en medio, y decidir por el autor dónde encaja sería inventarse un orden.
    let position = lesson.position;
    if (movesModule) {
      const target = await tx.module.findFirst({
        where: { id: moduleId, archivedAt: null },
        select: { id: true, programId: true },
      });
      if (!target) throw new APIError('Module not found', 'NOT_FOUND');

      const last = await tx.lesson.findFirst({
        where: { moduleId },
        orderBy: { position: 'desc' },
        select: { position: true },
      });
      position = (last?.position ?? 0) + 1;
    }

    try {
      await tx.lesson.update({
        where: { id: lessonId },
        data: {
          title,
          learningObjective,
          subjectId,
          moduleId,
          position,
          requiresSubmission,
        },
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new APIError('Another lesson already occupies that position', 'CONFLICT');
      }
      throw error;
    }

    await tx.auditLog.create({
      data: {
        institutionId,
        actorId,
        entity: 'lesson',
        entityId: lessonId,
        action: 'updated',
        before: {
          title: lesson.title,
          moduleId: lesson.moduleId,
          subjectId: lesson.subjectId,
          requiresSubmission: lesson.requiresSubmission,
          learningObjective: lesson.learningObjective,
        },
        after: { title, moduleId, subjectId, requiresSubmission, learningObjective },
      },
    });

    return { lessonId, movedTo: movesModule ? moduleId : null };
  });
}

/**
 * Archiva un tema. No se borra nada, nunca (plan/06:78-82).
 *
 * Un tema con versiones publicadas y asignadas sigue existiendo para quien lo está
 * estudiando: archivar lo saca de la lista de autoría, no de las cohortes donde ya está.
 */
export async function archiveLesson({
  institutionId,
  actorId,
  lessonId,
  now = new Date(),
}: {
  institutionId: string;
  actorId: string;
  lessonId: string;
  now?: Date;
}): Promise<{ lessonId: string }> {
  const db = createTenantClient(institutionId);

  return db.$transaction(async (tx) => {
    const lesson = await tx.lesson.findFirst({
      where: { id: lessonId, archivedAt: null },
      select: { id: true, title: true },
    });
    if (!lesson) throw new APIError('Lesson not found', 'NOT_FOUND');

    await tx.lesson.update({ where: { id: lessonId }, data: { archivedAt: now } });

    await tx.auditLog.create({
      data: {
        institutionId,
        actorId,
        entity: 'lesson',
        entityId: lessonId,
        action: 'archived',
        before: { title: lesson.title },
      },
    });

    return { lessonId };
  });
}

/**
 * Eliminar un tema de verdad (24/9, pedido de Jhonny: «permite eliminar los temas, con
 * validación extra»). La regla de la casa sigue siendo «no se borra nada» para lo que alguien
 * ya vio: por eso solo se elimina un tema que **ninguna cohorte tiene asignado** y que **no
 * tiene examen del tema**; en cualquier otro caso la respuesta es archivar. La validación
 * extra es que quien borra escribe el título exacto. Se llevan las versiones y sus referencias
 * a media (cascada en `LessonVersionAsset`); los archivos de media se quedan. Audita `deleted`.
 */
export async function deleteLesson({
  institutionId,
  actorId,
  lessonId,
  confirmTitle,
}: {
  institutionId: string;
  actorId: string;
  lessonId: string;
  confirmTitle: string;
}): Promise<{ lessonId: string }> {
  const db = createTenantClient(institutionId);

  return db.$transaction(async (tx) => {
    const lesson = await tx.lesson.findFirst({
      where: { id: lessonId },
      select: {
        id: true,
        title: true,
        _count: { select: { assignments: true, assessments: true, versions: true } },
      },
    });
    if (!lesson) throw new APIError('Lesson not found', 'NOT_FOUND');
    if (lesson._count.assignments > 0) {
      throw new APIError(
        'Este tema ya está en una cohorte y no se puede eliminar: archívalo.',
        'CONFLICT'
      );
    }
    if (lesson._count.assessments > 0) {
      throw new APIError(
        'Este tema tiene un examen del tema. Elimina o desvincula el examen antes.',
        'CONFLICT'
      );
    }
    if (confirmTitle.trim() !== lesson.title.trim()) {
      throw new APIError('El título escrito no coincide con el del tema.', 'VALIDATION_ERROR');
    }

    await tx.lessonVersion.deleteMany({ where: { lessonId } });
    await tx.lesson.delete({ where: { id: lessonId } });

    await tx.auditLog.create({
      data: {
        institutionId,
        actorId,
        entity: 'lesson',
        entityId: lessonId,
        action: 'deleted',
        before: { title: lesson.title, versions: lesson._count.versions },
      },
    });

    return { lessonId };
  });
}

/** Los temas del programa, con el estado de su versión más alta. */
export async function listLessons({
  institutionId,
  subjectId,
}: {
  institutionId: string;
  subjectId?: string;
}): Promise<LessonListItem[]> {
  const db = createTenantClient(institutionId);

  // Ordenar por `moduleId` ordenaba por un cuid, es decir, por el momento en que se creó el
  // módulo. La lista quedaba en un orden que no era el del programa y que no cambiaba al
  // mover un módulo con «Subir/Bajar». Se ordena en memoria por (programa, posición del
  // módulo, posición del tema), que es el orden en el que un estudiante lo recorre: Prisma
  // no sabe ordenar por un campo de una relación anidada.
  const lessons = await db.lesson.findMany({
    where: { archivedAt: null, ...(subjectId ? { subjectId } : {}) },
    select: {
      id: true,
      code: true,
      title: true,
      position: true,
      requiresSubmission: true,
      subject: { select: { name: true } },
      module: {
        select: {
          id: true,
          name: true,
          position: true,
          program: { select: { id: true, name: true } },
        },
      },
      versions: {
        orderBy: { number: 'desc' },
        select: { number: true, status: true },
      },
    },
  });

  return lessons
    .map((lesson) => {
      const latest = lesson.versions[0];

      return {
        id: lesson.id,
        code: lesson.code,
        title: lesson.title,
        position: lesson.position,
        subjectName: lesson.subject.name,
        moduleId: lesson.module.id,
        moduleName: lesson.module.name,
        modulePosition: lesson.module.position,
        programId: lesson.module.program.id,
        programName: lesson.module.program.name,
        requiresSubmission: lesson.requiresSubmission,
        latestStatus: latest ? toPublishStatus(latest.status) : null,
        latestNumber: latest?.number ?? null,
        hasPublished: lesson.versions.some((v) => isVersionLive(toPublishStatus(v.status))),
      };
    })
    .sort(
      (a, b) =>
        a.programName.localeCompare(b.programName, 'es') ||
        a.modulePosition - b.modulePosition ||
        a.position - b.position
    );
}

/**
 * La actividad del tema (23/9): instrucciones y qué se acepta como entrega.
 *
 * Aparte de `updateLessonDetails` porque no comparte sus candados: las instrucciones no
 * están versionadas (decisión de Jhonny) y se pueden corregir con el tema publicado; lo que
 * sigue cerrado con gente estudiando es la **forma** de completar (`requiresSubmission`).
 * Solo tiene sentido en un tema con actividad; en otro, es un error de quien llama.
 */
/** El JSON de la base como `string[]`, tolerante: lo que no sea lista de textos es «sin enunciados». */
export function promptsOf(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((q): q is string => typeof q === 'string') : [];
}

export async function updateLessonActivity({
  institutionId,
  actorId,
  lessonId,
  instructions,
  accepts,
  prompts,
}: {
  institutionId: string;
  actorId: string;
  lessonId: string;
  instructions: string | null;
  accepts: ActivityAccepts;
  /** Enunciados; vacío = un solo texto. Sin sentido con `accepts: 'FILE'`, y se guarda vacío. */
  prompts: string[];
}): Promise<{ lessonId: string }> {
  const db = createTenantClient(institutionId);

  const lesson = await db.lesson.findFirst({
    where: { id: lessonId, archivedAt: null },
    select: {
      id: true,
      requiresSubmission: true,
      activityInstructions: true,
      activityAccepts: true,
      activityPrompts: true,
    },
  });
  if (!lesson) throw new APIError('Lesson not found', 'NOT_FOUND');
  if (!lesson.requiresSubmission) {
    throw new APIError('Este tema no se completa con una actividad', 'CONFLICT');
  }

  const cleanPrompts = accepts === 'FILE' ? [] : prompts.map((q) => q.trim()).filter(Boolean);

  await db.$transaction(async (tx) => {
    await tx.lesson.update({
      where: { id: lessonId },
      data: {
        activityInstructions: instructions,
        activityAccepts: accepts,
        activityPrompts: cleanPrompts,
      },
    });
    await tx.auditLog.create({
      data: {
        institutionId,
        actorId,
        entity: 'lesson',
        entityId: lessonId,
        action: 'activity_updated',
        before: {
          activityAccepts: lesson.activityAccepts,
          hadInstructions: lesson.activityInstructions !== null,
          prompts: promptsOf(lesson.activityPrompts).length,
        },
        after: {
          activityAccepts: accepts,
          hasInstructions: instructions !== null,
          prompts: cleanPrompts.length,
        },
      },
    });
  });

  return { lessonId };
}

/**
 * De `TEM-0001` o de un `cuid` al id y al código del tema (25/9): la URL lleva el código y
 * los enlaces viejos, el id. Nulo si no existe o está archivado.
 */
export async function resolveLesson({
  institutionId,
  ref,
}: {
  institutionId: string;
  ref: string;
}): Promise<{ id: string; code: string } | null> {
  const db = createTenantClient(institutionId);
  return db.lesson.findFirst({
    where: { ...byCodeOrId(ref), archivedAt: null },
    select: { id: true, code: true },
  });
}

/**
 * El DRAFT sobre el que se edita, creándolo si hace falta.
 *
 * Si la versión más alta está publicada, se abre la siguiente **copiando su contenido**:
 * editar un tema empieza por lo que ya decía, no por una hoja en blanco.
 */
export async function openDraft({
  institutionId,
  lessonId,
}: {
  institutionId: string;
  lessonId: string;
}): Promise<DraftView> {
  const db = createTenantClient(institutionId);

  const lesson = await db.lesson.findFirst({
    where: { id: lessonId, archivedAt: null },
    select: {
      id: true,
      code: true,
      title: true,
      language: true,
      moduleId: true,
      subjectId: true,
      learningObjective: true,
      requiresSubmission: true,
      activityInstructions: true,
      activityAccepts: true,
      activityPrompts: true,
      subject: { select: { name: true } },
      _count: { select: { assignments: true, assessments: true, versions: true } },
      versions: {
        orderBy: { number: 'desc' },
        take: 1,
        select: {
          id: true,
          number: true,
          status: true,
          content: true,
          estimatedMinutes: true,
          invalidatesProgress: true,
        },
      },
    },
  });

  if (!lesson) throw new APIError('Lesson not found', 'NOT_FOUND');

  const publishedCount = await db.lessonVersion.count({
    where: { lessonId: lesson.id, status: 'PUBLISHED' },
  });

  const latest = lesson.versions[0];
  const base = {
    lessonId: lesson.id,
    code: lesson.code,
    title: lesson.title,
    language: lesson.language,
    subjectName: lesson.subject.name,
    moduleId: lesson.moduleId,
    subjectId: lesson.subjectId,
    learningObjective: lesson.learningObjective,
    requiresSubmission: lesson.requiresSubmission,
    activityInstructions: lesson.activityInstructions,
    activityAccepts: lesson.activityAccepts,
    activityPrompts: promptsOf(lesson.activityPrompts),
    usage: lesson._count,
    hasPublished: publishedCount > 0,
  };

  if (latest && isVersionEditable(toPublishStatus(latest.status))) {
    return {
      ...base,
      versionId: latest.id,
      number: latest.number,
      status: 'DRAFT',
      content: latest.content,
      estimatedMinutes: latest.estimatedMinutes,
      invalidatesProgress: latest.invalidatesProgress,
    };
  }

  const created = await db.lessonVersion.create({
    data: {
      institutionId,
      lessonId,
      number: (latest?.number ?? 0) + 1,
      status: 'DRAFT',
      content: latest?.content ?? '',
      estimatedMinutes: latest?.estimatedMinutes ?? null,
      // Nunca se hereda: que un cambio reabra el tema a quien ya lo completó es una
      // decisión de este cambio, no del anterior.
      invalidatesProgress: false,
    },
    select: { id: true, number: true, content: true, estimatedMinutes: true },
  });

  return {
    ...base,
    versionId: created.id,
    number: created.number,
    status: 'DRAFT',
    content: created.content,
    estimatedMinutes: created.estimatedMinutes,
    invalidatesProgress: false,
  };
}

/**
 * Guarda el DRAFT. Es el autosave, así que se llama muchas veces y no audita: un registro
 * de auditoría cada cinco segundos no es una pista, es ruido. Lo que audita es publicar.
 */
export async function saveDraft({
  institutionId,
  versionId,
  content,
  estimatedMinutes,
  invalidatesProgress,
}: {
  institutionId: string;
  versionId: string;
  content: string;
  estimatedMinutes?: number | null;
  invalidatesProgress?: boolean;
}): Promise<{ savedAt: string }> {
  const db = createTenantClient(institutionId);

  const version = await db.lessonVersion.findFirst({
    where: { id: versionId },
    select: { id: true, status: true },
  });

  if (!version) throw new APIError('Lesson version not found', 'NOT_FOUND');
  if (!isVersionEditable(toPublishStatus(version.status))) {
    throw new APIError(
      'Esa versión ya está publicada y no se puede editar. Abre el tema otra vez para empezar la siguiente.',
      'CONFLICT'
    );
  }

  await db.lessonVersion.update({
    where: { id: versionId },
    data: {
      content,
      ...(estimatedMinutes !== undefined ? { estimatedMinutes } : {}),
      ...(invalidatesProgress !== undefined ? { invalidatesProgress } : {}),
    },
  });

  return { savedAt: new Date().toISOString() };
}

/** Los `MediaAsset` que el Markdown referencia, en la forma que espera la validación. */
async function resolveAssets(
  institutionId: string,
  ids: string[]
): Promise<Map<string, LessonAssetInfo>> {
  if (ids.length === 0) return new Map();

  const db = createTenantClient(institutionId);
  const rows = await db.mediaAsset.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      institutionId: true,
      kind: true,
      status: true,
      captionsSource: true,
      transcriptPath: true,
      textAlternativePath: true,
      altText: true,
    },
  });

  return new Map(rows.map((row) => [row.id, row as LessonAssetInfo]));
}

export interface DraftValidation extends ValidationResult {
  assetIds: string[];
}

/**
 * Valida el contenido de un DRAFT sin publicarlo.
 *
 * Es lo que alimenta el panel de avisos del editor. Va contra la base porque las reglas
 * miran los assets de verdad —si la imagen tiene alt, si el video tiene subtítulos
 * revisados—, no solo el texto.
 */
export async function validateDraft({
  institutionId,
  versionId,
}: {
  institutionId: string;
  versionId: string;
}): Promise<DraftValidation> {
  const db = createTenantClient(institutionId);

  const version = await db.lessonVersion.findFirst({
    where: { id: versionId },
    select: {
      content: true,
      lesson: { select: { language: true, subject: { select: { name: true } } } },
    },
  });

  if (!version) throw new APIError('Lesson version not found', 'NOT_FOUND');

  const parsed = parseLessonMarkdown(version.content);
  const assetIds = [...new Set(parsed.assets.map((asset) => asset.id))];
  const assets = await resolveAssets(institutionId, assetIds);

  const result = validateLessonForPublish({
    parsed,
    assets,
    institutionId,
    lesson: {
      language: version.lesson.language,
      subjectName: version.lesson.subject.name,
    },
  });

  return { ...result, assetIds };
}

export interface PublishResult {
  versionId: string;
  number: number;
  publishedAt: string;
}

/**
 * Publica el DRAFT. Valida primero y se niega con la lista de errores.
 *
 * Una cosa que no es opcional:
 *
 * - Los `LessonVersionAsset` se reescriben desde lo que el Markdown referencia de verdad.
 *   Sin eso, un asset que se quitó del texto seguiría contando como usado y no se podría
 *   archivar nunca.
 */
export async function publishLesson({
  institutionId,
  actorId,
  versionId,
  now = new Date(),
}: {
  institutionId: string;
  actorId: string;
  versionId: string;
  now?: Date;
}): Promise<PublishResult> {
  const db = createTenantClient(institutionId);

  const version = await db.lessonVersion.findFirst({
    where: { id: versionId },
    select: {
      id: true,
      lessonId: true,
      number: true,
      status: true,
      invalidatesProgress: true,
    },
  });

  if (!version) throw new APIError('Lesson version not found', 'NOT_FOUND');
  if (!canTransition('publish', toPublishStatus(version.status)).allowed) {
    throw new APIError('Esta versión ya no es un borrador', 'CONFLICT');
  }

  const validation = await validateDraft({ institutionId, versionId });
  if (!validation.ok) {
    throw new APIError(
      `El tema todavía tiene ${validation.errors.length} problema(s) que impiden publicarlo.`,
      'INVALID_CONTENT',
      { errors: validation.errors }
    );
  }

  await db.$transaction(async (tx) => {
    await tx.lessonVersion.update({
      where: { id: versionId },
      data: { status: 'PUBLISHED', publishedAt: now, publishedById: actorId },
    });

    await tx.lessonVersionAsset.deleteMany({ where: { lessonVersionId: versionId } });
    if (validation.assetIds.length > 0) {
      await tx.lessonVersionAsset.createMany({
        data: validation.assetIds.map((mediaAssetId) => ({
          institutionId,
          lessonVersionId: versionId,
          mediaAssetId,
        })),
        skipDuplicates: true,
      });
    }

    await tx.auditLog.create({
      data: {
        institutionId,
        actorId,
        entity: 'lesson_version',
        entityId: versionId,
        action: 'published',
        after: {
          lessonId: version.lessonId,
          number: version.number,
          invalidatesProgress: version.invalidatesProgress,
          assets: validation.assetIds.length,
          warnings: validation.warnings.length,
        },
      },
    });
  });

  return { versionId, number: version.number, publishedAt: now.toISOString() };
}
