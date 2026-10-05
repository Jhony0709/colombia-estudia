/**
 * Pistas del editor de temas que no bloquean nada (4/10): los minutos que sugiere la extensión
 * del texto y los títulos escritos en mayúsculas. Se calculan en el navegador sobre el Markdown.
 */

/** Palabras por minuto de estudio: más despacio que leer por gusto. */
export const STUDY_WORDS_PER_MINUTE = 150;

/** Las palabras que se leen: sin directivas, sin imágenes, sin URLs, sin fórmulas ni marcas. */
export function countWords(markdown: string): number {
  const plain = markdown
    .replace(/^\s*:{2,3}.*$/gm, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\$\$[\s\S]*?\$\$|\$[^$\n]*\$/g, ' ')
    .replace(/[#>*_`~|]+/g, ' ');
  return plain.split(/\s+/).filter((word) => /[\p{L}\p{N}]/u.test(word)).length;
}

/** Minutos sugeridos para un texto de `words` palabras; nulo si no hay texto. */
export function suggestedMinutes(words: number): number | null {
  return words === 0 ? null : Math.max(1, Math.round(words / STUDY_WORDS_PER_MINUTE));
}

/** Los títulos (`#…` o una línea entera en negrita) escritos en mayúsculas, de dos palabras o más. */
export function shoutingHeadings(markdown: string): string[] {
  const found: string[] = [];
  for (const line of markdown.split('\n')) {
    const match =
      line.match(/^\s{0,3}#{1,6}\s+(.+?)\s*#*\s*$/) ?? line.match(/^\s*\*\*(.+)\*\*\s*$/);
    const heading = match?.[1]?.trim();
    if (!heading || heading.split(/\s+/).length < 2) continue;
    const letters = heading.replace(/[^\p{L}]/gu, '');
    if (
      letters.length >= 4 &&
      letters === letters.toLocaleUpperCase('es') &&
      letters !== letters.toLocaleLowerCase('es')
    ) {
      found.push(heading);
    }
  }
  return found;
}
