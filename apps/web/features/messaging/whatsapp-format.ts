/**
 * El formato de texto de WhatsApp (22/11): `*negrita*`, `_cursiva_`, `~tachado~`,
 * ` ```mono``` `, `` `código` ``, y las líneas `- `, `1. ` y `> `. Se parsea a nodos y la
 * bandeja los pinta como React: nunca HTML crudo.
 */

export type Inline =
  | { kind: 'text'; text: string }
  | { kind: 'bold' | 'italic' | 'strike'; children: Inline[] }
  | { kind: 'mono' | 'code'; text: string };

export type Line =
  | { kind: 'para'; inline: Inline[] }
  | { kind: 'bullet'; inline: Inline[] }
  | { kind: 'number'; n: string; inline: Inline[] }
  | { kind: 'quote'; inline: Inline[] };

const WRAPS: Record<string, 'bold' | 'italic' | 'strike'> = {
  '*': 'bold',
  _: 'italic',
  '~': 'strike',
};

const isWord = (ch: string | undefined) => ch !== undefined && /[\p{L}\p{N}]/u.test(ch);

/** Como WhatsApp: el marcador abre pegado a texto y fuera de una palabra, y cierra igual. */
export function parseInline(text: string): Inline[] {
  const out: Inline[] = [];
  let buf = '';
  const flush = () => {
    if (buf) out.push({ kind: 'text', text: buf });
    buf = '';
  };

  let i = 0;
  while (i < text.length) {
    if (text.startsWith('```', i)) {
      const end = text.indexOf('```', i + 3);
      if (end > i + 3) {
        flush();
        out.push({ kind: 'mono', text: text.slice(i + 3, end) });
        i = end + 3;
        continue;
      }
    }
    const ch = text[i]!;
    if (ch === '`') {
      const end = text.indexOf('`', i + 1);
      if (end > i + 1 && !text.slice(i + 1, end).includes('\n')) {
        flush();
        out.push({ kind: 'code', text: text.slice(i + 1, end) });
        i = end + 1;
        continue;
      }
    }
    const kind = WRAPS[ch];
    if (kind && !isWord(text[i - 1]) && text[i + 1] !== undefined && !/\s/.test(text[i + 1]!)) {
      let end = text.indexOf(ch, i + 1);
      while (end !== -1 && (/\s/.test(text[end - 1]!) || isWord(text[end + 1]))) {
        end = text.indexOf(ch, end + 1);
      }
      if (end > i + 1 && !text.slice(i + 1, end).includes('\n')) {
        flush();
        out.push({ kind, children: parseInline(text.slice(i + 1, end)) });
        i = end + 1;
        continue;
      }
    }
    buf += ch;
    i += 1;
  }
  flush();
  return out;
}

/** Línea a línea; los bloques ` ``` ` de varias líneas quedan en un solo párrafo mono. */
export function parseWhatsApp(text: string): Line[] {
  const lines: Line[] = [];
  const raw = text.split('\n');
  for (let i = 0; i < raw.length; i++) {
    const line = raw[i]!;
    if (line.startsWith('```') && !line.slice(3).includes('```')) {
      const close = raw.findIndex((l, j) => j > i && l.includes('```'));
      if (close !== -1) {
        const block = raw.slice(i, close + 1).join('\n');
        lines.push({ kind: 'para', inline: parseInline(block) });
        i = close;
        continue;
      }
    }
    const bullet = /^[-*•] (.*)$/.exec(line);
    const number = /^(\d{1,3})\. (.*)$/.exec(line);
    const quote = /^> ?(.*)$/.exec(line);
    if (bullet) lines.push({ kind: 'bullet', inline: parseInline(bullet[1]!) });
    else if (number) lines.push({ kind: 'number', n: number[1]!, inline: parseInline(number[2]!) });
    else if (quote) lines.push({ kind: 'quote', inline: parseInline(quote[1]!) });
    else lines.push({ kind: 'para', inline: parseInline(line) });
  }
  return lines;
}
