/**
 * CSV reader for the files operations fill in with a spreadsheet.
 * SSOT: plan/06-cohortes-y-personas.md:38-49 (carga CSV en tres pasos).
 *
 * The plan names `papaparse`. This is a hand-written RFC 4180 reader instead, and the reason
 * is narrow: the only CSV this project reads is its own template, filled in and saved back by
 * Excel or Sheets. What that actually requires is quoting, CRLF, a BOM and the semicolon
 * delimiter Excel writes under a Spanish locale — all of it below, all of it tested. Swapping
 * in papaparse later is a change in this file alone.
 */

export interface ParsedCsv {
  /** Header names, trimmed, in file order. */
  headers: string[];
  /** One entry per data row: the raw cells, and the 1-based line number in the file. */
  rows: Array<{ line: number; cells: string[] }>;
  delimiter: string;
}

/** Excel writes `;` when the system decimal separator is a comma, which it is in Colombia. */
export function sniffDelimiter(firstLine: string): string {
  let commas = 0;
  let semicolons = 0;
  let inQuotes = false;

  for (let i = 0; i < firstLine.length; i += 1) {
    const char = firstLine[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (!inQuotes && char === ',') {
      commas += 1;
    } else if (!inQuotes && char === ';') {
      semicolons += 1;
    }
  }

  return semicolons > commas ? ';' : ',';
}

/**
 * Parses the whole text. Not streaming: the template is a cohort's worth of people, in the
 * low hundreds. If that ever stops being true, this is the function to replace.
 */
export function parseCsv(text: string): ParsedCsv {
  // A BOM would otherwise end up glued to the first header name.
  const input = text.replace(/^﻿/, '');
  const firstBreak = input.search(/\r\n|\n|\r/);
  const delimiter = sniffDelimiter(firstBreak === -1 ? input : input.slice(0, firstBreak));

  const records: Array<{ line: number; cells: string[] }> = [];
  let cells: string[] = [];
  let value = '';
  let inQuotes = false;
  let line = 1;
  // Where the record *starts*. A quoted field can span lines, and an error message has to
  // point at the row operations sees in their spreadsheet, not at where it happened to end.
  let recordStart = 1;
  let started = false;

  const endCell = () => {
    cells.push(value);
    value = '';
  };

  const endRecord = () => {
    endCell();
    // A trailing newline must not become a row of one empty cell.
    if (!(cells.length === 1 && cells[0] === '')) {
      records.push({ line: recordStart, cells });
    }
    cells = [];
    started = false;
  };

  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];
    if (!started) recordStart = line;
    started = true;

    if (inQuotes) {
      if (char === '"') {
        if (input[i + 1] === '"') {
          value += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        value += char;
        if (char === '\n') line += 1;
      }
      continue;
    }

    if (char === '"' && value === '') {
      inQuotes = true;
    } else if (char === delimiter) {
      endCell();
    } else if (char === '\r' || char === '\n') {
      if (char === '\r' && input[i + 1] === '\n') i += 1;
      endRecord();
      line += 1;
    } else {
      value += char;
    }
  }

  if (started || value !== '' || cells.length > 0) {
    endRecord();
  }

  const [header, ...rest] = records;

  return {
    headers: (header?.cells ?? []).map((h) => h.trim()),
    rows: rest,
    delimiter,
  };
}
