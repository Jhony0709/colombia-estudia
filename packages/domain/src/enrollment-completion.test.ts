/**
 * Tests for enrollment-completion.ts
 * SSOT: reference/04-business-logic/contenido-y-evaluaciones.md:33-42
 */

import {
  isEnrollmentCompleted,
  getUnlockState,
  type ModuleInput,
  type AssessmentInput,
  type LessonInput,
} from './enrollment-completion';

// ─────────────────────────── Test Helpers ───────────────────────────

function createLesson(overrides: Partial<LessonInput> & { id: string }): LessonInput {
  return {
    position: 1,
    title: `Lesson ${overrides.id}`,
    progressStatus: 'NOT_STARTED',
    ...overrides,
  };
}

function createAssessment(overrides: Partial<AssessmentInput> & { id: string }): AssessmentInput {
  return {
    position: 1,
    title: `Assessment ${overrides.id}`,
    kind: 'SUBJECT',
    passPercent: 60,
    attemptsAllowed: 3,
    attempts: [],
    ...overrides,
  };
}

function createModule(overrides: Partial<ModuleInput> & { id: string }): ModuleInput {
  return {
    position: 1,
    name: `Module ${overrides.id}`,
    lessons: [],
    assessments: [],
    ...overrides,
  };
}

// ─────────────────────────── isEnrollmentCompleted ───────────────────────────

describe('isEnrollmentCompleted', () => {
  it('true cuando todo completo', () => {
    const modules = [
      createModule({
        id: 'm1',
        lessons: [createLesson({ id: 'l1', progressStatus: 'COMPLETED' })],
        assessments: [
          createAssessment({
            id: 'a1',
            kind: 'SUBJECT',
            passPercent: 60,
            attempts: [{ status: 'GRADED', score: 70, maxScore: 100 }],
          }),
        ],
      }),
    ];

    expect(isEnrollmentCompleted({ progression: 'LINEAR', modules })).toBe(true);
  });

  it('false con lección pendiente', () => {
    const modules = [
      createModule({
        id: 'm1',
        lessons: [
          createLesson({ id: 'l1', progressStatus: 'COMPLETED' }),
          createLesson({ id: 'l2', progressStatus: 'IN_PROGRESS' }),
        ],
        assessments: [],
      }),
    ];

    expect(isEnrollmentCompleted({ progression: 'LINEAR', modules })).toBe(false);
  });

  it('false con assessment no pasado', () => {
    const modules = [
      createModule({
        id: 'm1',
        lessons: [createLesson({ id: 'l1', progressStatus: 'COMPLETED' })],
        assessments: [
          createAssessment({
            id: 'a1',
            kind: 'SUBJECT',
            passPercent: 60,
            attempts: [{ status: 'GRADED', score: 50, maxScore: 100 }],
          }),
        ],
      }),
    ];

    expect(isEnrollmentCompleted({ progression: 'LINEAR', modules })).toBe(false);
  });

  it('DIAGNOSTIC no cuenta para completion', () => {
    const modules = [
      createModule({
        id: 'm1',
        lessons: [createLesson({ id: 'l1', progressStatus: 'COMPLETED' })],
        assessments: [
          createAssessment({
            id: 'd1',
            kind: 'DIAGNOSTIC',
            passPercent: 60,
            attempts: [{ status: 'GRADED', score: 0, maxScore: 100 }], // Failed
          }),
          createAssessment({
            id: 'a1',
            kind: 'SUBJECT',
            passPercent: 60,
            attempts: [{ status: 'GRADED', score: 70, maxScore: 100 }],
          }),
        ],
      }),
    ];

    // Should complete even though DIAGNOSTIC failed
    expect(isEnrollmentCompleted({ progression: 'LINEAR', modules })).toBe(true);
  });

  it('agotar intentos NO completa la matrícula: aprobar es score/maxScore × 100 ≥ passPercent (:40-42)', () => {
    const modules = [
      createModule({
        id: 'm1',
        lessons: [createLesson({ id: 'l1', progressStatus: 'COMPLETED' })],
        assessments: [
          createAssessment({
            id: 'a1',
            kind: 'SUBJECT',
            passPercent: 60,
            attemptsAllowed: 2,
            attempts: [
              { status: 'GRADED', score: 50, maxScore: 100 },
              { status: 'GRADED', score: 55, maxScore: 100 }, // Still failed, but exhausted
            ],
          }),
        ],
      }),
    ];

    expect(isEnrollmentCompleted({ progression: 'LINEAR', modules })).toBe(false);
  });

  it('passPercent nulo: cualquier GRADED aprueba (:42)', () => {
    const modules = [
      createModule({
        id: 'm1',
        lessons: [createLesson({ id: 'l1', progressStatus: 'COMPLETED' })],
        assessments: [
          createAssessment({
            id: 'a1',
            kind: 'SUBJECT',
            passPercent: null,
            attempts: [{ status: 'GRADED', score: 1, maxScore: 100 }],
          }),
        ],
      }),
    ];

    expect(isEnrollmentCompleted({ progression: 'LINEAR', modules })).toBe(true);
  });
});

// ─────────────────────────── getUnlockState - orden por position ───────────────────────────

describe('getUnlockState - orden por position', () => {
  it('los módulos se ordenan por position aunque lleguen desordenados', () => {
    const modules = [
      createModule({
        id: 'm2',
        position: 2,
        lessons: [createLesson({ id: 'l2', position: 1, progressStatus: 'NOT_STARTED' })],
        assessments: [],
      }),
      createModule({
        id: 'm1',
        position: 1,
        lessons: [createLesson({ id: 'l1', position: 1, progressStatus: 'NOT_STARTED' })],
        assessments: [
          createAssessment({
            id: 'a1',
            kind: 'SUBJECT',
            passPercent: 60,
            attempts: [],
          }),
        ],
      }),
    ];

    const state = getUnlockState({ progression: 'LINEAR', modules });

    expect(state.get('l1')).toEqual({ unlocked: true });
    expect(state.get('l2')).toEqual({
      unlocked: false,
      blockedBy: { kind: 'module', id: 'm1', title: expect.any(String) },
    });
  });

  it('agotar intentos cuenta EXPIRED y SUBMITTED como intentos usados (AMBIGUO :35)', () => {
    const modules = [
      createModule({
        id: 'm1',
        position: 1,
        lessons: [createLesson({ id: 'l1', position: 1, progressStatus: 'COMPLETED' })],
        assessments: [
          createAssessment({
            id: 'a1',
            kind: 'SUBJECT',
            passPercent: 60,
            attemptsAllowed: 2,
            attempts: [
              { status: 'GRADED', score: 10, maxScore: 100 },
              { status: 'EXPIRED', score: 0, maxScore: 100 },
            ],
          }),
        ],
      }),
      createModule({
        id: 'm2',
        position: 2,
        lessons: [createLesson({ id: 'l2', position: 1, progressStatus: 'NOT_STARTED' })],
        assessments: [],
      }),
    ];

    const state = getUnlockState({ progression: 'LINEAR', modules });
    expect(state.get('l2')).toEqual({ unlocked: true });
  });
});

// ─────────────────────────── getUnlockState - FREE ───────────────────────────

describe('getUnlockState - FREE progression', () => {
  it('FREE todo desbloqueado', () => {
    const modules = [
      createModule({
        id: 'm1',
        lessons: [createLesson({ id: 'l1', position: 1 }), createLesson({ id: 'l2', position: 2 })],
        assessments: [createAssessment({ id: 'a1' })],
      }),
      createModule({
        id: 'm2',
        position: 2,
        lessons: [createLesson({ id: 'l3' })],
        assessments: [],
      }),
    ];

    const result = getUnlockState({ progression: 'FREE', modules });

    expect(result.get('l1')).toEqual({ unlocked: true });
    expect(result.get('l2')).toEqual({ unlocked: true });
    expect(result.get('l3')).toEqual({ unlocked: true });
    expect(result.get('a1')).toEqual({ unlocked: true });
  });
});

// ─────────────────────────── getUnlockState - LINEAR ───────────────────────────

describe('getUnlockState - LINEAR progression', () => {
  it('tema 1 bloqueado por DIAGNOSTIC hasta GRADED; sin DIAGNOSTIC, desbloqueado', () => {
    // With DIAGNOSTIC not attempted
    const modulesWithDiag = [
      createModule({
        id: 'm1',
        lessons: [createLesson({ id: 'l1', position: 1 })],
        assessments: [
          createAssessment({
            id: 'd1',
            kind: 'DIAGNOSTIC',
            position: 0,
            attempts: [], // Not attempted
          }),
        ],
      }),
    ];

    const result1 = getUnlockState({ progression: 'LINEAR', modules: modulesWithDiag });
    expect(result1.get('l1')).toEqual({
      unlocked: false,
      blockedBy: { kind: 'assessment', id: 'd1', title: 'Assessment d1' },
    });

    // With DIAGNOSTIC attempted
    const modulesWithDiagAttempted = [
      createModule({
        id: 'm1',
        lessons: [createLesson({ id: 'l1', position: 1 })],
        assessments: [
          createAssessment({
            id: 'd1',
            kind: 'DIAGNOSTIC',
            position: 0,
            attempts: [{ status: 'GRADED', score: 30, maxScore: 100 }], // Failed but GRADED
          }),
        ],
      }),
    ];

    const result2 = getUnlockState({ progression: 'LINEAR', modules: modulesWithDiagAttempted });
    expect(result2.get('l1')).toEqual({ unlocked: true });

    // Without DIAGNOSTIC
    const modulesNoDiag = [
      createModule({
        id: 'm1',
        lessons: [createLesson({ id: 'l1', position: 1 })],
        assessments: [],
      }),
    ];

    const result3 = getUnlockState({ progression: 'LINEAR', modules: modulesNoDiag });
    expect(result3.get('l1')).toEqual({ unlocked: true });
  });

  it('LINEAR tema N bloqueado si N-1 incompleto', () => {
    const modules = [
      createModule({
        id: 'm1',
        lessons: [
          createLesson({ id: 'l1', position: 1, progressStatus: 'NOT_STARTED' }),
          createLesson({ id: 'l2', position: 2 }),
        ],
        assessments: [],
      }),
    ];

    const result = getUnlockState({ progression: 'LINEAR', modules });

    expect(result.get('l1')).toEqual({ unlocked: true });
    expect(result.get('l2')).toEqual({
      unlocked: false,
      blockedBy: { kind: 'lesson', id: 'l1', title: 'Lesson l1' },
    });
  });

  it('LINEAR tema N desbloqueado si N-1 completo', () => {
    const modules = [
      createModule({
        id: 'm1',
        lessons: [
          createLesson({ id: 'l1', position: 1, progressStatus: 'COMPLETED' }),
          createLesson({ id: 'l2', position: 2 }),
        ],
        assessments: [],
      }),
    ];

    const result = getUnlockState({ progression: 'LINEAR', modules });

    expect(result.get('l1')).toEqual({ unlocked: true });
    expect(result.get('l2')).toEqual({ unlocked: true });
  });

  it('LINEAR SUBJECT bloqueado si temas incompletos (AMBIGUO: todos los del módulo)', () => {
    const modules = [
      createModule({
        id: 'm1',
        lessons: [
          createLesson({ id: 'l1', position: 1, progressStatus: 'COMPLETED' }),
          createLesson({ id: 'l2', position: 2, progressStatus: 'NOT_STARTED' }),
        ],
        assessments: [createAssessment({ id: 'a1', kind: 'SUBJECT', position: 1 })],
      }),
    ];

    const result = getUnlockState({ progression: 'LINEAR', modules });

    expect(result.get('a1')).toEqual({
      unlocked: false,
      blockedBy: { kind: 'lesson', id: 'l2', title: 'Lesson l2' },
    });
  });

  it('LINEAR módulo siguiente bloqueado si assessments no aprobados', () => {
    const modules = [
      createModule({
        id: 'm1',
        position: 1,
        lessons: [createLesson({ id: 'l1', progressStatus: 'COMPLETED' })],
        assessments: [
          createAssessment({
            id: 'a1',
            kind: 'SUBJECT',
            passPercent: 60,
            attempts: [{ status: 'GRADED', score: 50, maxScore: 100 }], // Failed
          }),
        ],
      }),
      createModule({
        id: 'm2',
        position: 2,
        lessons: [createLesson({ id: 'l2' })],
        assessments: [],
      }),
    ];

    const result = getUnlockState({ progression: 'LINEAR', modules });

    expect(result.get('l2')).toEqual({
      unlocked: false,
      blockedBy: { kind: 'module', id: 'm1', title: 'Module m1' },
    });
  });

  it('agotar intentos también desbloquea', () => {
    const modules = [
      createModule({
        id: 'm1',
        position: 1,
        lessons: [createLesson({ id: 'l1', progressStatus: 'COMPLETED' })],
        assessments: [
          createAssessment({
            id: 'a1',
            kind: 'SUBJECT',
            passPercent: 60,
            attemptsAllowed: 2,
            attempts: [
              { status: 'GRADED', score: 50, maxScore: 100 },
              { status: 'GRADED', score: 55, maxScore: 100 }, // Failed but exhausted
            ],
          }),
        ],
      }),
      createModule({
        id: 'm2',
        position: 2,
        lessons: [createLesson({ id: 'l2' })],
        assessments: [],
      }),
    ];

    const result = getUnlockState({ progression: 'LINEAR', modules });

    // Module 2 should be unlocked because attempts exhausted
    expect(result.get('l2')).toEqual({ unlocked: true });
  });

  it('DIAGNOSTIC reprobada no bloquea (solo necesita ser GRADED)', () => {
    const modules = [
      createModule({
        id: 'm1',
        lessons: [createLesson({ id: 'l1', position: 1, progressStatus: 'COMPLETED' })],
        assessments: [
          createAssessment({
            id: 'd1',
            kind: 'DIAGNOSTIC',
            position: 0,
            passPercent: 60,
            attempts: [{ status: 'GRADED', score: 20, maxScore: 100 }], // Failed but GRADED
          }),
          createAssessment({
            id: 'a1',
            kind: 'SUBJECT',
            position: 1,
            passPercent: 60,
            attempts: [{ status: 'GRADED', score: 70, maxScore: 100 }],
          }),
        ],
      }),
      createModule({
        id: 'm2',
        position: 2,
        lessons: [createLesson({ id: 'l2' })],
        assessments: [],
      }),
    ];

    const result = getUnlockState({ progression: 'LINEAR', modules });

    // First lesson is unlocked (DIAGNOSTIC was GRADED)
    expect(result.get('l1')).toEqual({ unlocked: true });
    // Module 2 unlocked because DIAGNOSTIC doesn't count for progression
    expect(result.get('l2')).toEqual({ unlocked: true });
  });

  it('program-level DIAGNOSTIC blocks first module first lesson', () => {
    const programAssessments = [
      createAssessment({
        id: 'prog-diag',
        kind: 'DIAGNOSTIC',
        attempts: [], // Not attempted
      }),
    ];

    const modules = [
      createModule({
        id: 'm1',
        lessons: [createLesson({ id: 'l1', position: 1 })],
        assessments: [],
      }),
    ];

    const result = getUnlockState({
      progression: 'LINEAR',
      modules,
      programAssessments,
    });

    expect(result.get('l1')).toEqual({
      unlocked: false,
      blockedBy: { kind: 'assessment', id: 'prog-diag', title: 'Assessment prog-diag' },
    });
  });
});
