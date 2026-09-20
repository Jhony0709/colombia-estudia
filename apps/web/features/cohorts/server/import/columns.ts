/**
 * The import template's columns.
 * SSOT: plan/06-cohortes-y-personas.md:40-44.
 *
 * One list, used by the template download, the parser and the validator: a column renamed
 * here is renamed everywhere, which is the whole point of not spelling them out three times.
 */

export const IMPORT_COLUMNS = [
  'documentType',
  'documentNumber',
  'givenName',
  'familyName',
  'birthDate',
  'email',
  'phone',
  'guardianDocumentType',
  'guardianDocumentNumber',
  'guardianGivenName',
  'guardianFamilyName',
  'guardianEmail',
  'guardianRelationship',
  'payerType',
  'totalAmount',
  'installments',
] as const;

export type ImportColumn = (typeof IMPORT_COLUMNS)[number];

/** Columns that must carry a value in every row. */
export const REQUIRED_COLUMNS: readonly ImportColumn[] = [
  'documentType',
  'documentNumber',
  'givenName',
  'familyName',
  'birthDate',
];

/** Required only when the person is under 18 on the day of the import. */
export const GUARDIAN_COLUMNS: readonly ImportColumn[] = [
  'guardianDocumentType',
  'guardianDocumentNumber',
  'guardianGivenName',
  'guardianFamilyName',
  'guardianRelationship',
];

/** Required together: either the three of them, or none. */
export const PAYMENT_COLUMNS: readonly ImportColumn[] = [
  'payerType',
  'totalAmount',
  'installments',
];

/** A filled-in row, so whoever opens the template sees the shape of every column. */
export const EXAMPLE_ROW: Record<ImportColumn, string> = {
  documentType: 'TI',
  documentNumber: '1012345678',
  givenName: 'Ana María',
  familyName: 'Ruiz Peña',
  birthDate: '2010-03-14',
  email: 'ana.ruiz@example.com',
  phone: '3001234567',
  guardianDocumentType: 'CC',
  guardianDocumentNumber: '52123456',
  guardianGivenName: 'Marta',
  guardianFamilyName: 'Peña',
  guardianEmail: 'marta.pena@example.com',
  guardianRelationship: 'madre',
  payerType: 'PERSON',
  totalAmount: '1200000',
  installments: '6',
};
