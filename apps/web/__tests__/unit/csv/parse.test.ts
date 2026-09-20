/** @jest-environment node */
/**
 * Tests for the CSV reader.
 * SSOT: plan/06-cohortes-y-personas.md:45, docs/estado.md §14a
 *
 * Every case here is something Excel or Sheets actually produces.
 */

import { parseCsv, sniffDelimiter } from '@/lib/csv/parse';

describe('sniffDelimiter', () => {
  it('picks the semicolon Excel writes under a Spanish locale', () => {
    expect(sniffDelimiter('a;b;c')).toBe(';');
  });

  it('defaults to the comma', () => {
    expect(sniffDelimiter('a,b,c')).toBe(',');
    expect(sniffDelimiter('sin separador')).toBe(',');
  });

  it('ignores delimiters inside quotes when deciding', () => {
    expect(sniffDelimiter('"a;b;c;d",e')).toBe(',');
  });
});

describe('parseCsv', () => {
  it('reads a plain file', () => {
    expect(parseCsv('a,b\nc,d')).toEqual({
      headers: ['a', 'b'],
      rows: [{ line: 2, cells: ['c', 'd'] }],
      delimiter: ',',
    });
  });

  it('keeps a delimiter that is inside quotes', () => {
    expect(parseCsv('a,b\n"x,y",z').rows).toEqual([{ line: 2, cells: ['x,y', 'z'] }]);
  });

  it('unescapes doubled quotes', () => {
    const doubled = 'a,b\n"dijo ""hola""",z';
    expect(parseCsv(doubled).rows).toEqual([{ line: 2, cells: ['dijo "hola"', 'z'] }]);
  });

  it('keeps a newline inside quotes, and still numbers the row where it starts', () => {
    expect(parseCsv('a,b\n"linea1\nlinea2",z\nx,y').rows).toEqual([
      { line: 2, cells: ['linea1\nlinea2', 'z'] },
      { line: 4, cells: ['x', 'y'] },
    ]);
  });

  it('handles CRLF and a trailing newline without inventing an empty row', () => {
    expect(parseCsv('a,b\r\nc,d\r\n').rows).toEqual([{ line: 2, cells: ['c', 'd'] }]);
  });

  it('strips the BOM so the first header is not mangled', () => {
    expect(parseCsv('﻿documentType,b\nc,d').headers).toEqual(['documentType', 'b']);
  });

  it('reads a semicolon-separated file', () => {
    const result = parseCsv('﻿a;b\nc;d');
    expect(result.delimiter).toBe(';');
    expect(result.rows).toEqual([{ line: 2, cells: ['c', 'd'] }]);
  });

  it('keeps empty cells and short rows as they are, for the validator to report', () => {
    expect(parseCsv('a,b,c\n1,,3').rows).toEqual([{ line: 2, cells: ['1', '', '3'] }]);
    expect(parseCsv('a,b,c\n1,2').rows).toEqual([{ line: 2, cells: ['1', '2'] }]);
  });

  it('returns no rows for an empty file', () => {
    expect(parseCsv('')).toEqual({ headers: [], rows: [], delimiter: ',' });
  });
});
