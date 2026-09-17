/**
 * Tests for grading.ts
 * SSOT: reference/04-business-logic/contenido-y-evaluaciones.md:180-181, 212-213
 */

import { normalizeText, gradeAttempt, isPassing, deriveScore } from './grading';
import type { AssessmentContent, AnswerKey } from '@colombia-estudia/types';

// ─────────────────────────── Test Helpers ───────────────────────────

function createContent(questions: AssessmentContent['questions']): AssessmentContent {
  return { questions };
}

function createAnswerKey(
  entries: Array<{
    code: string;
    correct: string | string[];
    points: number;
  }>
): AnswerKey {
  const key: AnswerKey = {};
  for (const entry of entries) {
    key[entry.code] = {
      correct: Array.isArray(entry.correct) ? entry.correct : [entry.correct],
      points: entry.points,
    };
  }
  return key;
}

// ─────────────────────────── normalizeText ───────────────────────────

describe('normalizeText', () => {
  it('trims whitespace', () => {
    expect(normalizeText('  hello  ')).toBe('hello');
  });

  it('collapses multiple spaces', () => {
    expect(normalizeText('hello    world')).toBe('hello world');
  });

  it('converts to lowercase', () => {
    expect(normalizeText('HELLO WORLD')).toBe('hello world');
  });

  it('removes diacritics (NFD normalization)', () => {
    expect(normalizeText('Bogotá')).toBe('bogota');
    expect(normalizeText('café')).toBe('cafe');
    expect(normalizeText('niño')).toBe('niño'); // la ñ es otra letra: se conserva
    expect(normalizeText('año')).not.toBe(normalizeText('ano'));
    expect(normalizeText('pingüino')).toBe('pingüino'); // AMBIGUO(:131): diéresis no se normaliza
  });

  it('handles combined normalization', () => {
    expect(normalizeText('  BOGOTÁ   tiene  CAFÉ  ')).toBe('bogota tiene cafe');
  });
});

// ─────────────────────────── gradeAttempt ───────────────────────────

describe('gradeAttempt', () => {
  describe('single_choice', () => {
    it('correct answer gets full points', () => {
      const content = createContent([
        { code: 'q1', type: 'single_choice', text: 'Q1', points: 10 },
      ]);
      const answerKey = createAnswerKey([{ code: 'q1', correct: 'a', points: 10 }]);

      const result = gradeAttempt({
        content,
        answerKey,
        answers: { q1: { answer: 'a' } },
      });

      expect(result.perQuestion[0]!.correct).toBe(true);
      expect(result.perQuestion[0]!.pointsAwarded).toBe(10);
      expect(result.score).toBe(10);
      expect(result.maxScore).toBe(10);
    });

    it('incorrect answer gets zero points', () => {
      const content = createContent([
        { code: 'q1', type: 'single_choice', text: 'Q1', points: 10 },
      ]);
      const answerKey = createAnswerKey([{ code: 'q1', correct: 'a', points: 10 }]);

      const result = gradeAttempt({
        content,
        answerKey,
        answers: { q1: { answer: 'b' } },
      });

      expect(result.perQuestion[0]!.correct).toBe(false);
      expect(result.perQuestion[0]!.pointsAwarded).toBe(0);
      expect(result.score).toBe(0);
      expect(result.maxScore).toBe(10);
    });
  });

  describe('true_false', () => {
    it('correct answer gets full points', () => {
      const content = createContent([{ code: 'q1', type: 'true_false', text: 'Q1', points: 5 }]);
      const answerKey = createAnswerKey([{ code: 'q1', correct: 'true', points: 5 }]);

      const result = gradeAttempt({
        content,
        answerKey,
        answers: { q1: { answer: 'true' } },
      });

      expect(result.perQuestion[0]!.correct).toBe(true);
      expect(result.score).toBe(5);
    });
  });

  describe('multiple_choice', () => {
    it('exact set match gets full points', () => {
      const content = createContent([
        { code: 'q1', type: 'multiple_choice', text: 'Q1', points: 10 },
      ]);
      const answerKey = createAnswerKey([{ code: 'q1', correct: ['a', 'c'], points: 10 }]);

      const result = gradeAttempt({
        content,
        answerKey,
        answers: { q1: { answer: ['a', 'c'] } },
      });

      expect(result.perQuestion[0]!.correct).toBe(true);
      expect(result.score).toBe(10);
    });

    it('AMBIGUO: partial match gets zero - todo o nada', () => {
      // AMBIGUO(contenido-y-evaluaciones.md:130): todo o nada, sin crédito parcial
      const content = createContent([
        { code: 'q1', type: 'multiple_choice', text: 'Q1', points: 10 },
      ]);
      const answerKey = createAnswerKey([{ code: 'q1', correct: ['a', 'c'], points: 10 }]);

      const result = gradeAttempt({
        content,
        answerKey,
        answers: { q1: { answer: ['a'] } }, // Missing 'c'
      });

      expect(result.perQuestion[0]!.correct).toBe(false);
      expect(result.score).toBe(0);
    });

    it('extra selections gets zero', () => {
      const content = createContent([
        { code: 'q1', type: 'multiple_choice', text: 'Q1', points: 10 },
      ]);
      const answerKey = createAnswerKey([{ code: 'q1', correct: ['a', 'c'], points: 10 }]);

      const result = gradeAttempt({
        content,
        answerKey,
        answers: { q1: { answer: ['a', 'c', 'b'] } }, // Extra 'b'
      });

      expect(result.perQuestion[0]!.correct).toBe(false);
      expect(result.score).toBe(0);
    });

    it('order does not matter', () => {
      const content = createContent([
        { code: 'q1', type: 'multiple_choice', text: 'Q1', points: 10 },
      ]);
      const answerKey = createAnswerKey([{ code: 'q1', correct: ['a', 'c'], points: 10 }]);

      const result = gradeAttempt({
        content,
        answerKey,
        answers: { q1: { answer: ['c', 'a'] } }, // Different order
      });

      expect(result.perQuestion[0]!.correct).toBe(true);
    });
  });

  describe('short_text', () => {
    it('exact match with normalization', () => {
      const content = createContent([{ code: 'q1', type: 'short_text', text: 'Q1', points: 10 }]);
      const answerKey = createAnswerKey([{ code: 'q1', correct: 'Bogotá', points: 10 }]);

      const result = gradeAttempt({
        content,
        answerKey,
        answers: { q1: { answer: 'bogota' } },
      });

      expect(result.perQuestion[0]!.correct).toBe(true);
    });

    it('multiple accepted answers', () => {
      const content = createContent([{ code: 'q1', type: 'short_text', text: 'Q1', points: 10 }]);
      const answerKey = createAnswerKey([
        { code: 'q1', correct: ['Colombia', 'República de Colombia'], points: 10 },
      ]);

      const result1 = gradeAttempt({
        content,
        answerKey,
        answers: { q1: { answer: 'colombia' } },
      });
      expect(result1.perQuestion[0]!.correct).toBe(true);

      const result2 = gradeAttempt({
        content,
        answerKey,
        answers: { q1: { answer: 'republica de colombia' } },
      });
      expect(result2.perQuestion[0]!.correct).toBe(true);
    });

    it('incorrect answer', () => {
      const content = createContent([{ code: 'q1', type: 'short_text', text: 'Q1', points: 10 }]);
      const answerKey = createAnswerKey([{ code: 'q1', correct: 'Bogotá', points: 10 }]);

      const result = gradeAttempt({
        content,
        answerKey,
        answers: { q1: { answer: 'medellin' } },
      });

      expect(result.perQuestion[0]!.correct).toBe(false);
    });
  });

  describe('error cases', () => {
    it('throws if question has no answer key', () => {
      const content = createContent([
        { code: 'q1', type: 'single_choice', text: 'Q1', points: 10 },
      ]);
      const answerKey: AnswerKey = {}; // Missing q1

      expect(() => gradeAttempt({ content, answerKey, answers: {} })).toThrow(
        'Question q1 has no answer key'
      );
    });

    it('AMBIGUO: throws if points mismatch', () => {
      // AMBIGUO(packages/types/src/content.ts:24,44)
      const content = createContent([
        { code: 'q1', type: 'single_choice', text: 'Q1', points: 10 },
      ]);
      const answerKey = createAnswerKey([
        { code: 'q1', correct: 'a', points: 5 }, // Mismatch!
      ]);

      expect(() => gradeAttempt({ content, answerKey, answers: {} })).toThrow('mismatched points');
    });
  });

  describe('maxScore calculation', () => {
    it('maxScore = sum of answerKey points', () => {
      const content = createContent([
        { code: 'q1', type: 'single_choice', text: 'Q1', points: 10 },
        { code: 'q2', type: 'single_choice', text: 'Q2', points: 20 },
        { code: 'q3', type: 'single_choice', text: 'Q3', points: 15 },
      ]);
      const answerKey = createAnswerKey([
        { code: 'q1', correct: 'a', points: 10 },
        { code: 'q2', correct: 'b', points: 20 },
        { code: 'q3', correct: 'c', points: 15 },
      ]);

      const result = gradeAttempt({
        content,
        answerKey,
        answers: {},
      });

      expect(result.maxScore).toBe(45);
    });
  });
});

// ─────────────────────────── isPassing ───────────────────────────

describe('isPassing', () => {
  it('passPercent null = any GRADED passes', () => {
    expect(isPassing({ score: 1, maxScore: 100, passPercent: null })).toBe(true);
    expect(isPassing({ score: 0, maxScore: 100, passPercent: null })).toBe(true);
  });

  it('passPercent 70 with score 70% passes', () => {
    expect(isPassing({ score: 70, maxScore: 100, passPercent: 70 })).toBe(true);
  });

  it('passPercent 70 with score 69% fails', () => {
    expect(isPassing({ score: 69, maxScore: 100, passPercent: 70 })).toBe(false);
  });

  it('AMBIGUO: maxScore 0 → no aprueba', () => {
    expect(isPassing({ score: 0, maxScore: 0, passPercent: null })).toBe(false);
  });

  it('exact boundary: 80% with passPercent 80', () => {
    expect(isPassing({ score: 80, maxScore: 100, passPercent: 80 })).toBe(true);
  });
});

// ─────────────────────────── deriveScore ───────────────────────────

describe('deriveScore', () => {
  it('returns null if no GRADED attempts', () => {
    const attempts = [
      { id: 'a1', status: 'IN_PROGRESS' as const, score: 0, maxScore: 100 },
      { id: 'a2', status: 'SUBMITTED' as const, score: 50, maxScore: 100 },
    ];

    expect(deriveScore(attempts)).toBeNull();
  });

  it('returns best GRADED attempt percent', () => {
    const attempts = [
      { id: 'a1', status: 'GRADED' as const, score: 70, maxScore: 100 },
      { id: 'a2', status: 'GRADED' as const, score: 85, maxScore: 100 },
      { id: 'a3', status: 'IN_PROGRESS' as const, score: 90, maxScore: 100 },
    ];

    const result = deriveScore(attempts);
    expect(result?.value).toBe(85);
    expect(result?.sourceAttemptId).toBe('a2');
  });

  it('value is 0-100 with 2 decimals', () => {
    const attempts = [{ id: 'a1', status: 'GRADED' as const, score: 1, maxScore: 3 }];

    const result = deriveScore(attempts);
    // 1/3 = 33.333... → rounded to 33.33
    expect(result?.value).toBe(33.33);
  });

  it('handles maxScore 0', () => {
    const attempts = [{ id: 'a1', status: 'GRADED' as const, score: 0, maxScore: 0 }];

    const result = deriveScore(attempts);
    expect(result?.value).toBe(0);
  });

  it('ignores non-GRADED attempts', () => {
    const attempts = [
      { id: 'a1', status: 'EXPIRED' as const, score: 100, maxScore: 100 },
      { id: 'a2', status: 'GRADED' as const, score: 50, maxScore: 100 },
    ];

    const result = deriveScore(attempts);
    expect(result?.value).toBe(50);
    expect(result?.sourceAttemptId).toBe('a2');
  });
});
