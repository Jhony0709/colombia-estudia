/**
 * Tests for lesson-completion.ts
 * SSOT: reference/04-business-logic/contenido-y-evaluaciones.md:145-150
 */

import { isLessonCompleted, type IsLessonCompletedInput } from './lesson-completion';

// ─────────────────────────── Test Helpers ───────────────────────────

function createInput(overrides: Partial<IsLessonCompletedInput>): IsLessonCompletedInput {
  return {
    form: 'VIDEO',
    evidence: {},
    videoDurationSeconds: 100,
    estimatedMinutes: 5,
    submissionStatus: null,
    ...overrides,
  };
}

// ─────────────────────────── VIDEO ───────────────────────────

describe('isLessonCompleted - VIDEO', () => {
  it('position >= 90% → true', () => {
    const result = isLessonCompleted(
      createInput({
        form: 'VIDEO',
        evidence: { videoPositionSeconds: 90 },
        videoDurationSeconds: 100,
      })
    );
    expect(result).toBe(true);
  });

  it('position = 90% exactly → true', () => {
    const result = isLessonCompleted(
      createInput({
        form: 'VIDEO',
        evidence: { videoPositionSeconds: 90 },
        videoDurationSeconds: 100,
      })
    );
    expect(result).toBe(true);
  });

  it('position < 90% → false', () => {
    const result = isLessonCompleted(
      createInput({
        form: 'VIDEO',
        evidence: { videoPositionSeconds: 89 },
        videoDurationSeconds: 100,
      })
    );
    expect(result).toBe(false);
  });

  it('transcriptReadToEnd → true (regardless of position)', () => {
    const result = isLessonCompleted(
      createInput({
        form: 'VIDEO',
        evidence: { transcriptReadToEnd: true, videoPositionSeconds: 0 },
        videoDurationSeconds: 100,
      })
    );
    expect(result).toBe(true);
  });

  it('no evidence → false', () => {
    const result = isLessonCompleted(
      createInput({
        form: 'VIDEO',
        evidence: {},
        videoDurationSeconds: 100,
      })
    );
    expect(result).toBe(false);
  });

  it('AMBIGUO: videoDurationSeconds null → solo transcriptReadToEnd completa', () => {
    // Without transcript, cannot complete
    const result1 = isLessonCompleted(
      createInput({
        form: 'VIDEO',
        evidence: { videoPositionSeconds: 1000 },
        videoDurationSeconds: null,
      })
    );
    expect(result1).toBe(false);

    // With transcript, can complete
    const result2 = isLessonCompleted(
      createInput({
        form: 'VIDEO',
        evidence: { transcriptReadToEnd: true },
        videoDurationSeconds: null,
      })
    );
    expect(result2).toBe(true);
  });
});

// ─────────────────────────── MARKDOWN ───────────────────────────

describe('isLessonCompleted - MARKDOWN', () => {
  it('scrolledToEnd + sufficient time → true', () => {
    // estimatedMinutes = 5 → required = min(5*30, 120) = 120s
    const result = isLessonCompleted(
      createInput({
        form: 'MARKDOWN',
        evidence: { scrolledToEnd: true, secondsOnLesson: 120 },
        estimatedMinutes: 5,
      })
    );
    expect(result).toBe(true);
  });

  it('scrolledToEnd but insufficient time → false', () => {
    const result = isLessonCompleted(
      createInput({
        form: 'MARKDOWN',
        evidence: { scrolledToEnd: true, secondsOnLesson: 60 },
        estimatedMinutes: 5, // requires min(150, 120) = 120s
      })
    );
    expect(result).toBe(false);
  });

  it('sufficient time but no scroll → false', () => {
    const result = isLessonCompleted(
      createInput({
        form: 'MARKDOWN',
        evidence: { scrolledToEnd: false, secondsOnLesson: 200 },
        estimatedMinutes: 5,
      })
    );
    expect(result).toBe(false);
  });

  it('no evidence → false', () => {
    const result = isLessonCompleted(
      createInput({
        form: 'MARKDOWN',
        evidence: {},
        estimatedMinutes: 5,
      })
    );
    expect(result).toBe(false);
  });

  it('short lesson: estimatedMinutes = 1 → required = 30s', () => {
    // min(1*30, 120) = 30s
    const result = isLessonCompleted(
      createInput({
        form: 'MARKDOWN',
        evidence: { scrolledToEnd: true, secondsOnLesson: 30 },
        estimatedMinutes: 1,
      })
    );
    expect(result).toBe(true);
  });

  it('long lesson: estimatedMinutes = 10 → required = 120s (capped)', () => {
    // min(10*30, 120) = min(300, 120) = 120s
    const result = isLessonCompleted(
      createInput({
        form: 'MARKDOWN',
        evidence: { scrolledToEnd: true, secondsOnLesson: 120 },
        estimatedMinutes: 10,
      })
    );
    expect(result).toBe(true);
  });

  it('AMBIGUO: estimatedMinutes null → required = 120s', () => {
    const result = isLessonCompleted(
      createInput({
        form: 'MARKDOWN',
        evidence: { scrolledToEnd: true, secondsOnLesson: 120 },
        estimatedMinutes: null,
      })
    );
    expect(result).toBe(true);

    const result2 = isLessonCompleted(
      createInput({
        form: 'MARKDOWN',
        evidence: { scrolledToEnd: true, secondsOnLesson: 119 },
        estimatedMinutes: null,
      })
    );
    expect(result2).toBe(false);
  });
});

describe('isLessonCompleted - SUBMISSION', () => {
  it('APPROVED → true', () => {
    const result = isLessonCompleted(
      createInput({
        form: 'SUBMISSION',
        submissionStatus: 'APPROVED',
      })
    );
    expect(result).toBe(true);
  });

  it('SUBMITTED → false', () => {
    const result = isLessonCompleted(
      createInput({
        form: 'SUBMISSION',
        submissionStatus: 'SUBMITTED',
      })
    );
    expect(result).toBe(false);
  });

  it('RETURNED → false', () => {
    const result = isLessonCompleted(
      createInput({
        form: 'SUBMISSION',
        submissionStatus: 'RETURNED',
      })
    );
    expect(result).toBe(false);
  });

  it('null submissionStatus → false', () => {
    const result = isLessonCompleted(
      createInput({
        form: 'SUBMISSION',
        submissionStatus: null,
      })
    );
    expect(result).toBe(false);
  });
});
