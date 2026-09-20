/**
 * The CSV import: dry run and commit.
 * SSOT: plan/06-cohortes-y-personas.md:38-56 (§5).
 *
 * Shape of the thing: `validate.ts` checks each row on its own, `crosscheck.ts` checks it
 * against the institution, and this file is the only part that touches the database. The
 * dry run and the commit run **exactly the same checks** — the commit simply refuses when
 * any issue survives — so "55 se importarán" cannot turn into 54 at the last second.
 *
 * Invitations are not sent here (plan:56, "Nada de invitaciones aquí"): importing and
 * inviting are separate steps because one is reversible by fixing a spreadsheet and the
 * other puts a link in a stranger's inbox.
 */

import 'server-only';

import { calculateAgeAt } from '@colombia-estudia/domain';
import { createTenantClient } from '@/lib/db/tenant';
import { APIError } from '@/lib/core/errors';
import { parseCsv } from '@/lib/csv/parse';
import { toCsv, CSV_BOM } from '@/lib/csv/serialize';
import { IMPORT_COLUMNS } from './columns';
import {
  checkHeaders,
  toValues,
  validateRow,
  parseBirthDate,
  flagDuplicatesWithinFile,
  type ImportRow,
} from './validate';
import {
  applyCrossChecks,
  summarise,
  documentKey,
  type CheckedRow,
  type DbSnapshot,
  type KnownPerson,
  type ImportSummary,
} from './crosscheck';
import { resolveAccessUntil } from '../enrollments.service';

/**
 * Upper bound on a file, so a mistaken upload cannot hold a transaction open.
 * A cohort is in the low hundreds of people (plan:38); 2000 rows is far past that and
 * still parses in well under the two minutes the exit criteria allow.
 */
export const MAX_ROWS = 2000;

export interface ImportResult {
  summary: ImportSummary;
  rows: CheckedRow[];
  /** Only on a committed run. */
  importRunId: string | null;
}

/**
 * How a payment plan's instalments are laid out.
 *
 * The template carries the total and the number of instalments, not the dates: operations
 * fills in a spreadsheet, and asking them to type twelve due dates per person is how
 * spreadsheets get wrong. The schedule is therefore derived, and derived the boring way —
 * the first instalment falls on the day the cohort starts and the rest every month after.
 *
 * Amounts are whole pesos (`Decimal(12,0)`): the division's remainder goes on the FIRST
 * instalment, never the last, so the final payment is never the odd one out.
 */
export function planInstallments({
  total,
  count,
  firstDueOn,
}: {
  total: number;
  count: number;
  firstDueOn: Date;
}): Array<{ position: number; amount: number; dueOn: Date }> {
  const base = Math.floor(total / count);
  const remainder = total - base * count;

  const year = firstDueOn.getUTCFullYear();
  const month = firstDueOn.getUTCMonth();
  const day = firstDueOn.getUTCDate();

  return Array.from({ length: count }, (_, index) => {
    // `setUTCMonth` desborda: al 31 de enero mas un mes le contesta el 2 o 3 de marzo,
    // y una cohorte que arranca el 31 acabaria con cuotas en dias absurdos. Se sujeta al
    // ultimo dia del mes destino, que es lo que hace cualquier calendario de pagos.
    const target = month + index;
    const lastDay = new Date(Date.UTC(year, target + 1, 0)).getUTCDate();
    const dueOn = new Date(Date.UTC(year, target, Math.min(day, lastDay)));

    return {
      position: index + 1,
      amount: index === 0 ? base + remainder : base,
      dueOn,
    };
  });
}

/** Reads the file into validated rows, with no database involved. */
function readRows(csv: string, now: Date): ImportRow[] {
  const parsed = parseCsv(csv);

  const headers = checkHeaders(parsed.headers);
  if (!headers.ok) {
    const parts: string[] = [];
    if (headers.missing.length > 0) parts.push(`faltan: ${headers.missing.join(', ')}`);
    if (headers.unknown.length > 0) parts.push(`sobran: ${headers.unknown.join(', ')}`);
    throw new APIError(
      `Las columnas del archivo no son las de la plantilla (${parts.join('; ')}). Descarga la plantilla y vuelve a empezar.`,
      'VALIDATION_ERROR'
    );
  }

  if (parsed.rows.length === 0) {
    throw new APIError('El archivo no tiene ninguna fila de datos', 'VALIDATION_ERROR');
  }
  if (parsed.rows.length > MAX_ROWS) {
    throw new APIError(
      `El archivo trae ${parsed.rows.length} filas y el máximo es ${MAX_ROWS}. Pártelo en varios archivos.`,
      'VALIDATION_ERROR'
    );
  }

  const rows = parsed.rows.map(({ line, cells }) =>
    validateRow(line, toValues(parsed.headers, cells), now)
  );

  return flagDuplicatesWithinFile(rows);
}

/**
 * Validates the file against the cohort and the institution. Touches the database only to
 * read. This is what `dryRun=true` returns, and what the commit runs first.
 */
export async function dryRunImport({
  institutionId,
  cohortId,
  csv,
  now = new Date(),
}: {
  institutionId: string;
  cohortId: string;
  csv: string;
  now?: Date;
}): Promise<ImportResult> {
  const db = createTenantClient(institutionId);
  const rows = readRows(csv, now);

  const cohort = await db.cohort.findFirst({
    where: { id: cohortId },
    select: { id: true, status: true, startsOn: true, accessUntil: true },
  });
  if (!cohort) throw new APIError('Cohort not found', 'NOT_FOUND');
  if (cohort.status !== 'PLANNED' && cohort.status !== 'OPEN') {
    throw new APIError('La cohorte ya no admite matrículas', 'CONFLICT');
  }

  // Todos los documentos y correos del archivo, de las personas y de los acudientes, en
  // dos consultas. Una consulta por fila serían 120 idas y vueltas para 60 personas.
  const documents = new Set<string>();
  const emails = new Set<string>();
  for (const row of rows) {
    if (row.values.documentNumber !== '') documents.add(row.values.documentNumber);
    if (row.values.guardianDocumentNumber !== '') documents.add(row.values.guardianDocumentNumber);
    if (row.values.email !== '') emails.add(row.values.email.toLowerCase());
    if (row.values.guardianEmail !== '') emails.add(row.values.guardianEmail.toLowerCase());
  }

  const known = await db.person.findMany({
    where: {
      anonymizedAt: null,
      OR: [{ documentNumber: { in: [...documents] } }, { email: { in: [...emails] } }],
    },
    select: {
      id: true,
      documentType: true,
      documentNumber: true,
      email: true,
      givenName: true,
      familyName: true,
      birthDate: true,
    },
  });

  const peopleByDocument = new Map<string, KnownPerson>();
  const peopleByEmail = new Map<string, KnownPerson>();
  for (const person of known) {
    const entry: KnownPerson = {
      id: person.id,
      documentType: person.documentType,
      documentNumber: person.documentNumber,
      email: person.email,
      givenName: person.givenName,
      familyName: person.familyName,
      hasBirthDate: person.birthDate !== null,
    };
    if (person.documentType && person.documentNumber) {
      peopleByDocument.set(documentKey(person.documentType, person.documentNumber), entry);
    }
    if (person.email) peopleByEmail.set(person.email.toLowerCase(), entry);
  }

  const knownIds = known.map((p) => p.id);

  const enrolled = await db.enrollment.findMany({
    where: { cohortId, studentId: { in: knownIds } },
    select: { studentId: true },
  });

  const policy = await db.restrictionPolicy.findUnique({
    where: { institutionId },
    select: { requireAgreementForNextCohort: true },
  });
  const requireAgreement = policy?.requireAgreementForNextCohort ?? false;

  // Solo se consulta si la política está activa: si no, la respuesta no cambia nada.
  const withoutAgreement = new Set<string>();
  if (requireAgreement && knownIds.length > 0) {
    const priorEnrollments = await db.enrollment.findMany({
      where: { studentId: { in: knownIds }, cohortId: { not: cohortId } },
      select: {
        studentId: true,
        paymentAgreements: { where: { status: 'ACTIVE' }, select: { id: true } },
      },
    });
    for (const enrollment of priorEnrollments) {
      if (enrollment.paymentAgreements.length === 0) {
        withoutAgreement.add(enrollment.studentId);
      }
    }
  }

  const snapshot: DbSnapshot = {
    peopleByDocument,
    peopleByEmail,
    enrolledInCohort: new Set(enrolled.map((e) => e.studentId)),
    withoutAgreement,
    requireAgreement,
  };

  const checked = applyCrossChecks(rows, snapshot);

  return { summary: summarise(checked), rows: checked, importRunId: null };
}

/**
 * Commits the file. All or nothing (plan:54).
 *
 * It re-runs the dry run first and refuses if a single issue survives. That is the point:
 * the operator was shown "55 se importarán, 5 con errores" and pressed confirm; importing
 * 54 because the 55th collided in the meantime would be worse than importing none.
 *
 * On reuse, existing people are **filled in, never overwritten**: a blank stored email
 * takes the file's value, a different stored email keeps the institution's. An import is a
 * bulk enrolment, not a bulk edit, and silently rewriting names from a spreadsheet is how
 * a person loses their own.
 */
export async function commitImport({
  institutionId,
  actorId,
  cohortId,
  csv,
  now = new Date(),
}: {
  institutionId: string;
  actorId: string;
  cohortId: string;
  csv: string;
  now?: Date;
}): Promise<ImportResult> {
  const db = createTenantClient(institutionId);

  const dry = await dryRunImport({ institutionId, cohortId, csv, now });
  if (dry.summary.withErrors > 0) {
    throw new APIError(
      `El archivo todavía tiene ${dry.summary.withErrors} fila(s) con errores. Corrígelas y vuelve a validar.`,
      'VALIDATION_ERROR'
    );
  }

  const cohort = await db.cohort.findFirst({
    where: { id: cohortId },
    select: {
      id: true,
      code: true,
      startsOn: true,
      accessUntil: true,
      program: { select: { defaultAccessDays: true } },
    },
  });
  if (!cohort) throw new APIError('Cohort not found', 'NOT_FOUND');

  const accessUntil = resolveAccessUntil({
    cohortAccessUntil: cohort.accessUntil,
    defaultAccessDays: cohort.program.defaultAccessDays,
    enrolledAt: now,
  });

  const importRunId = await db.$transaction(
    async (tx) => {
      const run = await tx.importRun.create({
        data: {
          institutionId,
          source: `csv:cohort:${cohort.code}`,
          dryRun: false,
          startedById: actorId,
        },
        select: { id: true },
      });

      // Hermanos comparten acudiente: sin esta caché, la segunda fila intentaria crearlo
      // de nuevo y chocaria contra @@unique([institutionId, documentType, documentNumber]).
      const guardianIds = new Map<string, string>();

      // Estado actual de quienes se reutilizan, para rellenar huecos sin pisar nada.
      const reusedIds = dry.rows
        .map((row) => row.personId)
        .filter((id): id is string => id !== null);
      const stored = new Map(
        (
          await tx.person.findMany({
            where: { id: { in: reusedIds } },
            select: { id: true, email: true, phone: true, birthDate: true },
          })
        ).map((person) => [person.id, person])
      );

      let created = 0;
      let reused = 0;
      let guardianshipsLinked = 0;
      let plansCreated = 0;

      for (const row of dry.rows) {
        const v = row.values;
        const birthDate = parseBirthDate(v.birthDate);
        if (!birthDate) {
          // Inalcanzable: `validateRow` ya lo exige. Explicito para no crear una
          // matricula sin saber si la persona era menor, que es el dato del que cuelga
          // el consentimiento y toda la politica de acceso.
          throw new APIError(`Fila ${row.line}: fecha de nacimiento ilegible`, 'VALIDATION_ERROR');
        }

        let personId = row.personId;
        if (personId) {
          reused += 1;

          // Rellenar, nunca pisar: solo se escribe donde la institucion no tenia dato.
          // La fecha de nacimiento es la que mas importa: sin ella no se puede saber si
          // era menor al matricularse, y el archivo siempre la trae.
          const current = stored.get(personId);
          const fill: { email?: string; phone?: string; birthDate?: Date } = {};
          if (!current?.email && v.email !== '') fill.email = v.email.toLowerCase();
          if (!current?.phone && v.phone !== '') fill.phone = v.phone;
          if (!current?.birthDate) fill.birthDate = birthDate;

          if (Object.keys(fill).length > 0) {
            await tx.person.update({ where: { id: personId }, data: fill });
          }
        } else {
          const person = await tx.person.create({
            data: {
              institutionId,
              givenName: v.givenName,
              familyName: v.familyName,
              documentType: v.documentType,
              documentNumber: v.documentNumber,
              birthDate,
              email: v.email === '' ? null : v.email.toLowerCase(),
              phone: v.phone === '' ? null : v.phone,
            },
            select: { id: true },
          });
          personId = person.id;
          created += 1;
        }

        const isMinor = calculateAgeAt(birthDate, now) < 18;

        if (isMinor) {
          const key = documentKey(v.guardianDocumentType, v.guardianDocumentNumber);
          let guardianId = row.guardianPersonId ?? guardianIds.get(key) ?? null;

          if (!guardianId) {
            const guardian = await tx.person.create({
              data: {
                institutionId,
                givenName: v.guardianGivenName,
                familyName: v.guardianFamilyName,
                documentType: v.guardianDocumentType,
                documentNumber: v.guardianDocumentNumber,
                email: v.guardianEmail === '' ? null : v.guardianEmail.toLowerCase(),
              },
              select: { id: true },
            });
            guardianId = guardian.id;
          }
          guardianIds.set(key, guardianId);

          await tx.guardianship.upsert({
            where: { guardianId_studentId: { guardianId, studentId: personId } },
            update: {},
            create: {
              institutionId,
              guardianId,
              studentId: personId,
              relationship: v.guardianRelationship,
              // Si el plan de pago lo paga una persona y quien estudia es menor, el
              // responsable economico es el acudiente: no hay otro adulto en la fila.
              isFinancialResponsible: row.hasPayment && v.payerType === 'PERSON',
            },
          });
          guardianshipsLinked += 1;
        }

        const enrollment = await tx.enrollment.create({
          data: {
            institutionId,
            cohortId,
            studentId: personId,
            isMinorAtEnrollment: isMinor,
            accessUntil,
          },
          select: { id: true },
        });

        const hasRole = await tx.membership.findFirst({
          where: { personId, role: 'STUDENT', revokedAt: null },
          select: { id: true },
        });
        if (!hasRole) {
          await tx.membership.create({
            data: { institutionId, personId, role: 'STUDENT' },
          });
        }

        if (row.hasPayment) {
          const total = Number(v.totalAmount);
          const count = Number(v.installments);
          const payerPersonId =
            v.payerType === 'PERSON'
              ? isMinor
                ? (guardianIds.get(documentKey(v.guardianDocumentType, v.guardianDocumentNumber)) ??
                  personId)
                : personId
              : null;

          const plan = await tx.paymentPlan.create({
            data: {
              institutionId,
              enrollmentId: enrollment.id,
              payerType: v.payerType === 'PARTNER' ? 'PARTNER' : 'PERSON',
              payerPersonId,
              totalAmount: total,
            },
            select: { id: true },
          });

          await tx.installment.createMany({
            data: planInstallments({ total, count, firstDueOn: cohort.startsOn }).map(
              (installment) => ({
                institutionId,
                paymentPlanId: plan.id,
                position: installment.position,
                amount: installment.amount,
                dueOn: installment.dueOn,
              })
            ),
          });
          plansCreated += 1;
        }
      }

      const summary = {
        ...dry.summary,
        created,
        reused,
        guardianshipsLinked,
        plansCreated,
        cohortId,
      };

      await tx.importRun.update({
        where: { id: run.id },
        data: { finishedAt: new Date(), summary },
      });

      await tx.auditLog.create({
        data: {
          institutionId,
          actorId,
          entity: 'import',
          entityId: run.id,
          action: 'run',
          after: summary,
        },
      });

      return run.id;
    },
    // Sesenta personas son sesenta matriculas mas sus acudientes y cuotas: el timeout por
    // defecto de Prisma (5 s) se queda corto y el criterio de salida da dos minutos.
    { timeout: 120_000, maxWait: 10_000 }
  );

  return { ...dry, importRunId };
}

/** The rejected rows, as a file operations can open in Excel, fix, and upload again. */
export function errorsCsv(rows: CheckedRow[]): string {
  const failed = rows.filter((row) => row.issues.length > 0);

  const header = ['fila', 'columna', 'problema', 'arreglo', ...IMPORT_COLUMNS];
  const body = failed.flatMap((row) =>
    row.issues.map((issue) => [
      String(row.line),
      issue.column ?? '(la fila entera)',
      issue.message,
      issue.fix,
      ...IMPORT_COLUMNS.map((column) => row.values[column]),
    ])
  );

  return CSV_BOM + toCsv(header, body);
}
