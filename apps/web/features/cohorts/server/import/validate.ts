/**
 * Row validation for the CSV import — the dry run's brain.
 * SSOT: plan/06-cohortes-y-personas.md:45-49.
 *
 * Pure: rows in, issues out. Everything that needs the database (an email already taken, a
 * person already enrolled) is checked by the service and appended to these same issues, so
 * the screen has one shape to render.
 */

import { calculateAgeAt } from '@colombia-estudia/domain';
import {
  IMPORT_COLUMNS,
  REQUIRED_COLUMNS,
  GUARDIAN_COLUMNS,
  PAYMENT_COLUMNS,
  type ImportColumn,
} from './columns';

export interface RowIssue {
  /** Null when the problem is the row as a whole, not one cell. */
  column: ImportColumn | null;
  message: string;
  /** What to do about it, in the same words operations would use. */
  fix: string;
}

export interface ImportRow {
  line: number;
  values: Record<ImportColumn, string>;
  isMinor: boolean;
  hasPayment: boolean;
  issues: RowIssue[];
}

export interface HeaderCheck {
  ok: boolean;
  missing: string[];
  unknown: string[];
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** The file must carry every column of the template, and nothing it does not understand. */
export function checkHeaders(headers: string[]): HeaderCheck {
  const present = new Set(headers);
  const known = new Set<string>(IMPORT_COLUMNS);

  const missing = IMPORT_COLUMNS.filter((c) => !present.has(c));
  const unknown = headers.filter((h) => h !== '' && !known.has(h));

  return { ok: missing.length === 0 && unknown.length === 0, missing, unknown };
}

/** Maps a parsed record onto the template's columns, by header position. */
export function toValues(headers: string[], cells: string[]): Record<ImportColumn, string> {
  const values = Object.fromEntries(IMPORT_COLUMNS.map((c) => [c, ''])) as Record<
    ImportColumn,
    string
  >;

  headers.forEach((header, index) => {
    if ((IMPORT_COLUMNS as readonly string[]).includes(header)) {
      values[header as ImportColumn] = (cells[index] ?? '').trim();
    }
  });

  return values;
}

/**
 * Is this a real calendar date, written the way the template asks for?
 * `new Date('2026-02-31')` happily rolls over to March, which would silently import a
 * birth date nobody typed.
 */
export function parseBirthDate(value: string): Date | null {
  if (!ISO_DATE.test(value)) return null;

  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return null;
  if (date.toISOString().slice(0, 10) !== value) return null;

  return date;
}

export function validateRow(
  line: number,
  values: Record<ImportColumn, string>,
  now: Date
): ImportRow {
  const issues: RowIssue[] = [];

  for (const column of REQUIRED_COLUMNS) {
    if (values[column] === '') {
      issues.push({
        column,
        message: 'Falta un dato obligatorio',
        fix: 'Escribe un valor en esta columna',
      });
    }
  }

  const birthDate = values.birthDate === '' ? null : parseBirthDate(values.birthDate);
  if (values.birthDate !== '' && !birthDate) {
    issues.push({
      column: 'birthDate',
      message: 'La fecha de nacimiento no es una fecha real con formato AAAA-MM-DD',
      fix: 'Escríbela como 2010-03-14',
    });
  }
  if (birthDate && birthDate > now) {
    issues.push({
      column: 'birthDate',
      message: 'La fecha de nacimiento está en el futuro',
      fix: 'Revisa el año',
    });
  }

  const isMinor = birthDate ? calculateAgeAt(birthDate, now) < 18 : false;

  if (values.email !== '' && !EMAIL.test(values.email)) {
    issues.push({
      column: 'email',
      message: 'El correo no tiene un formato válido',
      fix: 'Revísalo o déjalo vacío',
    });
  }

  if (isMinor) {
    for (const column of GUARDIAN_COLUMNS) {
      if (values[column] === '') {
        issues.push({
          column,
          message: 'Es menor de edad y faltan datos del acudiente',
          fix: 'Completa las columnas del acudiente',
        });
      }
    }
  }

  if (values.guardianEmail !== '' && !EMAIL.test(values.guardianEmail)) {
    issues.push({
      column: 'guardianEmail',
      message: 'El correo del acudiente no tiene un formato válido',
      fix: 'Revísalo o déjalo vacío',
    });
  }

  const paymentFilled = PAYMENT_COLUMNS.filter((c) => values[c] !== '');
  const hasPayment = paymentFilled.length > 0;

  if (hasPayment && paymentFilled.length < PAYMENT_COLUMNS.length) {
    for (const column of PAYMENT_COLUMNS) {
      if (values[column] === '') {
        issues.push({
          column,
          message: 'El plan de pago necesita las tres columnas',
          fix: 'Completa payerType, totalAmount e installments, o deja las tres vacías',
        });
      }
    }
  }

  if (hasPayment) {
    if (values.payerType !== '' && !['PERSON', 'PARTNER'].includes(values.payerType)) {
      issues.push({
        column: 'payerType',
        message: 'El pagador solo puede ser PERSON o PARTNER',
        fix: 'Escribe PERSON si paga la persona, PARTNER si paga el aliado',
      });
    }

    const total = Number(values.totalAmount);
    if (values.totalAmount !== '' && (!Number.isFinite(total) || total <= 0)) {
      issues.push({
        column: 'totalAmount',
        message: 'El total debe ser un número mayor que cero, sin puntos ni comas',
        fix: 'Escribe 1200000, no 1.200.000',
      });
    }

    const count = Number(values.installments);
    if (values.installments !== '' && (!Number.isInteger(count) || count < 1 || count > 60)) {
      issues.push({
        column: 'installments',
        message: 'El número de cuotas debe ser un entero entre 1 y 60',
        fix: 'Escribe por ejemplo 6',
      });
    }
  }

  return { line, values, isMinor, hasPayment, issues };
}

/**
 * Flags people who appear twice in the same file.
 *
 * The database's unique constraints would catch it later, but they would catch it during the
 * commit, after the operator thought the file was clean. Better here, pointing at the second
 * row, which is the one they have to fix.
 */
export function flagDuplicatesWithinFile(rows: ImportRow[]): ImportRow[] {
  const seenDocument = new Map<string, number>();
  const seenEmail = new Map<string, number>();

  for (const row of rows) {
    const document = `${row.values.documentType}|${row.values.documentNumber}`;
    if (row.values.documentNumber !== '') {
      const first = seenDocument.get(document);
      if (first !== undefined) {
        row.issues.push({
          column: 'documentNumber',
          message: `Este documento ya aparece en la fila ${first}`,
          fix: 'Deja una sola fila por persona',
        });
      } else {
        seenDocument.set(document, row.line);
      }
    }

    const email = row.values.email.toLowerCase();
    if (email !== '') {
      const first = seenEmail.get(email);
      if (first !== undefined) {
        row.issues.push({
          column: 'email',
          message: `Este correo ya aparece en la fila ${first}`,
          fix: 'Cada persona necesita un correo distinto',
        });
      } else {
        seenEmail.set(email, row.line);
      }
    }
  }

  return rows;
}
