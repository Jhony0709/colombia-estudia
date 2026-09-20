/**
 * Los avisos de validación, en español.
 * SSOT: packages/domain/src/publish-validation.ts, packages/types/src/content.ts.
 *
 * El dominio habla inglés y no va a dejar de hacerlo: es una librería pura, sin `next-intl`
 * ni idioma, y sus mensajes llevan datos interpolados (el código de una pregunta, el id de un
 * recurso) que no se pueden traducir sin romperlos.
 *
 * Así que la traducción vive aquí, en la capa que ya sabe de idioma, y la llave es el
 * `rule`: un código estable que el dominio ya emite. Lo que ve el usuario es el texto en
 * español; el mensaje original queda debajo como detalle, porque a veces es lo único que
 * dice **cuál** de las cinco preguntas falla.
 *
 * Una regla sin traducción cae al mensaje del dominio en vez de romper la pantalla: es
 * preferible un aviso en inglés a una pantalla en blanco, y la ausencia se nota y se añade.
 */

export interface RawIssue {
  rule?: string;
  message: string;
  fix?: string;
}

export interface IssueText {
  /** Qué pasa, en palabras del oficio. */
  message: string;
  /** Qué hacer. */
  fix: string | null;
  /** El mensaje del dominio, cuando aporta algo que el texto en español no dice. */
  detail: string | null;
}

/** El `t` de `useTranslations('issues')` / `getTranslations('issues')`. */
type Translator = ((key: string) => string) & { has: (key: string) => boolean };

export function issueText(issue: RawIssue, t: Translator): IssueText {
  const rule = issue.rule;

  if (!rule || !t.has(`${rule}.message`)) {
    return { message: issue.message, fix: issue.fix ?? null, detail: null };
  }

  const message = t(`${rule}.message`);
  const fix = t.has(`${rule}.fix`) ? t(`${rule}.fix`) : (issue.fix ?? null);

  // El detalle solo si dice algo más. Repetir la misma frase dos veces es ruido, y el
  // mensaje del dominio sin datos interpolados no añade nada.
  const detail = issue.message && issue.message !== message ? issue.message : null;

  return { message, fix, detail };
}
