/** @jest-environment node */
/**
 * Evaluaciones: el borrador, la clave de respuestas y la publicación.
 * SSOT: plan/07-contenido-y-migracion.md:40-44, reference/02-api/endpoints.md:57.
 *
 * Los casos de validación de abajo están comprobados ejecutando el validador del dominio,
 * no supuestos: ver `docs/estado.md` §4.
 */

const mockAssessmentFindFirst = jest.fn();
const mockAssessmentCreate = jest.fn();
const mockProgramFindFirst = jest.fn();
const mockModuleFindFirst = jest.fn();
const mockVersionFindFirst = jest.fn();
const mockVersionCreate = jest.fn();
const mockVersionUpdate = jest.fn();
const mockAuditLogCreate = jest.fn();

jest.mock('server-only', () => ({}));

jest.mock('@/lib/db/tenant', () => ({
  createTenantClient: jest.fn(() => {
    const tx = {
      assessment: {
        findFirst: mockAssessmentFindFirst,
        findMany: jest.fn(),
        create: mockAssessmentCreate,
      },
      program: { findFirst: mockProgramFindFirst },
      module: { findFirst: mockModuleFindFirst },
      assessmentVersion: {
        findFirst: mockVersionFindFirst,
        create: mockVersionCreate,
        update: mockVersionUpdate,
      },
      auditLog: { create: mockAuditLogCreate },
    };
    return { ...tx, $transaction: (fn: (t: typeof tx) => unknown) => fn(tx) };
  }),
}));

import {
  createAssessment,
  openAssessmentDraft,
  saveAssessmentContent,
  saveAnswerKey,
  getAnswerKey,
  publishAssessment,
} from '@/features/content/server/assessments.service';

const ASSESSMENT = { id: 'a1', title: 'Diagnóstico', kind: 'DIAGNOSTIC', language: 'es-CO' };

const question = (over: Record<string, unknown> = {}) => ({
  code: 'p1',
  type: 'single_choice',
  text: '¿Cuál es la capital de Colombia?',
  options: [
    { code: 'a', text: 'Bogotá' },
    { code: 'b', text: 'Medellín' },
  ],
  points: 1,
  ...over,
});

const VALID_CONTENT = { questions: [question()] };
const VALID_KEY = { p1: { correct: 'a', points: 1 } };

beforeEach(() => {
  jest.clearAllMocks();
  mockVersionUpdate.mockResolvedValue({});
});

describe('createAssessment', () => {
  beforeEach(() => {
    mockProgramFindFirst.mockResolvedValue({ id: 'prog1' });
    mockModuleFindFirst.mockResolvedValue({ id: 'm1' });
    mockAssessmentCreate.mockResolvedValue({ id: 'a9' });
    mockVersionCreate.mockResolvedValue({ id: 'v1' });
  });

  // Nace vacía a propósito: la regla `questions-required` impide publicarla hasta que
  // tenga preguntas.
  it('nace con cero preguntas y la clave vacía', async () => {
    await createAssessment({
      institutionId: 'i1',
      actorId: 'p1',
      programId: 'prog1',
      kind: 'SUBJECT',
      title: 'Evaluación 1',
      moduleId: 'm1',
    });

    const data = mockVersionCreate.mock.calls[0]?.[0]?.data;
    expect(data?.content).toEqual({ questions: [] });
    expect(data?.answerKey).toEqual({});
    expect(data?.status).toBe('DRAFT');
  });

  // Una diagnóstica es del programa entero.
  it('una diagnóstica se crea sin módulo', async () => {
    await createAssessment({
      institutionId: 'i1',
      actorId: 'p1',
      programId: 'prog1',
      kind: 'DIAGNOSTIC',
      title: 'Diagnóstico inicial',
    });

    expect(mockAssessmentCreate.mock.calls[0]?.[0]?.data?.moduleId).toBeNull();
    expect(mockModuleFindFirst).not.toHaveBeenCalled();
  });

  // Si no, la evaluación aparecería en un sitio y contaría en otro.
  it('el módulo tiene que ser de ese programa', async () => {
    mockModuleFindFirst.mockResolvedValue(null);

    await expect(
      createAssessment({
        institutionId: 'i1',
        actorId: 'p1',
        programId: 'prog1',
        moduleId: 'deOtroPrograma',
        kind: 'SUBJECT',
        title: 'T',
      })
    ).rejects.toThrow(/Module not found in this program/);

    expect(mockAssessmentCreate).not.toHaveBeenCalled();
  });

  it('un programa que no existe se rechaza antes de crear nada', async () => {
    mockProgramFindFirst.mockResolvedValue(null);

    await expect(
      createAssessment({
        institutionId: 'i1',
        actorId: 'p1',
        programId: 'pX',
        kind: 'FINAL',
        title: 'T',
      })
    ).rejects.toThrow(/Program not found/);

    expect(mockAssessmentCreate).not.toHaveBeenCalled();
  });

  it('audita la creación', async () => {
    await createAssessment({
      institutionId: 'i1',
      actorId: 'p1',
      programId: 'prog1',
      kind: 'FINAL',
      title: 'Final',
    });

    expect(mockAuditLogCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ entity: 'assessment', action: 'created' }),
      })
    );
  });
});

describe('openAssessmentDraft', () => {
  // Es la mitad silenciosa del asunto: una evaluación sin clave no es un borrador a
  // medias, es una evaluación que no se puede calificar.
  it('al abrir la siguiente versión copia las preguntas Y la clave', async () => {
    mockAssessmentFindFirst.mockResolvedValue({
      ...ASSESSMENT,
      versions: [
        {
          id: 'v1',
          number: 1,
          status: 'PUBLISHED',
          content: VALID_CONTENT,
          maxAttempts: 2,
          timeLimitMinutes: 45,
          passPercent: 60,
          reviewPolicy: 'SCORE_ONLY',
        },
      ],
    });
    mockVersionFindFirst.mockResolvedValue({ answerKey: VALID_KEY });
    mockVersionCreate.mockResolvedValue({
      id: 'v2',
      number: 2,
      content: VALID_CONTENT,
      maxAttempts: 2,
      timeLimitMinutes: 45,
      passPercent: 60,
      reviewPolicy: 'SCORE_ONLY',
    });

    const draft = await openAssessmentDraft({ institutionId: 'i1', assessmentId: 'a1' });

    expect(draft.number).toBe(2);
    expect(mockVersionCreate.mock.calls[0]?.[0]?.data?.answerKey).toEqual(VALID_KEY);
  });

  // La regla de seguridad, en el transporte y no solo en la pantalla.
  it('lo que devuelve NO lleva la clave de respuestas', async () => {
    mockAssessmentFindFirst.mockResolvedValue({
      ...ASSESSMENT,
      versions: [
        {
          id: 'v1',
          number: 1,
          status: 'DRAFT',
          content: VALID_CONTENT,
          maxAttempts: 1,
          timeLimitMinutes: null,
          passPercent: null,
          reviewPolicy: 'SCORE_ONLY',
        },
      ],
    });

    const draft = await openAssessmentDraft({ institutionId: 'i1', assessmentId: 'a1' });

    expect(draft).not.toHaveProperty('answerKey');
    expect(JSON.stringify(draft)).not.toContain('correct');
  });
});

describe('guardar por separado', () => {
  it('guardar preguntas no toca la clave', async () => {
    mockVersionFindFirst.mockResolvedValue({ id: 'v1', status: 'DRAFT' });

    await saveAssessmentContent({ institutionId: 'i1', versionId: 'v1', content: VALID_CONTENT });

    expect(mockVersionUpdate.mock.calls[0]?.[0]?.data).not.toHaveProperty('answerKey');
  });

  it('guardar la clave no toca las preguntas', async () => {
    mockVersionFindFirst.mockResolvedValue({ id: 'v1', status: 'DRAFT' });

    await saveAnswerKey({ institutionId: 'i1', versionId: 'v1', answerKey: VALID_KEY });

    expect(mockVersionUpdate.mock.calls[0]?.[0]?.data).not.toHaveProperty('content');
  });

  it('ninguna de las dos escribe sobre una versión publicada', async () => {
    mockVersionFindFirst.mockResolvedValue({ id: 'v1', status: 'PUBLISHED' });

    await expect(
      saveAssessmentContent({ institutionId: 'i1', versionId: 'v1', content: VALID_CONTENT })
    ).rejects.toThrow(/ya está publicada/);
    await expect(
      saveAnswerKey({ institutionId: 'i1', versionId: 'v1', answerKey: VALID_KEY })
    ).rejects.toThrow(/ya está publicada/);

    expect(mockVersionUpdate).not.toHaveBeenCalled();
  });

  it('la clave se lee por su propio camino', async () => {
    mockVersionFindFirst.mockResolvedValue({ answerKey: VALID_KEY });

    expect(await getAnswerKey({ institutionId: 'i1', versionId: 'v1' })).toEqual({
      answerKey: VALID_KEY,
    });
  });
});

describe('publishAssessment', () => {
  const draft = { id: 'v1', assessmentId: 'a1', number: 1, status: 'DRAFT' };

  it('publica una evaluación válida y audita sin copiar preguntas ni respuestas', async () => {
    mockVersionFindFirst
      .mockResolvedValueOnce(draft)
      .mockResolvedValueOnce({ content: VALID_CONTENT, answerKey: VALID_KEY });

    await publishAssessment({ institutionId: 'i1', actorId: 'p1', versionId: 'v1' });

    const audit = JSON.stringify(mockAuditLogCreate.mock.calls[0]?.[0]);
    expect(audit).toContain('published');
    expect(audit).not.toContain('correct');
    expect(audit).not.toContain('capital de Colombia');
  });

  it('se niega si una pregunta no tiene clave', async () => {
    mockVersionFindFirst
      .mockResolvedValueOnce(draft)
      .mockResolvedValueOnce({ content: VALID_CONTENT, answerKey: {} });

    await expect(
      publishAssessment({ institutionId: 'i1', actorId: 'p1', versionId: 'v1' })
    ).rejects.toThrow(/impiden publicarla/);

    expect(mockVersionUpdate).not.toHaveBeenCalled();
  });

  it('se niega si los puntos de la pregunta y los de la clave no coinciden', async () => {
    mockVersionFindFirst.mockResolvedValueOnce(draft).mockResolvedValueOnce({
      content: VALID_CONTENT,
      answerKey: { p1: { correct: 'a', points: 5 } },
    });

    await expect(
      publishAssessment({ institutionId: 'i1', actorId: 'p1', versionId: 'v1' })
    ).rejects.toThrow(/impiden publicarla/);
  });

  // La fuga que la regla SÍ detecta: la estructural.
  it('se niega si la clave se coló dentro de las preguntas', async () => {
    mockVersionFindFirst.mockResolvedValueOnce(draft).mockResolvedValueOnce({
      content: { ...VALID_CONTENT, answerKey: { p1: { correct: 'a' } } },
      answerKey: VALID_KEY,
    });

    await expect(
      publishAssessment({ institutionId: 'i1', actorId: 'p1', versionId: 'v1' })
    ).rejects.toThrow(/impiden publicarla/);
  });

  it('una versión publicada no se vuelve a publicar', async () => {
    mockVersionFindFirst.mockResolvedValue({ ...draft, status: 'PUBLISHED' });

    await expect(
      publishAssessment({ institutionId: 'i1', actorId: 'p1', versionId: 'v1' })
    ).rejects.toThrow(/ya no es un borrador/);
  });
});
