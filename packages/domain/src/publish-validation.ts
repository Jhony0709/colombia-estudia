/**
 * Content publication validation.
 * SSOT: reference/04-business-logic/contenido-y-evaluaciones.md:108-138
 *
 * Each row in the validation tables is a rule with a test case.
 * legacyException: only the importer can set this; it downgrades accessibility
 * errors to warnings while preserving all other rules.
 */

import type {
  ParsedLesson,
  LessonAssetInfo,
  ContentIssue,
  AssetRef,
  AssessmentContent,
  AnswerKey,
} from '@colombia-estudia/types';
import {
  parseLessonMarkdown,
  latexCompiles,
  AssessmentContentSchema,
  AnswerKeySchema,
} from '@colombia-estudia/types';

// ─────────────────────────── Types ───────────────────────────

export interface ValidateLessonInput {
  parsed: ParsedLesson;
  assets: Map<string, LessonAssetInfo>;
  institutionId: string;
  lesson: {
    language: string;
    subjectName: string;
  };
  legacyException: boolean;
}

export interface ValidationResult {
  ok: boolean;
  errors: ContentIssue[];
  warnings: ContentIssue[];
}

// ─────────────────────────── Constants ───────────────────────────

/** Pattern for file names used as alt text: IMG_2024.png, foto.jpg, etc. */
const FILENAME_ALT_PATTERN = /^[\w-]+\.(png|jpe?g|gif|webp|svg)$/i;

/** Minimum alt text length for descriptive requirement */
const MIN_ALT_LENGTH = 3;

/** Alt text length threshold for chart/diagram detection */
const CHART_ALT_THRESHOLD = 250;

/**
 * Non-descriptive link texts.
 * contenido-y-evaluaciones.md:121 — closed list.
 * // AMBIGUO(:121): lista cerrada de textos prohibidos
 */
const NON_DESCRIPTIVE_LINK_TEXTS = new Set([
  'clic aquí',
  'click aquí',
  'aquí',
  'ver más',
  'leer más',
  'link',
  'enlace',
]);

// ─────────────────────────── Helpers ───────────────────────────

function normalizeText(text: string): string {
  return text.trim().toLowerCase();
}

function isEnglishSubject(subjectName: string): boolean {
  const normalized = normalizeText(subjectName)
    .normalize('NFD')
    .replace(/\u0301/g, ''); // Remove acute accents
  return normalized.includes('ingles') || normalized.includes('english');
}

/**
 * :115 "una tabla o texto con los datos" cerca del gráfico: se buscan los `lookAhead`
 * nodos hermanos (bloques de nivel superior) que siguen al bloque que contiene la imagen.
 * // AMBIGUO(contenido-y-evaluaciones.md:115): "cerca" = los 3 bloques siguientes; solo cuenta una tabla GFM.
 */
function findNearbyTable(
  parsed: ParsedLesson,
  assetPosition: { line?: number } | undefined,
  lookAhead: number = 3
): boolean {
  const line = assetPosition?.line;
  if (!line) return false;

  const blocks = parsed.ast.children;
  const index = blocks.findIndex((block) => {
    const start = block.position?.start.line;
    const end = block.position?.end.line;
    return start !== undefined && end !== undefined && start <= line && line <= end;
  });
  if (index === -1) return false;

  return blocks.slice(index + 1, index + 1 + lookAhead).some((block) => block.type === 'table');
}

/**
 * Alt-text rules shared by lesson images and assessment statement images (:114).
 * Returns the failing rule or null.
 */
function imageAltProblem(alt: string): { rule: string; message: string; fix: string } | null {
  if (!alt) {
    return {
      rule: 'image-alt-required',
      message: 'Image requires alternative text',
      fix: 'Add descriptive alt text: ![description](asset:id)',
    };
  }
  if (FILENAME_ALT_PATTERN.test(alt)) {
    return {
      rule: 'image-alt-not-filename',
      message: `Alt text cannot be a filename: "${alt}"`,
      fix: 'Use descriptive text that explains the image content.',
    };
  }
  // // AMBIGUO(:114): "descriptivo" no está definido; se exige ≥ 3 caracteres y ≠ nombre de archivo
  if (alt.length < MIN_ALT_LENGTH) {
    return {
      rule: 'image-alt-descriptive',
      message: `Alt text must be at least ${MIN_ALT_LENGTH} characters`,
      fix: 'Describe what the image shows.',
    };
  }
  return null;
}

// ─────────────────────────── Lesson Validation ───────────────────────────

/**
 * Validate a lesson for publication.
 * SSOT: contenido-y-evaluaciones.md:112-124
 *
 * @param input - Parsed lesson content and metadata
 * @returns Validation result with ok, errors, and warnings
 */
export function validateLessonForPublish(input: ValidateLessonInput): ValidationResult {
  const { parsed, assets, institutionId, lesson, legacyException } = input;
  const errors: ContentIssue[] = [];
  const warnings: ContentIssue[] = [];

  // Propagate parser syntax issues (:123)
  for (const issue of parsed.issues) {
    if (issue.severity === 'error') {
      errors.push(issue);
    } else {
      warnings.push(issue);
    }
  }

  // Validate each asset reference
  for (const assetRef of parsed.assets) {
    validateAssetRef(assetRef, assets, institutionId, legacyException, errors, warnings);
  }

  // Validate images for alt text
  for (const assetRef of parsed.assets) {
    if (assetRef.kind === 'image') {
      validateImageAlt(assetRef, parsed, legacyException, errors, warnings);
    }
  }

  // Validate headings (:60, :120)
  validateHeadings(parsed, errors);

  // Validate links (:121)
  validateLinks(parsed, errors);

  // Validate tables (:122)
  validateTables(parsed, errors);

  // Validate LaTeX (:119)
  validateLatex(parsed, errors);

  // English lesson warning (:124)
  // // AMBIGUO(:124): detección por nombre de asignatura
  if (isEnglishSubject(lesson.subjectName) && parsed.langFragments.length === 0) {
    warnings.push({
      rule: 'english-lesson-needs-lang',
      severity: 'warning',
      message: 'English lesson has no :lang{en} fragments',
      fix: 'Add :lang[English text]{en} around English phrases.',
    });
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
  };
}

function validateAssetRef(
  assetRef: AssetRef,
  assets: Map<string, LessonAssetInfo>,
  institutionId: string,
  legacyException: boolean,
  errors: ContentIssue[],
  warnings: ContentIssue[]
): void {
  const asset = assets.get(assetRef.id);

  // Asset not found (:118)
  if (!asset) {
    errors.push({
      rule: 'asset-not-found',
      severity: 'error',
      message: `Asset not found: ${assetRef.id}`,
      line: assetRef.position?.start.line,
      column: assetRef.position?.start.column,
      fix: 'Use a valid asset ID from the media library.',
    });
    return;
  }

  // Asset from another institution (:118)
  // errors.md:13 — same message for "not found" and "other institution"
  if (asset.institutionId !== institutionId) {
    errors.push({
      rule: 'asset-other-institution',
      severity: 'error',
      message: `Asset not found: ${assetRef.id}`,
      line: assetRef.position?.start.line,
      column: assetRef.position?.start.column,
      fix: 'Use an asset from your institution.',
    });
    return;
  }

  // Asset not ready (:118)
  if (asset.status !== 'READY') {
    errors.push({
      rule: 'asset-not-ready',
      severity: 'error',
      message: `Asset is not ready: ${assetRef.id} (status: ${asset.status})`,
      line: assetRef.position?.start.line,
      column: assetRef.position?.start.column,
      fix: 'Wait for the asset to finish processing or upload it again.',
    });
    return;
  }

  // Video/audio needs captions or transcript (:116)
  // With legacyException (only the importer, :96-97) the asset-alternative rules become
  // warnings whatever the asset's `legacy` flag: decision 6 publishes migrated videos with
  // captionsSource AUTO under the exception.
  if (assetRef.kind === 'video' || assetRef.kind === 'audio') {
    const needsCaptions = asset.captionsSource !== 'REVIEWED' && !asset.transcriptPath;
    if (needsCaptions) {
      const issue: ContentIssue = {
        rule: assetRef.kind === 'video' ? 'video-needs-captions' : 'audio-needs-captions',
        severity: legacyException ? 'warning' : 'error',
        message: `${assetRef.kind === 'video' ? 'Video' : 'Audio'} needs reviewed captions or transcript`,
        line: assetRef.position?.start.line,
        column: assetRef.position?.start.column,
        fix: 'Add reviewed captions (captionsSource: REVIEWED) or a transcript.',
      };
      if (issue.severity === 'error') {
        errors.push(issue);
      } else {
        warnings.push(issue);
      }
    }
  }

  // PDF needs text alternative (:117)
  if (assetRef.kind === 'pdf') {
    if (!asset.textAlternativePath) {
      const issue: ContentIssue = {
        rule: 'pdf-needs-text-alternative',
        severity: legacyException ? 'warning' : 'error',
        message: 'PDF needs a text alternative',
        line: assetRef.position?.start.line,
        column: assetRef.position?.start.column,
        fix: 'Add a Markdown text alternative for the PDF content.',
      };
      if (issue.severity === 'error') {
        errors.push(issue);
      } else {
        warnings.push(issue);
      }
    }
  }
}

function validateImageAlt(
  assetRef: AssetRef,
  parsed: ParsedLesson,
  legacyException: boolean,
  errors: ContentIssue[],
  warnings: ContentIssue[]
): void {
  const alt = assetRef.alt || '';

  // Alt rules (:114). Under legacyException the legacy page images publish with the
  // "Página {n} de {tema}, texto en imagen pendiente de transcripción" pattern (:94), so
  // a failing alt is a warning, not a rejection.
  const problem = imageAltProblem(alt);
  if (problem) {
    const issue: ContentIssue = {
      ...problem,
      severity: legacyException ? 'warning' : 'error',
      line: assetRef.position?.start.line,
      column: assetRef.position?.start.column,
    };
    if (issue.severity === 'error') {
      errors.push(issue);
    } else {
      warnings.push(issue);
    }
    return;
  }

  // Chart/diagram with long alt needs data table (:115)
  if (alt.length > CHART_ALT_THRESHOLD) {
    const hasNearbyTable = findNearbyTable(parsed, { line: assetRef.position?.start.line });
    if (!hasNearbyTable) {
      warnings.push({
        rule: 'chart-needs-data-table',
        severity: 'warning',
        message: 'Complex image may need a data table',
        line: assetRef.position?.start.line,
        column: assetRef.position?.start.column,
        fix: 'Add a GFM table with the data shown in the chart/diagram.',
      });
    }
  }
}

function validateHeadings(parsed: ParsedLesson, errors: ContentIssue[]): void {
  // The lesson title is rendered as the h1 (:60), so the body starts at depth 1:
  // the first body heading must be h2, and h3 as the first heading is a level skip.
  let lastDepth = 1;

  for (const heading of parsed.headings) {
    // h1 in body is reserved for title (:60)
    if (heading.depth === 1) {
      errors.push({
        rule: 'heading-h1-reserved',
        severity: 'error',
        message: '# is reserved for the lesson title',
        line: heading.position?.start.line,
        column: heading.position?.start.column,
        fix: 'Use ## or deeper for section headings.',
      });
      continue;
    }

    // Skip more than one level (:120)
    if (heading.depth > lastDepth + 1) {
      errors.push({
        rule: 'heading-level-skip',
        severity: 'error',
        message: `Heading level skipped: h${lastDepth} to h${heading.depth}`,
        line: heading.position?.start.line,
        column: heading.position?.start.column,
        fix: `Use h${lastDepth + 1} instead of h${heading.depth}.`,
      });
    }

    lastDepth = heading.depth;
  }
}

function validateLinks(parsed: ParsedLesson, errors: ContentIssue[]): void {
  for (const link of parsed.links) {
    const normalizedText = normalizeText(link.text);

    // Non-descriptive link text (:121)
    if (NON_DESCRIPTIVE_LINK_TEXTS.has(normalizedText)) {
      errors.push({
        rule: 'link-text-descriptive',
        severity: 'error',
        message: `Link text is not descriptive: "${link.text}"`,
        line: link.position?.start.line,
        column: link.position?.start.column,
        fix: 'Use text that describes what the link leads to.',
      });
      continue;
    }

    // Link text is the URL itself
    if (normalizedText === normalizeText(link.url)) {
      errors.push({
        rule: 'link-text-descriptive',
        severity: 'error',
        message: 'Link text should not be the URL',
        line: link.position?.start.line,
        column: link.position?.start.column,
        fix: 'Use descriptive text instead of the URL.',
      });
    }
  }
}

function validateTables(parsed: ParsedLesson, errors: ContentIssue[]): void {
  // GFM tables always have a header row by syntax (:122)
  // The rule checks that the first row is not empty
  for (const table of parsed.tables) {
    if (table.firstRowEmpty) {
      errors.push({
        rule: 'table-needs-header',
        severity: 'error',
        message: 'Table header row is empty',
        line: table.position?.start.line,
        column: table.position?.start.column,
        fix: 'Add descriptive text to the header row.',
      });
    }
  }
}

function validateLatex(parsed: ParsedLesson, errors: ContentIssue[]): void {
  for (const math of parsed.mathExpressions) {
    const result = latexCompiles(math.value);
    if (!result.ok) {
      errors.push({
        rule: 'latex-must-compile',
        severity: 'error',
        message: `LaTeX error: ${result.error}`,
        line: math.position?.start.line,
        column: math.position?.start.column,
        fix: 'Fix the LaTeX syntax.',
      });
    }
  }
}

// ─────────────────────────── Assessment Validation ───────────────────────────

/**
 * Validate an assessment for publication.
 * SSOT: contenido-y-evaluaciones.md:128-132
 *
 * @param input - Raw content and answerKey (to be validated with Zod)
 * @returns Validation result with ok, errors, and warnings
 */
export function validateAssessmentForPublish(input: {
  content: unknown;
  answerKey: unknown;
}): ValidationResult {
  const errors: ContentIssue[] = [];
  const warnings: ContentIssue[] = [];

  // Validate content schema
  const contentResult = AssessmentContentSchema.safeParse(input.content);
  if (!contentResult.success) {
    for (const issue of contentResult.error.issues) {
      errors.push({
        rule: 'schema-content',
        severity: 'error',
        message: issue.message,
        path: issue.path.join('.'),
        fix: 'Fix the content structure.',
      });
    }
    return { ok: false, errors, warnings };
  }

  // Validate answerKey schema
  const keyResult = AnswerKeySchema.safeParse(input.answerKey);
  if (!keyResult.success) {
    for (const issue of keyResult.error.issues) {
      errors.push({
        rule: 'schema-answer-key',
        severity: 'error',
        message: issue.message,
        path: issue.path.join('.'),
        fix: 'Fix the answer key structure.',
      });
    }
    return { ok: false, errors, warnings };
  }

  const content = contentResult.data;
  const answerKey = keyResult.data;

  // Check for unique codes
  const codes = new Set<string>();
  for (const q of content.questions) {
    if (codes.has(q.code)) {
      errors.push({
        rule: 'code-unique',
        severity: 'error',
        message: `Duplicate question code: ${q.code}`,
        path: `questions`,
        fix: 'Use unique codes for each question.',
      });
    }
    codes.add(q.code);
  }

  // Check key-question correspondence
  const contentCodes = new Set(content.questions.map((q) => q.code));
  const keyCodes = new Set(Object.keys(answerKey));

  // Key missing for question
  for (const code of contentCodes) {
    if (!keyCodes.has(code)) {
      errors.push({
        rule: 'key-missing',
        severity: 'error',
        message: `Question ${code} has no answer key`,
        path: `answerKey.${code}`,
        fix: 'Add an answer key entry for this question.',
      });
    }
  }

  // Orphan key (no question)
  for (const code of keyCodes) {
    if (!contentCodes.has(code)) {
      errors.push({
        rule: 'key-orphan',
        severity: 'error',
        message: `Answer key for ${code} has no question`,
        path: `answerKey.${code}`,
        fix: 'Remove this answer key entry or add the question.',
      });
    }
  }

  // Validate each question
  for (const question of content.questions) {
    const key = answerKey[question.code];
    if (!key) continue; // Already reported as key-missing

    // Points mismatch
    if (question.points !== key.points) {
      errors.push({
        rule: 'points-mismatch',
        severity: 'error',
        message: `Points mismatch for ${question.code}: content=${question.points}, key=${key.points}`,
        path: `questions.${question.code}.points`,
        fix: 'Ensure points match between question and answer key.',
      });
    }

    // Statement validation (:128)
    validateQuestionStatement(question, errors);

    // Type-specific validation (:129-131)
    validateQuestionType(question, key, errors);
  }

  // Answer key leak check (:132)
  validateNoAnswerKeyLeak(input.content, errors);

  return {
    ok: errors.length === 0,
    errors,
    warnings,
  };
}

function validateQuestionStatement(
  question: AssessmentContent['questions'][number],
  errors: ContentIssue[]
): void {
  // Statement not empty
  if (!question.text.trim()) {
    errors.push({
      rule: 'statement-not-empty',
      severity: 'error',
      message: `Question ${question.code} has empty statement`,
      path: `questions.${question.code}.text`,
      fix: 'Add the question text.',
    });
    return;
  }

  // Parse statement as Markdown for image alt and LaTeX validation
  const parsed = parseLessonMarkdown(question.text);

  // Contract issues of the statement Markdown (raw HTML, external image, unknown directive)
  for (const issue of parsed.issues) {
    if (issue.severity === 'error') {
      errors.push({ ...issue, path: `questions.${question.code}.text` });
    }
  }

  // Check images with the same alt rules as lessons (:128 "imágenes con alt")
  for (const asset of parsed.assets) {
    if (asset.kind !== 'image') continue;
    const problem = imageAltProblem(asset.alt || '');
    if (problem) {
      errors.push({
        rule: 'statement-images-alt',
        severity: 'error',
        message: `Image in question ${question.code}: ${problem.message}`,
        path: `questions.${question.code}.text`,
        fix: problem.fix,
      });
    }
  }

  // Check LaTeX compiles
  for (const math of parsed.mathExpressions) {
    const result = latexCompiles(math.value);
    if (!result.ok) {
      errors.push({
        rule: 'statement-latex',
        severity: 'error',
        message: `LaTeX error in question ${question.code}: ${result.error}`,
        path: `questions.${question.code}.text`,
        fix: 'Fix the LaTeX syntax.',
      });
    }
  }
}

function validateQuestionType(
  question: AssessmentContent['questions'][number],
  key: AnswerKey[string],
  errors: ContentIssue[]
): void {
  const options = question.options || [];
  const correctAnswers = key.correct;

  switch (question.type) {
    case 'single_choice':
    case 'true_false': {
      // ≥ 2 options, exactly one correct (:129)
      const minOptions = question.type === 'true_false' ? 2 : 2;
      const maxOptions = question.type === 'true_false' ? 2 : Infinity;

      if (options.length < minOptions) {
        errors.push({
          rule: 'options-minimum',
          severity: 'error',
          message: `Question ${question.code} needs at least ${minOptions} options`,
          path: `questions.${question.code}.options`,
          fix: 'Add more options.',
        });
      }

      if (question.type === 'true_false' && options.length !== 2) {
        errors.push({
          rule: 'true-false-two-options',
          severity: 'error',
          message: `True/false question ${question.code} must have exactly 2 options`,
          path: `questions.${question.code}.options`,
          fix: 'Use exactly 2 options for true/false.',
        });
      }

      // Check options are not empty
      for (const opt of options) {
        if (!opt.text.trim()) {
          errors.push({
            rule: 'option-not-empty',
            severity: 'error',
            message: `Option ${opt.code} in question ${question.code} is empty`,
            path: `questions.${question.code}.options.${opt.code}`,
            fix: 'Add text to the option.',
          });
        }
      }

      // Exactly one correct
      if (correctAnswers.length !== 1) {
        errors.push({
          rule: 'single-correct',
          severity: 'error',
          message: `Question ${question.code} must have exactly one correct answer`,
          path: `answerKey.${question.code}.correct`,
          fix: 'Specify exactly one correct answer.',
        });
      }

      // Correct answer exists in options
      const optionCodes = new Set(options.map((o) => o.code));
      for (const correct of correctAnswers) {
        if (!optionCodes.has(correct)) {
          errors.push({
            rule: 'correct-exists',
            severity: 'error',
            message: `Correct answer "${correct}" not in options for ${question.code}`,
            path: `answerKey.${question.code}.correct`,
            fix: 'Use an option code that exists.',
          });
        }
      }
      break;
    }

    case 'multiple_choice': {
      // ≥ 2 options, ≥ 1 correct (:130)
      if (options.length < 2) {
        errors.push({
          rule: 'options-minimum',
          severity: 'error',
          message: `Question ${question.code} needs at least 2 options`,
          path: `questions.${question.code}.options`,
          fix: 'Add more options.',
        });
      }

      // Check options are not empty
      for (const opt of options) {
        if (!opt.text.trim()) {
          errors.push({
            rule: 'option-not-empty',
            severity: 'error',
            message: `Option ${opt.code} in question ${question.code} is empty`,
            path: `questions.${question.code}.options.${opt.code}`,
            fix: 'Add text to the option.',
          });
        }
      }

      // At least one correct
      if (correctAnswers.length < 1) {
        errors.push({
          rule: 'multiple-correct-minimum',
          severity: 'error',
          message: `Question ${question.code} must have at least one correct answer`,
          path: `answerKey.${question.code}.correct`,
          fix: 'Specify at least one correct answer.',
        });
      }

      // All correct answers exist in options
      const optionCodes = new Set(options.map((o) => o.code));
      for (const correct of correctAnswers) {
        if (!optionCodes.has(correct)) {
          errors.push({
            rule: 'correct-exists',
            severity: 'error',
            message: `Correct answer "${correct}" not in options for ${question.code}`,
            path: `answerKey.${question.code}.correct`,
            fix: 'Use an option code that exists.',
          });
        }
      }
      break;
    }

    case 'short_text': {
      // ≥ 1 accepted answer, not empty (:131)
      // // AMBIGUO(:131): sin flags por pregunta en el schema
      if (correctAnswers.length < 1) {
        errors.push({
          rule: 'short-text-answers',
          severity: 'error',
          message: `Question ${question.code} must have at least one accepted answer`,
          path: `answerKey.${question.code}.correct`,
          fix: 'Add accepted answers.',
        });
      }

      for (const answer of correctAnswers) {
        if (!answer.trim()) {
          errors.push({
            rule: 'short-text-answer-not-empty',
            severity: 'error',
            message: `Empty accepted answer for question ${question.code}`,
            path: `answerKey.${question.code}.correct`,
            fix: 'Remove empty answers.',
          });
        }
      }
      break;
    }
  }
}

function validateNoAnswerKeyLeak(content: unknown, errors: ContentIssue[]): void {
  // Recursively check for forbidden keys in content (:132)
  const forbiddenKeys = new Set(['correct', 'answer', 'answerKey', 'points']);
  const validPointsLocations = new Set(['questions']); // points in questions is allowed

  function check(obj: unknown, path: string[], depth: number = 0): void {
    if (depth > 10) return; // Prevent infinite recursion

    if (obj && typeof obj === 'object') {
      if (Array.isArray(obj)) {
        obj.forEach((item, i) => check(item, [...path, `[${i}]`], depth + 1));
      } else {
        for (const [key, value] of Object.entries(obj)) {
          const currentPath = [...path, key];

          // Check if this key is forbidden at this location
          if (forbiddenKeys.has(key)) {
            // points in questions is allowed
            const isValidPoints = key === 'points' && path.includes('questions');
            if (!isValidPoints) {
              errors.push({
                rule: 'answer-key-leak',
                severity: 'error',
                message: `Content contains forbidden key: ${key}`,
                path: currentPath.join('.'),
                fix: 'Remove answer key information from content.',
              });
            }
          }

          check(value, currentPath, depth + 1);
        }
      }
    }
  }

  check(content, []);
}
