/** @jest-environment node */
/**
 * El player, del lado del servidor: quién puede abrir un tema y qué se le devuelve.
 * SSOT: plan/08-aprender-y-evaluar.md:22-33, reference/02-api/endpoints.md:37.
 *
 * Lo que de verdad se prueba aquí es que **no se devuelve contenido cuando la secuencia no
 * lo permite**. Un fallo en eso no se ve en la pantalla: se ve cuando alguien estudia el
 * tema 9 sin haber pasado por el 3.
 */

const mockGetCohortOutline = jest.fn();
const mockResolveRenderAssets = jest.fn();
const mockAssignmentFindFirst = jest.fn();
const mockProgressFindFirst = jest.fn();

jest.mock('server-only', () => ({}));

jest.mock('@/features/learn/server/cohort.service', () => ({
  getCohortOutline: (...args: unknown[]) => mockGetCohortOutline(...args),
}));

jest.mock('@/features/content/server/render-assets', () => ({
  resolveRenderAssets: (...args: unknown[]) => mockResolveRenderAssets(...args),
}));

jest.mock('@/lib/db/tenant', () => ({
  createTenantClient: jest.fn(() => ({
    lessonAssignment: { findFirst: (...args: unknown[]) => mockAssignmentFindFirst(...args) },
    lessonProgress: { findFirst: (...args: unknown[]) => mockProgressFindFirst(...args) },
  })),
}));

import { getLessonForStudent } from '@/features/learn/server/lesson.service';

const ARGS = { institutionId: 'i1', personId: 'p1' };

const item = (over: Record<string, unknown> & { assignmentId: string; title: string }) => ({
  kind: 'LESSON' as const,
  moduleId: 'm1',
  position: 1,
  status: 'NOT_STARTED' as const,
  availableFrom: new Date('2026-01-01T00:00:00.000Z'),
  availableUntil: null,
  enabled: true,
  blockedBy: null,
  unavailableReason: null,
  ...over,
});

const outlineCon = (items: ReturnType<typeof item>[]) => ({
  gate: null,
  enrollmentId: 'e1',
  cohort: { id: 'c1', code: 'C1', name: 'Cohorte', programName: 'Programa', progression: 'LINEAR' },
  modules: [{ id: 'm1', name: 'Módulo 1', position: 1, items }],
  resume: null,
  progress: { completed: 0, total: items.length },
  partnerFunded: false,
});

const asignacion = (content: string) => ({
  id: 'a1',
  lesson: {
    title: 'Los números reales',
    language: 'es-CO',
    learningObjective: 'Ubicar un número en la recta',
    requiresSubmission: false,
    module: { name: 'Módulo 1' },
  },
  lessonVersion: { content, estimatedMinutes: 20 },
});

beforeEach(() => {
  jest.clearAllMocks();
  mockResolveRenderAssets.mockResolvedValue(new Map());
  mockProgressFindFirst.mockResolvedValue(null);
});

describe('lo que no se abre', () => {
  it('un estado terminal de la cohorte manda sobre el tema, y no toca la base', async () => {
    mockGetCohortOutline.mockResolvedValue({
      gate: { kind: 'ACCESS_EXPIRED', accessUntil: '2026-09-01' },
      enrollmentId: 'e1',
      cohort: null,
      modules: [],
      resume: null,
      progress: { completed: 0, total: 0 },
      partnerFunded: false,
    });

    const view = await getLessonForStudent({ ...ARGS, assignmentId: 'a1' });

    expect(view.gate).toEqual({
      kind: 'COHORT',
      cohort: { kind: 'ACCESS_EXPIRED', accessUntil: '2026-09-01' },
    });
    expect(view.lesson).toBeNull();
    expect(mockAssignmentFindFirst).not.toHaveBeenCalled();
  });

  // Un id de otra cohorte y un id inventado contestan lo mismo: decir cuál es cuál
  // confirmaría qué ids son reales.
  it('una asignación que no está en la ruta da NOT_ASSIGNED sin consultar nada', async () => {
    mockGetCohortOutline.mockResolvedValue(outlineCon([item({ assignmentId: 'a1', title: 'A' })]));

    const view = await getLessonForStudent({ ...ARGS, assignmentId: 'otro' });

    expect(view.gate).toEqual({ kind: 'NOT_ASSIGNED' });
    expect(mockAssignmentFindFirst).not.toHaveBeenCalled();
  });

  it('una evaluación no se abre por la ruta de temas', async () => {
    mockGetCohortOutline.mockResolvedValue(
      outlineCon([item({ assignmentId: 'q1', title: 'Quiz', kind: 'ASSESSMENT' })])
    );

    const view = await getLessonForStudent({ ...ARGS, assignmentId: 'q1' });

    expect(view.gate).toEqual({ kind: 'NOT_ASSIGNED' });
  });

  // La prueba que importa: bloqueado por secuencia = sin contenido. No basta con no
  // pintarlo; no se trae.
  it('un tema bloqueado por la secuencia no devuelve contenido', async () => {
    mockGetCohortOutline.mockResolvedValue(
      outlineCon([
        item({ assignmentId: 'a1', title: 'A' }),
        item({ assignmentId: 'a2', title: 'B', position: 2, enabled: false, blockedBy: 'A' }),
      ])
    );

    const view = await getLessonForStudent({ ...ARGS, assignmentId: 'a2' });

    expect(view.gate).toEqual({ kind: 'BLOCKED', blockedBy: 'A' });
    expect(view.lesson).toBeNull();
    expect(mockAssignmentFindFirst).not.toHaveBeenCalled();
  });

  it.each([
    ['NOT_YET' as const, { kind: 'NOT_YET' }],
    ['CLOSED' as const, { kind: 'CLOSED' }],
  ])('una ventana de fecha %s tampoco devuelve contenido', async (reason, esperado) => {
    mockGetCohortOutline.mockResolvedValue(
      outlineCon([
        item({ assignmentId: 'a1', title: 'A', enabled: false, unavailableReason: reason }),
      ])
    );

    const view = await getLessonForStudent({ ...ARGS, assignmentId: 'a1' });

    expect(view.gate).toEqual(esperado);
    expect(view.lesson).toBeNull();
  });
});

describe('lo que se abre', () => {
  it('devuelve el contenido de la versión asignada, ya renderizado', async () => {
    mockGetCohortOutline.mockResolvedValue(outlineCon([item({ assignmentId: 'a1', title: 'A' })]));
    mockAssignmentFindFirst.mockResolvedValue(
      asignacion('## Sección\n\nUn párrafo con **algo** dentro.\n')
    );

    const view = await getLessonForStudent({ ...ARGS, assignmentId: 'a1' });

    expect(view.gate).toBeNull();
    expect(view.lesson?.title).toBe('Los números reales');
    expect(view.lesson?.html).toContain('<h2>Sección</h2>');
    expect(view.lesson?.html).toContain('<div lang="es-CO">');
    expect(view.lesson?.estimatedMinutes).toBe(20);
    expect(view.lesson?.form).toBe('MARKDOWN');
  });

  // Lo que sostiene el `dangerouslySetInnerHTML` de la pantalla del estudiante.
  it('el HTML viene saneado', async () => {
    mockGetCohortOutline.mockResolvedValue(outlineCon([item({ assignmentId: 'a1', title: 'A' })]));
    mockAssignmentFindFirst.mockResolvedValue(
      asignacion('## S\n\n<script>alert(1)</script>\n\n[x](javascript:alert(1))\n')
    );

    const view = await getLessonForStudent({ ...ARGS, assignmentId: 'a1' });

    expect(view.lesson?.html).not.toContain('script');
    expect(view.lesson?.html).not.toContain('javascript:');
  });

  // La consulta no se apoya en que la ruta hizo bien su parte.
  it('la asignación se busca acotada a la cohorte de la matrícula', async () => {
    mockGetCohortOutline.mockResolvedValue(outlineCon([item({ assignmentId: 'a1', title: 'A' })]));
    mockAssignmentFindFirst.mockResolvedValue(asignacion('## S\n\nTexto.\n'));

    await getLessonForStudent({ ...ARGS, assignmentId: 'a1' });

    expect(mockAssignmentFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'a1', cohortId: 'c1' } })
    );
  });

  it('un recurso que no se pudo resolver se dice, no se esconde', async () => {
    const assetId = 'cm1abcdefghijklmnopqrstuv';
    mockGetCohortOutline.mockResolvedValue(outlineCon([item({ assignmentId: 'a1', title: 'A' })]));
    mockAssignmentFindFirst.mockResolvedValue(
      asignacion(`## S\n\n![Diagrama del ciclo](asset:${assetId})\n`)
    );

    const view = await getLessonForStudent({ ...ARGS, assignmentId: 'a1' });

    expect(view.lesson?.missingAssets).toEqual([assetId]);
  });

  it('el anterior y el siguiente salen del orden del programa', async () => {
    mockGetCohortOutline.mockResolvedValue(
      outlineCon([
        item({ assignmentId: 'a1', title: 'A' }),
        item({ assignmentId: 'a2', title: 'B', position: 2 }),
        item({ assignmentId: 'a3', title: 'C', position: 3, enabled: false, blockedBy: 'B' }),
      ])
    );
    mockAssignmentFindFirst.mockResolvedValue(asignacion('## S\n\nTexto.\n'));

    const view = await getLessonForStudent({ ...ARGS, assignmentId: 'a2' });

    expect(view.navigation.previous?.assignmentId).toBe('a1');
    expect(view.navigation.next).toEqual(
      expect.objectContaining({ assignmentId: 'a3', enabled: false, blockedBy: 'B' })
    );
  });
});

describe('el progreso guardado', () => {
  beforeEach(() => {
    mockGetCohortOutline.mockResolvedValue(outlineCon([item({ assignmentId: 'a1', title: 'A' })]));
    mockAssignmentFindFirst.mockResolvedValue(asignacion('## S\n\nTexto.\n'));
  });

  it('sin fila de progreso devuelve null, no un cero inventado', async () => {
    const view = await getLessonForStudent({ ...ARGS, assignmentId: 'a1' });

    expect(view.progress).toBeNull();
  });

  it('lee la evidencia guardada', async () => {
    mockProgressFindFirst.mockResolvedValue({
      status: 'IN_PROGRESS',
      evidence: { secondsOnLesson: 95, scrolledToEnd: true, videoPositionSeconds: 12.5 },
      completedAt: null,
    });

    const view = await getLessonForStudent({ ...ARGS, assignmentId: 'a1' });

    expect(view.progress).toEqual({
      status: 'IN_PROGRESS',
      secondsOnLesson: 95,
      scrolledToEnd: true,
      videoPositionSeconds: 12.5,
      transcriptReadToEnd: false,
      completedAt: null,
    });
  });

  // `evidence` es `Json`: lo que vuelve de la base no está tipado. Una fila escrita por una
  // versión anterior del player no puede tumbar la pantalla.
  it('una evidencia con basura dentro no revienta', async () => {
    mockProgressFindFirst.mockResolvedValue({
      status: 'raro',
      evidence: { secondsOnLesson: 'mucho', scrolledToEnd: 'sí', videoPositionSeconds: null },
      completedAt: null,
    });

    const view = await getLessonForStudent({ ...ARGS, assignmentId: 'a1' });

    expect(view.progress).toEqual({
      status: 'NOT_STARTED',
      secondsOnLesson: 0,
      scrolledToEnd: false,
      videoPositionSeconds: null,
      transcriptReadToEnd: false,
      completedAt: null,
    });
  });

  it('una evidencia nula tampoco', async () => {
    mockProgressFindFirst.mockResolvedValue({
      status: 'COMPLETED',
      evidence: null,
      completedAt: new Date('2026-09-18T10:00:00.000Z'),
    });

    const view = await getLessonForStudent({ ...ARGS, assignmentId: 'a1' });

    expect(view.progress?.status).toBe('COMPLETED');
    expect(view.progress?.completedAt).toBe('2026-09-18T10:00:00.000Z');
  });
});
