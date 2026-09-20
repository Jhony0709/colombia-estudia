/** @jest-environment node */
/**
 * Tests for the CSV import's row validation.
 * SSOT: plan/06-cohortes-y-personas.md:45-49, docs/estado.md §14a
 */

import {
  checkHeaders,
  toValues,
  parseBirthDate,
  validateRow,
  flagDuplicatesWithinFile,
  type ImportRow,
} from '@/features/cohorts/server/import/validate';
import {
  IMPORT_COLUMNS,
  EXAMPLE_ROW,
  type ImportColumn,
} from '@/features/cohorts/server/import/columns';

const NOW = new Date('2026-09-17T12:00:00.000Z');

const base = (
  overrides: Partial<Record<ImportColumn, string>> = {}
): Record<ImportColumn, string> => ({
  ...(Object.fromEntries(IMPORT_COLUMNS.map((c) => [c, ''])) as Record<ImportColumn, string>),
  documentType: 'CC',
  documentNumber: '52123456',
  givenName: 'Marta',
  familyName: 'Peña',
  birthDate: '1990-03-14',
  ...overrides,
});

const columnsWithIssues = (row: ImportRow) => row.issues.map((i) => i.column).sort();

describe('checkHeaders', () => {
  it('accepts the template as it ships', () => {
    expect(checkHeaders([...IMPORT_COLUMNS])).toEqual({ ok: true, missing: [], unknown: [] });
  });

  it('names what is missing and what it does not understand', () => {
    const result = checkHeaders(['documentType', 'apellidos']);
    expect(result.ok).toBe(false);
    expect(result.missing).toContain('givenName');
    expect(result.unknown).toEqual(['apellidos']);
  });
});

describe('toValues', () => {
  it('maps by header name, so a reordered file still works', () => {
    const values = toValues(['familyName', 'givenName'], ['Peña', 'Marta']);
    expect(values.givenName).toBe('Marta');
    expect(values.familyName).toBe('Peña');
  });

  it('trims cells and leaves absent columns empty', () => {
    expect(toValues(['givenName'], ['  Marta  ']).givenName).toBe('Marta');
    expect(toValues(['givenName'], ['Marta']).email).toBe('');
  });
});

describe('parseBirthDate', () => {
  it('rejects a date that does not exist instead of rolling it over', () => {
    // new Date('2026-02-31') silently becomes 3 March.
    expect(parseBirthDate('2026-02-31')).toBeNull();
  });

  it('rejects anything that is not AAAA-MM-DD', () => {
    expect(parseBirthDate('14/03/2010')).toBeNull();
    expect(parseBirthDate('2010-3-14')).toBeNull();
  });

  it('accepts a real date', () => {
    expect(parseBirthDate('2010-03-14')?.toISOString().slice(0, 10)).toBe('2010-03-14');
  });
});

describe('validateRow', () => {
  it('accepts a clean adult row with no payment plan', () => {
    expect(validateRow(2, base(), NOW).issues).toEqual([]);
  });

  it('accepts the example row that ships in the template', () => {
    const row = validateRow(2, EXAMPLE_ROW, NOW);
    expect(row.issues).toEqual([]);
    expect(row.isMinor).toBe(true);
    expect(row.hasPayment).toBe(true);
  });

  it('reports every missing obligatory column, one issue each', () => {
    const row = validateRow(2, base({ givenName: '', documentNumber: '', birthDate: '' }), NOW);
    expect(columnsWithIssues(row)).toEqual(['birthDate', 'documentNumber', 'givenName']);
  });

  it('asks for the guardian columns when the person is a minor', () => {
    const row = validateRow(2, base({ birthDate: '2012-03-14' }), NOW);
    expect(row.isMinor).toBe(true);
    expect(columnsWithIssues(row)).toEqual(
      [
        'guardianDocumentType',
        'guardianDocumentNumber',
        'guardianGivenName',
        'guardianFamilyName',
        'guardianRelationship',
      ].sort()
    );
  });

  it('does not ask for a guardian when the person is an adult', () => {
    expect(validateRow(2, base({ birthDate: '1990-03-14' }), NOW).issues).toEqual([]);
  });

  it('rejects a birth date in the future', () => {
    const row = validateRow(2, base({ birthDate: '2030-01-01' }), NOW);
    expect(row.issues.some((i) => i.message.includes('futuro'))).toBe(true);
  });

  it('rejects a malformed email but accepts an empty one', () => {
    expect(validateRow(2, base({ email: 'no-es-correo' }), NOW).issues).toHaveLength(1);
    expect(validateRow(2, base({ email: '' }), NOW).issues).toEqual([]);
  });

  it('demands the three payment columns together', () => {
    const row = validateRow(2, base({ payerType: 'PERSON' }), NOW);
    expect(columnsWithIssues(row)).toEqual(['installments', 'totalAmount']);
  });

  it('rejects a payer that is neither PERSON nor PARTNER', () => {
    const row = validateRow(
      2,
      base({ payerType: 'ALIADO', totalAmount: '1200000', installments: '6' }),
      NOW
    );
    expect(columnsWithIssues(row)).toEqual(['payerType']);
  });

  it('rejects a total written with thousands separators, and says how to write it', () => {
    const row = validateRow(
      2,
      base({ payerType: 'PERSON', totalAmount: '1.200.000', installments: '6' }),
      NOW
    );
    expect(row.issues[0]?.column).toBe('totalAmount');
    expect(row.issues[0]?.fix).toContain('1200000');
  });

  it('rejects an instalment count that is not a whole number between 1 and 60', () => {
    for (const installments of ['0', '61', '2.5', 'seis']) {
      const row = validateRow(
        2,
        base({ payerType: 'PERSON', totalAmount: '1200000', installments }),
        NOW
      );
      expect(columnsWithIssues(row)).toEqual(['installments']);
    }
  });
});

describe('flagDuplicatesWithinFile', () => {
  it('points the second appearance at the first, by line number', () => {
    const rows = [
      validateRow(2, base({ email: 'a@b.co' }), NOW),
      validateRow(5, base({ email: 'a@b.co' }), NOW),
    ];

    flagDuplicatesWithinFile(rows);

    expect(rows[0]?.issues).toEqual([]);
    expect(rows[1]?.issues.map((i) => i.message)).toEqual([
      'Este documento ya aparece en la fila 2',
      'Este correo ya aparece en la fila 2',
    ]);
  });

  it('compares emails without caring about case', () => {
    const rows = [
      validateRow(2, base({ documentNumber: '1', email: 'Ana@B.co' }), NOW),
      validateRow(3, base({ documentNumber: '2', email: 'ana@b.co' }), NOW),
    ];

    flagDuplicatesWithinFile(rows);

    expect(rows[1]?.issues).toHaveLength(1);
    expect(rows[1]?.issues[0]?.column).toBe('email');
  });

  it('ignores empty documents and emails instead of collapsing them together', () => {
    const rows = [
      validateRow(2, base({ documentNumber: '1', email: '' }), NOW),
      validateRow(3, base({ documentNumber: '2', email: '' }), NOW),
    ];

    flagDuplicatesWithinFile(rows);

    expect(rows[1]?.issues).toEqual([]);
  });
});
