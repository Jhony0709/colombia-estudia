/**
 * Qué forma tiene un tema, que es lo que decide cómo se completa.
 * SSOT: reference/04-business-logic/contenido-y-evaluaciones.md:155-160,
 * packages/domain/src/lesson-completion.ts.
 *
 * Puro y sin base de datos: entra el Markdown ya parseado, sale la forma.
 *
 * Esto es lógica de dominio y su sitio natural es `packages/domain`, al lado de
 * `lesson-completion.ts`, que es quien la consume. Está aquí porque tocar
 * `packages/domain/src/*` necesita aprobación previa (CLAUDE.md) y esto no la tiene todavía.
 * Anotado en `docs/estado.md` para moverlo cuando la dé.
 */

import type { LessonForm } from '@colombia-estudia/domain';
import type { ParsedLesson } from '@colombia-estudia/types';

/**
 * El orden importa y es una decisión, no un descuido:
 *
 * 1. Un tema con entrega es `SUBMISSION` **aunque tenga video**. Lo que lo completa es que
 *    un instructor apruebe la entrega, y ninguna evidencia de lectura puede adelantarlo.
 * 2. Si no, un tema que embebe video es `VIDEO`: la evidencia es la posición del video o la
 *    transcripción leída.
 * 3. Todo lo demás es `MARKDOWN`: scroll al final y tiempo mínimo.
 *
 * // AMBIGUO(contenido-y-evaluaciones.md:155): la tabla nombra **una** forma por tema, pero
 * un tema puede ser media página de texto y un video de veinte minutos. Aquí gana el video,
 * porque exigir además el scroll dejaría sin completar a quien vio el video entero. Si se
 * quiere lo contrario —texto con un video de apoyo que no completa nada— hay que decirlo en
 * el contrato, no adivinarlo aquí.
 *
 * // AMBIGUO(:155): un tema solo de audio cae en `MARKDOWN`. La tabla no tiene fila de audio,
 * y `MARKDOWN` (scroll + tiempo) es lo más cercano a "estuvo aquí el rato que dura".
 */
export function lessonFormOf({
  parsed,
  requiresSubmission,
}: {
  parsed: Pick<ParsedLesson, 'assets'>;
  requiresSubmission: boolean;
}): LessonForm {
  if (requiresSubmission) return 'SUBMISSION';
  if (parsed.assets.some((asset) => asset.kind === 'video')) return 'VIDEO';
  return 'MARKDOWN';
}
