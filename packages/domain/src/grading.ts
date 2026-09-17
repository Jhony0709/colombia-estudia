/**
 * Grading functions for assessments.
 * SSOT: reference/04-business-logic/contenido-y-evaluaciones.md:180-181, 212-213
 *
 * Imports types from @colombia-estudia/types (content.ts).
 * answerKey is server-only and excluded from client Prisma by default.
 */

import type { AssessmentContent, AnswerKey, QuestionContent } from '@colombia-estudia/types';

// ─────────────────────────── Types ───────────────────────────

export interface GradedQuestion {
  code: string;
  pointsAwarded: number;
  correct: boolean;
}

export interface GradeResult {
  perQuestion: GradedQuestion[];
  score: number;
  maxScore: number;
}

// ─────────────────────────── Helpers ───────────────────────────

/**
 * Normalizes text for short_text comparison.
 * SSOT: contenido-y-evaluaciones.md:131 "normalización explícita (tildes, mayúsculas, espacios)"
 *
 * Only the acute accent (tilde, U+0301) is removed: "Bogotá" ≡ "bogota". The ñ is a
 * different letter in Spanish and is preserved: "año" ≢ "ano".
 * // AMBIGUO(contenido-y-evaluaciones.md:131): la diéresis (ü) no se normaliza; "pingüino" ≢ "pinguino".
 */
export function normalizeText(text: string): string {
  return text
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\u0301/g, '')
    .normalize('NFC');
}

/**
 * Check if an answer matches for single_choice / true_false.
 */
function gradeChoiceQuestion(response: unknown, correct: string | string[]): boolean {
  if (typeof response !== 'string') return false;
  const correctValue = Array.isArray(correct) ? correct[0] : correct;
  return response === correctValue;
}

/**
 * Check if an answer matches for multiple_choice.
 * // AMBIGUO(contenido-y-evaluaciones.md:130): todo o nada, sin crédito parcial
 */
function gradeMultipleChoice(response: unknown, correct: string | string[]): boolean {
  if (!Array.isArray(response)) return false;
  const correctSet = new Set(Array.isArray(correct) ? correct : [correct]);
  const responseSet = new Set(response);

  if (correctSet.size !== responseSet.size) return false;
  for (const item of correctSet) {
    if (!responseSet.has(item)) return false;
  }
  return true;
}

/**
 * Check if an answer matches for short_text.
 * Compares normalized response against each accepted answer.
 */
function gradeShortText(response: unknown, correct: string | string[]): boolean {
  if (typeof response !== 'string') return false;
  const normalizedResponse = normalizeText(response);
  const acceptedAnswers = Array.isArray(correct) ? correct : [correct];

  return acceptedAnswers.some((answer) => normalizeText(answer) === normalizedResponse);
}

// ─────────────────────────── Main Functions ───────────────────────────

/**
 * Grade an attempt.
 *
 * maxScore = Σ answerKey[code].points
 *
 * @throws if a question has no answer key
 * @throws if QuestionContent.points !== answerKey[code].points
 *         // AMBIGUO(packages/types/src/content.ts:24,44)
 */
export function gradeAttempt(input: {
  content: AssessmentContent;
  answerKey: AnswerKey;
  answers: Record<string, { answer: unknown }>;
}): GradeResult {
  const { content, answerKey, answers } = input;
  const perQuestion: GradedQuestion[] = [];
  let totalScore = 0;
  let totalMaxScore = 0;

  for (const question of content.questions) {
    const key = answerKey[question.code];

    if (!key) {
      throw new Error(`Question ${question.code} has no answer key`);
    }

    // AMBIGUO(packages/types/src/content.ts:24,44): points must match
    if (question.points !== key.points) {
      throw new Error(
        `Question ${question.code} has mismatched points: content=${question.points}, answerKey=${key.points}`
      );
    }

    const studentAnswer = answers[question.code]?.answer;
    let isCorrect = false;

    switch (question.type) {
      case 'single_choice':
      case 'true_false':
        isCorrect = gradeChoiceQuestion(studentAnswer, key.correct);
        break;
      case 'multiple_choice':
        // AMBIGUO(contenido-y-evaluaciones.md:130): todo o nada
        isCorrect = gradeMultipleChoice(studentAnswer, key.correct);
        break;
      case 'short_text':
        isCorrect = gradeShortText(studentAnswer, key.correct);
        break;
    }

    const pointsAwarded = isCorrect ? key.points : 0;

    perQuestion.push({
      code: question.code,
      pointsAwarded,
      correct: isCorrect,
    });

    totalScore += pointsAwarded;
    totalMaxScore += key.points;
  }

  return {
    perQuestion,
    score: totalScore,
    maxScore: totalMaxScore,
  };
}

/**
 * Check if a score passes.
 * SSOT: contenido-y-evaluaciones.md:40-42
 *
 * passPercent null = any GRADED passes.
 * // AMBIGUO: maxScore 0 → no aprueba
 *
 * @returns true if passing (fraction 0-1 internally, passPercent is 0-100)
 */
export function isPassing(input: {
  score: number;
  maxScore: number;
  passPercent: number | null;
}): boolean {
  const { score, maxScore, passPercent } = input;

  // AMBIGUO: maxScore 0 → no aprueba
  if (maxScore === 0) {
    return false;
  }

  // passPercent null = any GRADED passes
  if (passPercent === null) {
    return true;
  }

  const percent = (score / maxScore) * 100;
  return percent >= passPercent;
}

/**
 * Derive score from attempts.
 * SSOT: contenido-y-evaluaciones.md:212-213
 *
 * Score 0–100 with 2 decimals from the best GRADED attempt.
 * Returns null if no GRADED attempts.
 */
export function deriveScore(
  attempts: Array<{
    id: string;
    status: 'IN_PROGRESS' | 'SUBMITTED' | 'EXPIRED' | 'GRADED';
    score: number;
    maxScore: number;
  }>
): { value: number; sourceAttemptId: string } | null {
  const gradedAttempts = attempts.filter((a) => a.status === 'GRADED');

  if (gradedAttempts.length === 0) {
    return null;
  }

  // Find best attempt by percent
  let best = gradedAttempts[0]!;
  let bestPercent = best.maxScore > 0 ? (best.score / best.maxScore) * 100 : 0;

  for (let i = 1; i < gradedAttempts.length; i++) {
    const attempt = gradedAttempts[i]!;
    const percent = attempt.maxScore > 0 ? (attempt.score / attempt.maxScore) * 100 : 0;
    if (percent > bestPercent) {
      best = attempt;
      bestPercent = percent;
    }
  }

  // Round to 2 decimals
  const value = Math.round(bestPercent * 100) / 100;

  return {
    value,
    sourceAttemptId: best.id,
  };
}
