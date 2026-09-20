/**
 * CSV writer.
 * SSOT: plan/06-cohortes-y-personas.md:80 ("exportar CSV en cada tabla").
 *
 * Lives next to the reader so the two stay a pair.
 */

/**
 * CSV for a spreadsheet, with the two things that usually go wrong:
 * quoting, and the leading `=`/`+`/`-`/`@` that Excel and Sheets execute as a formula.
 */
export function toCsv(headers: string[], rows: string[][]): string {
  const cell = (value: string): string => {
    const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
    return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
  };

  return [headers, ...rows].map((row) => row.map(cell).join(',')).join('\r\n');
}

/** Excel reads a CSV as the system codepage unless the file starts with a UTF-8 BOM. */
export const CSV_BOM = '﻿';
