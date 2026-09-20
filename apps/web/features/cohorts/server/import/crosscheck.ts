/**
 * The dry run's checks against the database.
 * SSOT: plan/06-cohortes-y-personas.md:45-49.
 *
 * Pure, like `validate.ts`: it takes the rows and a snapshot of what the database already
 * holds, and appends issues of the same shape. The service does the queries; keeping the
 * rules here means they can be tested without a database, and means the dry run and the
 * commit cannot drift apart — the commit refuses to run if any issue survives.
 */

import type { ImportRow, RowIssue } from './validate';

/** A person already in the institution, as the cross-checks need to see them. */
export interface KnownPerson {
  id: string;
  documentType: string | null;
  documentNumber: string | null;
  email: string | null;
  givenName: string;
  familyName: string;
  hasBirthDate: boolean;
}

export interface DbSnapshot {
  /** Keyed by `documentType|documentNumber`. */
  peopleByDocument: Map<string, KnownPerson>;
  /** Keyed by lowercased email. */
  peopleByEmail: Map<string, KnownPerson>;
  /** Person ids already enrolled in THIS cohort. */
  enrolledInCohort: Set<string>;
  /**
   * Person ids with at least one earlier enrollment that has no active payment agreement.
   * Only meaningful when `requireAgreement` is on.
   */
  withoutAgreement: Set<string>;
  requireAgreement: boolean;
}

/** What the commit will do with a row, once it is clean. */
export type RowPlan = 'create' | 'reuse';

export interface CheckedRow extends ImportRow {
  /** Id of the existing person this row matched, if any. */
  personId: string | null;
  plan: RowPlan;
  /** Id of the existing guardian this row matched, if any. */
  guardianPersonId: string | null;
  guardianPlan: RowPlan;
  /** Things the operator should know about but that do not block the import. */
  notes: string[];
}

export const documentKey = (type: string, number: string) => `${type}|${number}`;

const push = (row: ImportRow, issue: RowIssue) => row.issues.push(issue);

/**
 * Matches every row against the institution and appends what is wrong.
 *
 * The matching rule is deliberate: **the document identifies the person, the email does
 * not**. Someone can change their email; a `TI` becoming a `CC` at eighteen is a different
 * document, so it is a different key and the row reads as a new person — which is why the
 * template asks for the document type as well as the number.
 */
export function applyCrossChecks(rows: ImportRow[], snapshot: DbSnapshot): CheckedRow[] {
  return rows.map((row): CheckedRow => {
    const notes: string[] = [];
    const { documentType, documentNumber, email, guardianEmail } = row.values;

    const byDocument =
      documentNumber === ''
        ? undefined
        : snapshot.peopleByDocument.get(documentKey(documentType, documentNumber));

    const personId = byDocument?.id ?? null;
    const plan: RowPlan = byDocument ? 'reuse' : 'create';

    if (byDocument) {
      notes.push(
        `Ya existe en la institución como ${byDocument.familyName}, ${byDocument.givenName}: se reutiliza y se matricula`
      );

      const fileName = `${row.values.familyName}, ${row.values.givenName}`;
      const knownName = `${byDocument.familyName}, ${byDocument.givenName}`;
      if (fileName.toLowerCase() !== knownName.toLowerCase()) {
        notes.push(`El archivo la nombra "${fileName}" y la institución "${knownName}"`);
      }

      if (snapshot.enrolledInCohort.has(byDocument.id)) {
        push(row, {
          column: 'documentNumber',
          message: 'Esta persona ya está matriculada en esta cohorte',
          fix: 'Quita la fila: no se puede matricular dos veces en la misma cohorte',
        });
      }

      if (snapshot.requireAgreement && snapshot.withoutAgreement.has(byDocument.id)) {
        push(row, {
          column: null,
          message:
            'Tiene una matrícula anterior sin acuerdo de pago firmado y la institución lo exige para la siguiente cohorte',
          fix: 'Registra el acuerdo de pago de la matrícula anterior, o quita la fila',
        });
      }
    }

    // El correo no identifica a la persona, pero sí es único por institución: si ya lo
    // tiene OTRA persona, el `INSERT` fallaría a mitad de la transacción. Mejor aquí.
    const emailKey = email.toLowerCase();
    if (emailKey !== '') {
      const owner = snapshot.peopleByEmail.get(emailKey);
      if (owner && owner.id !== personId) {
        push(row, {
          column: 'email',
          message: `Este correo ya es de otra persona en la institución (${owner.familyName}, ${owner.givenName})`,
          fix: 'Usa otro correo o déjalo vacío',
        });
      }
    }

    const guardianDocument = row.values.guardianDocumentNumber;
    const byGuardianDocument =
      guardianDocument === ''
        ? undefined
        : snapshot.peopleByDocument.get(
            documentKey(row.values.guardianDocumentType, guardianDocument)
          );

    const guardianPersonId = byGuardianDocument?.id ?? null;
    const guardianPlan: RowPlan = byGuardianDocument ? 'reuse' : 'create';

    if (byGuardianDocument) {
      notes.push(
        `El acudiente ya existe como ${byGuardianDocument.familyName}, ${byGuardianDocument.givenName}: se reutiliza`
      );
    }

    const guardianEmailKey = guardianEmail.toLowerCase();
    if (guardianEmailKey !== '') {
      const owner = snapshot.peopleByEmail.get(guardianEmailKey);
      if (owner && owner.id !== guardianPersonId) {
        push(row, {
          column: 'guardianEmail',
          message: `El correo del acudiente ya es de otra persona en la institución (${owner.familyName}, ${owner.givenName})`,
          fix: 'Usa otro correo o déjalo vacío',
        });
      }

      if (guardianEmailKey === emailKey && emailKey !== '') {
        push(row, {
          column: 'guardianEmail',
          message: 'El acudiente y la persona no pueden compartir el mismo correo',
          fix: 'Cada uno necesita el suyo, o deja vacío el del acudiente',
        });
      }
    }

    if (
      guardianDocument !== '' &&
      documentNumber !== '' &&
      documentKey(row.values.guardianDocumentType, guardianDocument) ===
        documentKey(documentType, documentNumber)
    ) {
      push(row, {
        column: 'guardianDocumentNumber',
        message: 'El acudiente no puede ser la misma persona',
        fix: 'Revisa el documento del acudiente',
      });
    }

    return { ...row, personId, plan, guardianPersonId, guardianPlan, notes };
  });
}

export interface ImportSummary {
  total: number;
  importable: number;
  withErrors: number;
  toCreate: number;
  toReuse: number;
}

export function summarise(rows: CheckedRow[]): ImportSummary {
  const clean = rows.filter((r) => r.issues.length === 0);

  return {
    total: rows.length,
    importable: clean.length,
    withErrors: rows.length - clean.length,
    toCreate: clean.filter((r) => r.plan === 'create').length,
    toReuse: clean.filter((r) => r.plan === 'reuse').length,
  };
}
