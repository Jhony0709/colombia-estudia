/**
 * Content parsing and assessment schema.
 * SSOT: reference/04-business-logic/contenido-y-evaluaciones.md
 *
 * Markdown parser: CommonMark + GFM + math + directives (video/audio/pdf/lang).
 * Rejects raw HTML and unknown directives.
 * Returns typed AST + list of asset refs + issues.
 *
 * Assessment content schema without answers.
 * Answer key schema separate.
 */

import { z } from 'zod';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import remarkDirective from 'remark-directive';
import { visit } from 'unist-util-visit';
import type { Root, Image, Link, Html, Heading, Table, InlineCode, Code } from 'mdast';
import type { Node, Parent, Position } from 'unist';
import katex from 'katex';

// ─────────────────────────── Types ───────────────────────────

export type MediaKind = 'VIDEO' | 'AUDIO' | 'IMAGE' | 'DOCUMENT';
export type MediaStatus = 'PENDING' | 'READY' | 'ERROR';
export type CaptionsSource = 'NONE' | 'AUTO' | 'REVIEWED';

/**
 * What the validator needs to know about a MediaAsset.
 * schema:635-665
 */
export interface LessonAssetInfo {
  id: string;
  institutionId: string;
  kind: MediaKind;
  status: MediaStatus;
  captionsSource: CaptionsSource;
  transcriptPath: string | null;
  textAlternativePath: string | null;
  altText: string | null;
  legacy: boolean;
}

export type AssetRefKind = 'image' | 'video' | 'audio' | 'pdf';

/**
 * Reference to an asset found in Markdown.
 */
export interface AssetRef {
  id: string;
  kind: AssetRefKind;
  alt?: string;
  position?: Position;
}

export type IssueSeverity = 'error' | 'warning';

/**
 * Content validation issue.
 * contenido-y-evaluaciones.md:134-135: what's missing, where, how to fix.
 */
export interface ContentIssue {
  rule: string;
  severity: IssueSeverity;
  message: string;
  line?: number;
  column?: number;
  /** For assessment validation: JSON path to the problem */
  path?: string;
  fix: string;
}

/**
 * Result of parsing lesson Markdown.
 */
export interface ParsedLesson {
  ast: Root;
  assets: AssetRef[];
  issues: ContentIssue[];
  /** Headings found for structure validation */
  headings: Array<{ depth: number; text: string; position?: Position }>;
  /** Math expressions found */
  mathExpressions: Array<{ value: string; displayMode: boolean; position?: Position }>;
  /** :lang directives found */
  langFragments: Array<{ lang: string; text: string; position?: Position }>;
  /** Links found */
  links: Array<{ url: string; text: string; position?: Position }>;
  /** Tables found */
  tables: Array<{ position?: Position; hasHeader: boolean; firstRowEmpty: boolean }>;
}

// ─────────────────────────── Assessment Schemas ───────────────────────────

/**
 * Question content schema (student-facing, no answers).
 * code must be unique per assessment.
 */
export const QuestionContentSchema = z.object({
  code: z.string().min(1, 'Question code is required'),
  type: z.enum(['single_choice', 'multiple_choice', 'true_false', 'short_text']),
  text: z.string().min(1, 'Question text is required'),
  options: z
    .array(
      z.object({
        code: z.string().min(1, 'Option code is required'),
        text: z.string().min(1, 'Option text is required'),
      })
    )
    .optional(),
  points: z.number().positive('Points must be positive'),
});

export type QuestionContent = z.infer<typeof QuestionContentSchema>;

/**
 * Assessment content (student-facing, no answers).
 */
export const AssessmentContentSchema = z.object({
  instructions: z.string().optional(),
  questions: z.array(QuestionContentSchema),
});

export type AssessmentContent = z.infer<typeof AssessmentContentSchema>;

/**
 * Answer key entry.
 * `correct` is normalized to always be an array.
 */
const AnswerKeyEntrySchema = z.object({
  correct: z
    .union([z.string(), z.array(z.string())])
    .transform((val) => (Array.isArray(val) ? val : [val])),
  points: z.number().positive('Points must be positive'),
  feedback: z.string().optional(),
});

/**
 * Answer key (server-only).
 * Record<question code, { correct: string[], points, feedback? }>
 */
export const AnswerKeySchema = z.record(z.string(), AnswerKeyEntrySchema);

export type AnswerKey = z.infer<typeof AnswerKeySchema>;

// ─────────────────────────── Constants ───────────────────────────

/** Valid cuid pattern */
const CUID_PATTERN = /^c[a-z0-9]{24}$/;

/** BCP-47 simple pattern */
const BCP47_PATTERN = /^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$/;

/** Known asset directives */
const ASSET_DIRECTIVES = new Set(['video', 'audio', 'pdf']);

/** The only text directive we support */
const TEXT_DIRECTIVES = new Set(['lang']);

// ─────────────────────────── Helpers ───────────────────────────

function isValidCuid(id: string): boolean {
  return CUID_PATTERN.test(id);
}

function isValidBcp47(lang: string): boolean {
  return BCP47_PATTERN.test(lang);
}

function extractAssetId(url: string): string | null {
  const match = url.match(/^asset:(.+)$/);
  return match ? (match[1] ?? null) : null;
}

function getNodeText(node: Node): string {
  if ('value' in node && typeof node.value === 'string') {
    return node.value;
  }
  if ('children' in node && Array.isArray((node as Parent).children)) {
    return (node as Parent).children.map(getNodeText).join('');
  }
  return '';
}

// ─────────────────────────── Directive Types ───────────────────────────

interface DirectiveNode extends Node {
  type: 'leafDirective' | 'textDirective' | 'containerDirective';
  name: string;
  attributes?: Record<string, string>;
  children?: Node[];
}

interface MathNode extends Node {
  type: 'math' | 'inlineMath';
  value: string;
}

// ─────────────────────────── Parser ───────────────────────────

/**
 * Parse lesson Markdown content.
 * SSOT: contenido-y-evaluaciones.md:46-73
 *
 * Returns AST, extracted assets, and syntactic issues.
 * Business rule validation is in publish-validation.ts.
 */
export function parseLessonMarkdown(markdown: string): ParsedLesson {
  const assets: AssetRef[] = [];
  const issues: ContentIssue[] = [];
  const headings: ParsedLesson['headings'] = [];
  const mathExpressions: ParsedLesson['mathExpressions'] = [];
  const langFragments: ParsedLesson['langFragments'] = [];
  const links: ParsedLesson['links'] = [];
  const tables: ParsedLesson['tables'] = [];

  // Parse with unified + remark plugins
  const processor = unified().use(remarkParse).use(remarkGfm).use(remarkMath).use(remarkDirective);

  const ast = processor.parse(markdown) as Root;

  // Visit nodes and extract/validate
  visit(ast, (node: Node) => {
    const pos = node.position;

    // HTML nodes → error
    if (node.type === 'html') {
      const htmlNode = node as Html;
      issues.push({
        rule: 'raw-html',
        severity: 'error',
        message: `Raw HTML is not allowed: "${htmlNode.value.slice(0, 50)}${htmlNode.value.length > 50 ? '...' : ''}"`,
        line: pos?.start.line,
        column: pos?.start.column,
        fix: 'Remove the HTML and use Markdown syntax instead.',
      });
    }

    // Images → extract asset ref
    if (node.type === 'image') {
      const imgNode = node as Image;
      const assetId = extractAssetId(imgNode.url);
      if (assetId === null) {
        // The contract only allows `![alt](asset:<id>)` (contenido-y-evaluaciones.md:54):
        // an external URL bypasses the asset checks and the alt rules, so it is a contract error.
        issues.push({
          rule: 'image-not-asset',
          severity: 'error',
          message: `Image must reference an asset (asset:<id>), got: "${imgNode.url.slice(0, 80)}"`,
          line: pos?.start.line,
          column: pos?.start.column,
          fix: 'Upload the image to the media library and reference it as ![alt](asset:<id>).',
        });
      } else {
        if (!isValidCuid(assetId)) {
          issues.push({
            rule: 'invalid-asset-id',
            severity: 'error',
            message: `Invalid asset ID format: "${assetId}"`,
            line: pos?.start.line,
            column: pos?.start.column,
            fix: 'Use a valid asset ID from the media library.',
          });
        } else {
          assets.push({
            id: assetId,
            kind: 'image',
            alt: imgNode.alt || undefined,
            position: pos,
          });
        }
      }
    }

    // Links → extract for validation
    if (node.type === 'link') {
      const linkNode = node as Link;
      links.push({
        url: linkNode.url,
        text: getNodeText(linkNode),
        position: pos,
      });
    }

    // Headings → extract for structure validation
    if (node.type === 'heading') {
      const headingNode = node as Heading;
      headings.push({
        depth: headingNode.depth,
        text: getNodeText(headingNode),
        position: pos,
      });
    }

    // Tables → extract for header validation
    if (node.type === 'table') {
      const tableNode = node as Table;
      const firstRow = tableNode.children[0];
      const firstRowEmpty = firstRow
        ? firstRow.children.every((cell) => getNodeText(cell).trim() === '')
        : true;
      tables.push({
        position: pos,
        hasHeader: true, // GFM tables always have a header row by syntax
        firstRowEmpty,
      });
    }

    // Math nodes → extract for LaTeX validation
    if (node.type === 'math' || node.type === 'inlineMath') {
      const mathNode = node as MathNode;
      mathExpressions.push({
        value: mathNode.value,
        displayMode: node.type === 'math',
        position: pos,
      });
    }

    // Directives
    if (
      node.type === 'leafDirective' ||
      node.type === 'textDirective' ||
      node.type === 'containerDirective'
    ) {
      const directive = node as DirectiveNode;
      const name = directive.name;

      // Asset directives (::video, ::audio, ::pdf)
      if (ASSET_DIRECTIVES.has(name)) {
        const assetAttr = directive.attributes?.asset;
        if (!assetAttr) {
          issues.push({
            rule: 'directive-missing-asset',
            severity: 'error',
            message: `Directive ::${name} requires an asset attribute`,
            line: pos?.start.line,
            column: pos?.start.column,
            fix: `Add asset="<id>" to the directive: ::${name}{asset="<id>"}`,
          });
        } else if (!isValidCuid(assetAttr)) {
          issues.push({
            rule: 'invalid-asset-id',
            severity: 'error',
            message: `Invalid asset ID format in ::${name}: "${assetAttr}"`,
            line: pos?.start.line,
            column: pos?.start.column,
            fix: 'Use a valid asset ID from the media library.',
          });
        } else {
          const kind = name === 'video' ? 'video' : name === 'audio' ? 'audio' : 'pdf';
          assets.push({
            id: assetAttr,
            kind,
            position: pos,
          });
        }
      }
      // Text directive :lang
      else if (TEXT_DIRECTIVES.has(name)) {
        if (name === 'lang') {
          // Language can be in attributes: :lang[text]{en} or :lang[text]{lang=en}
          const attrs = directive.attributes || {};
          // First check for bare attribute (en in {en})
          let lang = Object.keys(attrs).find(
            (k) => attrs[k] === '' || attrs[k] === null || attrs[k] === undefined
          );
          // Or explicit lang= attribute
          if (!lang && attrs.lang) {
            lang = attrs.lang;
          }

          if (!lang) {
            issues.push({
              rule: 'lang-missing-code',
              severity: 'error',
              message: 'Language directive :lang requires a language code',
              line: pos?.start.line,
              column: pos?.start.column,
              fix: 'Add a language code: :lang[text]{en} or :lang[text]{lang=en}',
            });
          } else if (!isValidBcp47(lang)) {
            issues.push({
              rule: 'lang-invalid-code',
              severity: 'error',
              message: `Invalid BCP-47 language code: "${lang}"`,
              line: pos?.start.line,
              column: pos?.start.column,
              fix: 'Use a valid BCP-47 language code like "en", "es", "fr-CA".',
            });
          } else {
            langFragments.push({
              lang,
              text: getNodeText(directive),
              position: pos,
            });
          }
        }
      }
      // Unknown directive
      else {
        issues.push({
          rule: 'unknown-directive',
          severity: 'error',
          message: `Unknown directive: ::${name}`,
          line: pos?.start.line,
          column: pos?.start.column,
          fix: `Use a supported directive: ::video, ::audio, ::pdf, or :lang`,
        });
      }
    }
  });

  return {
    ast,
    assets,
    issues,
    headings,
    mathExpressions,
    langFragments,
    links,
    tables,
  };
}

// ─────────────────────────── LaTeX Validation ───────────────────────────

/**
 * Check if LaTeX compiles.
 * contenido-y-evaluaciones.md:58, :119
 */
export function latexCompiles(src: string): { ok: true } | { ok: false; error: string } {
  try {
    katex.renderToString(src, {
      throwOnError: true,
      output: 'mathml',
    });
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message };
  }
}
