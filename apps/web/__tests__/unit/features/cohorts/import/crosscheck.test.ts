/** @jest-environment node */
/**
 * Los cruces del ensayo contra la institución.
 * SSOT: plan/06-cohortes-y-personas.md:45-49.
 *
 * `crosscheck.ts` es puro a propósito: recibe las filas y una foto de lo que ya hay en la
 * base, así que aquí no hace falta ni mock de Prisma.
 */

import {
  applyCrossChecks,
  summarise,
  documentKey,
} from '@/features/cohorts/server/import/crosscheck';
import type { DbSnapshot, KnownPerson } from '@/features/cohorts/server/import/crosscheck';
import { validateRow, toValues } from '@/features/cohorts/server/import/validate';
import { IMPORT_COLUMNS } from '@/features/cohorts/server/import/columns';

const NOW = new Date('2026-09-17T12:00:00.000Z');
const HEADERS = [...IMPORT_COLUMNS];

const person = (over: Partial<KnownPerson> = {}): KnownPerson => ({
  id: 'p1',
  documentType: 'CC',
  documentNumber: '900',
  email: 'ya@example.com',
  givenName: 'Luz',
  familyName: 'Mora',
  hasBirthDate: true,
  ...over,
});

const emptySnapshot = (over: Partial<DbSnapshot> = {}): DbSnapshot => ({
  peopleByDocument: new Map(),
  peopleByEmail: new Map(),
  enrolledInCohort: new Set(),
  withoutAgreement: new Set(),
  requireAgreement: false,
  ...over,
});

/** Una fila adulta y limpia; cada test cambia solo lo suyo. */
const row = (over: Partial<Record<string, string>> = {}, line = 2) => {
  const base: Record<string, string> = {
    documentType: 'CC',
    documentNumber: '900',
    givenName: 'Luz',
    familyName: 'Mora',
    birthDate: '1990-01-01',
    email: '',
    phone: '',
    guardianDocumentType: '',
    guardianDocumentNumber: '',
    guardianGivenName: '',
    guardianFamilyName: '',
    guardianEmail: '',
    guardianRelationship: '',
    payerType: '',
    totalAmount: '',
    installments: '',
    ...over,
  };
  return validateRow(
    line,
    toValues(
      HEADERS,
      HEADERS.map((h) => base[h] ?? '')
    ),
    NOW
  );
};

/** `noUncheckedIndexedAccess` obliga a probar que la fila existe antes de leerla. */
const only = <T>(rows: T[]): T => {
  expect(rows).toHaveLength(1);
  const [first] = rows;
  if (!first) throw new Error('applyCrossChecks no devolvió ninguna fila');
  return first;
};

describe('applyCrossChecks', () => {
  it('reutiliza a quien ya existe por documento y lo dice sin bloquear', () => {
    const known = person();
    const snapshot = emptySnapshot({
      peopleByDocument: new Map([[documentKey('CC', '900'), known]]),
    });

    const checked = only(applyCrossChecks([row()], snapshot));

    expect(checked.plan).toBe('reuse');
    expect(checked.personId).toBe('p1');
    expect(checked.issues).toHaveLength(0);
    expect(checked.notes.join(' ')).toContain('se reutiliza');
  });

  it('el documento identifica a la persona, no el correo', () => {
    // Mismo correo, distinto documento: es otra persona, y el correo choca.
    const known = person({ id: 'otra', documentNumber: '111' });
    const snapshot = emptySnapshot({
      peopleByDocument: new Map([[documentKey('CC', '111'), known]]),
      peopleByEmail: new Map([['ya@example.com', known]]),
    });

    const checked = only(applyCrossChecks([row({ email: 'ya@example.com' })], snapshot));

    expect(checked.plan).toBe('create');
    expect(checked.issues.map((i) => i.column)).toContain('email');
  });

  it('rechaza a quien ya está matriculado en esta cohorte', () => {
    const known = person();
    const snapshot = emptySnapshot({
      peopleByDocument: new Map([[documentKey('CC', '900'), known]]),
      enrolledInCohort: new Set(['p1']),
    });

    const checked = only(applyCrossChecks([row()], snapshot));

    expect(checked.issues.map((i) => i.message).join(' ')).toContain('ya está matriculada');
  });

  it('exige acuerdo de pago solo cuando la política está activa', () => {
    const known = person();
    const base = {
      peopleByDocument: new Map([[documentKey('CC', '900'), known]]),
      withoutAgreement: new Set(['p1']),
    };

    const sinPolitica = only(
      applyCrossChecks([row()], emptySnapshot({ ...base, requireAgreement: false }))
    );
    expect(sinPolitica.issues).toHaveLength(0);

    const conPolitica = only(
      applyCrossChecks([row()], emptySnapshot({ ...base, requireAgreement: true }))
    );
    expect(conPolitica.issues.map((i) => i.message).join(' ')).toContain('acuerdo de pago');
  });

  it('no deja que el acudiente sea la misma persona ni comparta correo', () => {
    const minor = {
      birthDate: '2012-05-01',
      email: 'ana@example.com',
      guardianDocumentType: 'CC',
      guardianDocumentNumber: '900',
      guardianGivenName: 'Luz',
      guardianFamilyName: 'Mora',
      guardianRelationship: 'madre',
      guardianEmail: 'ana@example.com',
    };

    const checked = only(applyCrossChecks([row(minor)], emptySnapshot()));
    const columns = checked.issues.map((i) => i.column);

    expect(columns).toContain('guardianDocumentNumber');
    expect(columns).toContain('guardianEmail');
  });

  it('reutiliza al acudiente que ya existe', () => {
    const guardian = person({ id: 'g1', documentNumber: '555', email: null });
    const snapshot = emptySnapshot({
      peopleByDocument: new Map([[documentKey('CC', '555'), guardian]]),
    });

    const checked = only(
      applyCrossChecks(
        [
          row({
            birthDate: '2012-05-01',
            guardianDocumentType: 'CC',
            guardianDocumentNumber: '555',
            guardianGivenName: 'Luz',
            guardianFamilyName: 'Mora',
            guardianRelationship: 'madre',
          }),
        ],
        snapshot
      )
    );

    expect(checked.guardianPlan).toBe('reuse');
    expect(checked.guardianPersonId).toBe('g1');
    expect(checked.issues).toHaveLength(0);
  });
});

describe('summarise', () => {
  it('cuenta importables, con errores, nuevas y reutilizadas', () => {
    const known = person();
    const snapshot = emptySnapshot({
      peopleByDocument: new Map([[documentKey('CC', '900'), known]]),
    });

    const rows = applyCrossChecks(
      [
        row(), // reutiliza
        row({ documentNumber: '901' }, 3), // nueva
        row({ documentNumber: '902', birthDate: '' }, 4), // error
      ],
      snapshot
    );

    expect(summarise(rows)).toEqual({
      total: 3,
      importable: 2,
      withErrors: 1,
      toCreate: 1,
      toReuse: 1,
    });
  });
});
