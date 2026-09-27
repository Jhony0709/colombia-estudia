/** @jest-environment node */
/**
 * Temas: abrir el DRAFT, guardarlo y publicarlo.
 * SSOT: reference/02-api/endpoints.md:55-56, plan/07-contenido-y-migracion.md:20-38.
 */

const mockLessonFindFirst = jest.fn();
const mockLessonCreate = jest.fn();
const mockLessonUpdate = jest.fn();
const mockModuleFindFirst = jest.fn();
const mockSubjectFindFirst = jest.fn();
const mockVersionFindFirst = jest.fn();
const mockVersionCreate = jest.fn();
const mockVersionUpdate = jest.fn();
/**
 * `openDraft` pregunta cuántas versiones publicadas hay para decidir `hasPublished`, que es
 * lo que bloquea cambiar la asignatura de un tema ya publicado. Faltaba en el mock desde que
 * se añadió esa consulta, y por eso los cuatro casos de `openDraft` morían con
 * «count is not a function» antes de llegar a comprobar nada.
 */
const mockVersionCount = jest.fn(async () => 0);
const mockMediaFindMany = jest.fn();
const mockAssetDeleteMany = jest.fn();
const mockAssetCreateMany = jest.fn();
const mockAuditLogCreate = jest.fn();

jest.mock('server-only', () => ({}));

// 27/9: publicar propaga la versión a las cohortes no fijadas. Aquí se prueba que se llama
// con lo publicado y que el resultado llega al autor; la propagación tiene su propio test.
const mockPropagate = jest.fn<
  Promise<{ moved: number; reopened: Array<{ assignmentId: string; studentIds: string[] }> }>,
  unknown[]
>(async () => ({ moved: 0, reopened: [] }));
const mockNotifyReopened = jest.fn<Promise<number>, unknown[]>(async () => 0);
jest.mock('@/features/cohorts/server/version-propagation', () => ({
  propagateLessonVersion: (...args: unknown[]) => mockPropagate(...args),
  notifyReopened: (...args: unknown[]) => mockNotifyReopened(...args),
}));

jest.mock('@/lib/db/tenant', () => ({
  createTenantClient: jest.fn(() => {
    const tx = {
      lesson: {
        findFirst: mockLessonFindFirst,
        findMany: jest.fn(),
        create: mockLessonCreate,
        update: mockLessonUpdate,
      },
      module: { findFirst: mockModuleFindFirst },
      subject: { findFirst: mockSubjectFindFirst },
      lessonVersion: {
        findFirst: mockVersionFindFirst,
        create: mockVersionCreate,
        update: mockVersionUpdate,
        count: mockVersionCount,
      },
      mediaAsset: { findMany: mockMediaFindMany },
      lessonVersionAsset: {
        deleteMany: mockAssetDeleteMany,
        createMany: mockAssetCreateMany,
      },
      auditLog: { create: mockAuditLogCreate },
    };
    return { ...tx, $transaction: (fn: (t: typeof tx) => unknown) => fn(tx) };
  }),
}));

import {
  openDraft,
  saveDraft,
  publishLesson,
  createLesson,
  archiveLesson,
} from '@/features/content/server/lessons.service';

const LESSON = {
  id: 'l1',
  title: 'Números racionales',
  language: 'es-CO',
  subject: { name: 'Matemáticas' },
};

beforeEach(() => {
  jest.clearAllMocks();
  mockMediaFindMany.mockResolvedValue([]);
  mockVersionUpdate.mockResolvedValue({});
  mockAssetDeleteMany.mockResolvedValue({});
  mockAssetCreateMany.mockResolvedValue({});
});

describe('createLesson', () => {
  beforeEach(() => {
    mockModuleFindFirst.mockResolvedValue({ id: 'm1', programId: 'prog1' });
    mockSubjectFindFirst.mockResolvedValue({ id: 's1' });
    mockLessonCreate.mockResolvedValue({ id: 'l9' });
    mockVersionCreate.mockResolvedValue({ id: 'v1' });
  });

  // Un tema sin versión no se puede editar ni publicar: sería una fila que solo sirve para
  // que alguien se pregunte qué le pasa.
  it('crea el tema Y su versión 1 en borrador', async () => {
    const result = await createLesson({
      institutionId: 'i1',
      actorId: 'p1',
      moduleId: 'm1',
      subjectId: 's1',
      title: 'Números racionales',
    });

    expect(result).toEqual({ lessonId: 'l9', versionId: 'v1' });
    expect(mockVersionCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ lessonId: 'l9', number: 1, status: 'DRAFT', content: '' }),
      })
    );
  });

  // El mismo dato en dos sitios es dos sitios que se pueden contradecir.
  it('el programa sale del módulo, no de quien llama', async () => {
    await createLesson({
      institutionId: 'i1',
      actorId: 'p1',
      moduleId: 'm1',
      subjectId: 's1',
      title: 'T',
    });

    expect(mockLessonCreate.mock.calls[0]?.[0]?.data?.programId).toBe('prog1');
  });

  // Un tema archivado conserva su posición y el índice único cubre todas las filas.
  it('la posición sale del máximo del módulo, no de contar los visibles', async () => {
    mockLessonFindFirst.mockResolvedValue({ position: 7 });

    await createLesson({
      institutionId: 'i1',
      actorId: 'p1',
      moduleId: 'm1',
      subjectId: 's1',
      title: 'T',
    });

    expect(mockLessonCreate.mock.calls[0]?.[0]?.data?.position).toBe(8);
  });

  it('un módulo que no existe o está archivado se rechaza antes de crear nada', async () => {
    mockModuleFindFirst.mockResolvedValue(null);

    await expect(
      createLesson({
        institutionId: 'i1',
        actorId: 'p1',
        moduleId: 'mX',
        subjectId: 's1',
        title: 'T',
      })
    ).rejects.toThrow(/Module not found/);

    expect(mockLessonCreate).not.toHaveBeenCalled();
  });

  it('una asignatura que no existe se rechaza antes de crear nada', async () => {
    mockSubjectFindFirst.mockResolvedValue(null);

    await expect(
      createLesson({
        institutionId: 'i1',
        actorId: 'p1',
        moduleId: 'm1',
        subjectId: 'sX',
        title: 'T',
      })
    ).rejects.toThrow(/Subject not found/);

    expect(mockLessonCreate).not.toHaveBeenCalled();
  });

  it('audita la creación', async () => {
    await createLesson({
      institutionId: 'i1',
      actorId: 'p1',
      moduleId: 'm1',
      subjectId: 's1',
      title: 'Números racionales',
    });

    expect(mockAuditLogCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ entity: 'lesson', action: 'created', actorId: 'p1' }),
      })
    );
  });
});

describe('archiveLesson', () => {
  it('archiva y audita; no borra', async () => {
    mockLessonFindFirst.mockResolvedValue({ id: 'l1', title: 'Números racionales' });
    mockLessonUpdate.mockResolvedValue({});

    await archiveLesson({ institutionId: 'i1', actorId: 'p1', lessonId: 'l1' });

    expect(mockLessonUpdate.mock.calls[0]?.[0]?.data).toHaveProperty('archivedAt');
    expect(mockAuditLogCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ entity: 'lesson', action: 'archived' }),
      })
    );
  });

  it('un tema ya archivado no se archiva dos veces', async () => {
    mockLessonFindFirst.mockResolvedValue(null);

    await expect(
      archiveLesson({ institutionId: 'i1', actorId: 'p1', lessonId: 'l1' })
    ).rejects.toThrow(/not found/i);
  });
});

describe('openDraft', () => {
  it('devuelve el DRAFT que ya existe sin crear otro', async () => {
    mockLessonFindFirst.mockResolvedValue({
      ...LESSON,
      versions: [
        {
          id: 'v3',
          number: 3,
          status: 'DRAFT',
          content: '# Hola',
          estimatedMinutes: 20,
          invalidatesProgress: false,
        },
      ],
    });

    const draft = await openDraft({ institutionId: 'i1', lessonId: 'l1' });

    expect(draft.versionId).toBe('v3');
    expect(mockVersionCreate).not.toHaveBeenCalled();
  });

  // La regla que sostiene todo: no se edita lo que la gente está estudiando.
  it('sobre una versión PUBLICADA abre la siguiente copiando su contenido', async () => {
    mockLessonFindFirst.mockResolvedValue({
      ...LESSON,
      versions: [
        {
          id: 'v2',
          number: 2,
          status: 'PUBLISHED',
          content: '# Lo publicado',
          estimatedMinutes: 30,
          invalidatesProgress: true,
        },
      ],
    });
    mockVersionCreate.mockResolvedValue({
      id: 'v3',
      number: 3,
      content: '# Lo publicado',
      estimatedMinutes: 30,
    });

    const draft = await openDraft({ institutionId: 'i1', lessonId: 'l1' });

    expect(draft.number).toBe(3);
    expect(draft.content).toBe('# Lo publicado');
    expect(mockVersionCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ number: 3, status: 'DRAFT', content: '# Lo publicado' }),
      })
    );
  });

  it('no hereda "reabre el tema": eso se decide en cada cambio', async () => {
    mockLessonFindFirst.mockResolvedValue({
      ...LESSON,
      versions: [
        {
          id: 'v2',
          number: 2,
          status: 'PUBLISHED',
          content: 'x',
          estimatedMinutes: null,
          invalidatesProgress: true,
        },
      ],
    });
    mockVersionCreate.mockResolvedValue({
      id: 'v3',
      number: 3,
      content: 'x',
      estimatedMinutes: null,
    });

    const draft = await openDraft({ institutionId: 'i1', lessonId: 'l1' });

    expect(draft.invalidatesProgress).toBe(false);
    expect(mockVersionCreate.mock.calls[0]?.[0]?.data?.invalidatesProgress).toBe(false);
  });

  it('un tema sin versiones empieza en la 1 y en blanco', async () => {
    mockLessonFindFirst.mockResolvedValue({ ...LESSON, versions: [] });
    mockVersionCreate.mockResolvedValue({
      id: 'v1',
      number: 1,
      content: '',
      estimatedMinutes: null,
    });

    const draft = await openDraft({ institutionId: 'i1', lessonId: 'l1' });

    expect(draft.number).toBe(1);
    expect(draft.content).toBe('');
  });
});

describe('saveDraft', () => {
  it('se niega a escribir sobre una versión publicada', async () => {
    mockVersionFindFirst.mockResolvedValue({ id: 'v2', status: 'PUBLISHED' });

    await expect(
      saveDraft({ institutionId: 'i1', versionId: 'v2', content: 'nuevo' })
    ).rejects.toThrow(/ya está publicada/);

    expect(mockVersionUpdate).not.toHaveBeenCalled();
  });

  it('no audita: es el autosave y correría cada cinco segundos', async () => {
    mockVersionFindFirst.mockResolvedValue({ id: 'v3', status: 'DRAFT' });

    await saveDraft({ institutionId: 'i1', versionId: 'v3', content: 'nuevo' });

    expect(mockVersionUpdate).toHaveBeenCalled();
    expect(mockAuditLogCreate).not.toHaveBeenCalled();
  });

  // 27/9: el borrador reclama sus imágenes para que el barrido diario no las tome por huérfanas.
  // Los ids son cuids válidos porque el parser descarta los que no lo son antes de llegar aquí
  // (`invalid-asset-id`): «inventado» significa con forma válida pero sin fila en la base.
  it('vincula al borrador los assets que el Markdown referencia y existen; ignora los inventados', async () => {
    const real = 'cm1abcdefghijklmnopqrstuv';
    const ghost = 'cm1ghostghostghostghostgh';
    mockVersionFindFirst.mockResolvedValue({ id: 'v3', status: 'DRAFT' });
    mockMediaFindMany.mockResolvedValue([{ id: real, kind: 'IMAGE', status: 'READY' }]);

    await saveDraft({
      institutionId: 'i1',
      versionId: 'v3',
      content: `## Sección\n\n![Un mapa](asset:${real})\n\n![Otro](asset:${ghost})\n`,
    });

    expect(mockMediaFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: { in: [real, ghost] } } })
    );
    expect(mockAssetDeleteMany).toHaveBeenCalledWith({
      where: { lessonVersionId: 'v3', mediaAssetId: { notIn: [real] } },
    });
    expect(mockAssetCreateMany).toHaveBeenCalledWith({
      data: [{ institutionId: 'i1', lessonVersionId: 'v3', mediaAssetId: real }],
      skipDuplicates: true,
    });
  });

  it('sin imágenes en el texto suelta todos los vínculos y no crea ninguno', async () => {
    mockVersionFindFirst.mockResolvedValue({ id: 'v3', status: 'DRAFT' });

    await saveDraft({ institutionId: 'i1', versionId: 'v3', content: '## Solo texto\n' });

    expect(mockMediaFindMany).not.toHaveBeenCalled();
    expect(mockAssetDeleteMany).toHaveBeenCalledWith({ where: { lessonVersionId: 'v3' } });
    expect(mockAssetCreateMany).not.toHaveBeenCalled();
  });
});

describe('publishLesson', () => {
  const draftVersion = {
    id: 'v3',
    lessonId: 'l1',
    number: 3,
    status: 'DRAFT',
    invalidatesProgress: false,
    lesson: { title: LESSON.title },
  };

  const contentFor = (markdown: string) => ({
    content: markdown,
    lesson: { language: 'es-CO', subject: { name: 'Matemáticas' } },
  });

  // `#` está reservado para el título del tema (regla `heading-h1-reserved`): el contenido
  // empieza en `##`. Comprobado ejecutando el validador, no supuesto.
  it('publica un contenido válido, audita y deja publishedById', async () => {
    mockVersionFindFirst
      .mockResolvedValueOnce(draftVersion)
      .mockResolvedValueOnce(contentFor('## Sección\n\nUn párrafo de contenido.\n'));

    const result = await publishLesson({
      institutionId: 'i1',
      actorId: 'p1',
      versionId: 'v3',
      now: new Date('2026-09-17T12:00:00.000Z'),
    });

    expect(result.number).toBe(3);
    expect(mockVersionUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'PUBLISHED', publishedById: 'p1' }),
      })
    );
    expect(mockAuditLogCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ entity: 'lesson_version', action: 'published' }),
      })
    );
  });

  it('una versión ya publicada no se vuelve a publicar', async () => {
    mockVersionFindFirst.mockResolvedValue({ ...draftVersion, status: 'PUBLISHED' });

    await expect(
      publishLesson({ institutionId: 'i1', actorId: 'p1', versionId: 'v3' })
    ).rejects.toThrow(/ya no es un borrador/);
  });

  it('con errores de validación no publica y devuelve la lista', async () => {
    // Un asset con formato de id válido que no está en la base: `asset-not-found`.
    // (Con un id mal formado el error sería otro, `invalid-asset-id`, y el test estaría
    // probando el parser en vez del cruce contra la base.)
    mockVersionFindFirst
      .mockResolvedValueOnce(draftVersion)
      .mockResolvedValueOnce(
        contentFor('## Sección\n\n![Diagrama del ciclo](asset:cm1abcdefghijklmnopqrstuv)\n')
      );

    await expect(
      publishLesson({ institutionId: 'i1', actorId: 'p1', versionId: 'v3' })
    ).rejects.toThrow(/impiden publicarlo/);

    expect(mockVersionUpdate).not.toHaveBeenCalled();
    expect(mockAuditLogCreate).not.toHaveBeenCalled();
  });

  it('reescribe los assets usados: lo que se quitó del texto deja de contar', async () => {
    mockVersionFindFirst
      .mockResolvedValueOnce(draftVersion)
      .mockResolvedValueOnce(contentFor('## Sección\n\nUn párrafo.\n'));

    await publishLesson({ institutionId: 'i1', actorId: 'p1', versionId: 'v3' });

    expect(mockAssetDeleteMany).toHaveBeenCalledWith({ where: { lessonVersionId: 'v3' } });
  });

  // 27/9: la congelación es de la cohorte. Publicar mueve a las que siguen la última versión.
  it('propaga la versión a las cohortes no fijadas dentro de la transacción y avisa a los reabiertos después', async () => {
    mockVersionFindFirst
      .mockResolvedValueOnce({ ...draftVersion, invalidatesProgress: true })
      .mockResolvedValueOnce(contentFor('## Sección\n\nUn párrafo.\n'));
    mockPropagate.mockResolvedValueOnce({
      moved: 2,
      reopened: [{ assignmentId: 'la-1', studentIds: ['s1', 's2'] }],
    });
    mockNotifyReopened.mockResolvedValueOnce(2);

    const result = await publishLesson({ institutionId: 'i1', actorId: 'p1', versionId: 'v3' });

    expect(mockPropagate).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        institutionId: 'i1',
        lessonId: 'l1',
        version: { id: 'v3', number: 3, invalidatesProgress: true },
      })
    );
    expect(mockNotifyReopened).toHaveBeenCalledWith(
      expect.objectContaining({
        lessonTitle: LESSON.title,
        versionNumber: 3,
        reopened: [{ assignmentId: 'la-1', studentIds: ['s1', 's2'] }],
      })
    );
    expect(result).toMatchObject({ number: 3, cohortsUpdated: 2, reopened: 2 });
    expect(mockAuditLogCreate.mock.calls[0]?.[0].data.after).toMatchObject({ cohortsUpdated: 2 });
  });

  it('con errores de validación no propaga nada', async () => {
    mockVersionFindFirst
      .mockResolvedValueOnce(draftVersion)
      .mockResolvedValueOnce(
        contentFor('## Sección\n\n![Diagrama](asset:cm1abcdefghijklmnopqrstuv)\n')
      );

    await expect(
      publishLesson({ institutionId: 'i1', actorId: 'p1', versionId: 'v3' })
    ).rejects.toThrow(/impiden publicarlo/);

    expect(mockPropagate).not.toHaveBeenCalled();
    expect(mockNotifyReopened).not.toHaveBeenCalled();
  });
});
