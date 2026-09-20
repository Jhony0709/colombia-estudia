/**
 * Guardianships and paper consents.
 * SSOT: plan/06-cohortes-y-personas.md:36-37 (§4), endpoints.md:75 (consent).
 *
 * Both live together because they are the same conversation: a minor needs a guardian, and
 * the guardian is who signs for them.
 */

import 'server-only';

import { calculateAgeAt } from '@colombia-estudia/domain';
import { createTenantClient } from '@/lib/db/tenant';
import { isUniqueViolation } from '@/lib/db/errors';
import { APIError } from '@/lib/core/errors';

export type ConsentChannel = 'PAPER' | 'EMAIL';
export const CONSENT_CHANNELS: readonly ConsentChannel[] = ['PAPER', 'EMAIL'];

/**
 * Finds a person by document number or email, which is what operations has at hand when
 * they are looking at a paper form. Never by name: too many collisions.
 */
async function findPersonByHandle(
  db: ReturnType<typeof createTenantClient>,
  handle: string
): Promise<{ id: string; givenName: string; familyName: string } | null> {
  const value = handle.trim();
  if (!value) return null;

  return db.person.findFirst({
    where: {
      anonymizedAt: null,
      OR: [{ documentNumber: value }, { email: value.toLowerCase() }],
    },
    select: { id: true, givenName: true, familyName: true },
  });
}

/**
 * Links a guardian to a student.
 *
 * Also grants the GUARDIAN role if the person does not have it: a guardian with no role is
 * a record nobody can act on, and the CSV import will create the pair the same way.
 */
export async function linkGuardian({
  institutionId,
  actorId,
  studentId,
  guardianHandle,
  relationship,
  isFinancialResponsible,
}: {
  institutionId: string;
  actorId: string | null;
  studentId: string;
  guardianHandle: string;
  relationship: string;
  isFinancialResponsible: boolean;
}): Promise<{ guardianId: string }> {
  const db = createTenantClient(institutionId);

  const guardian = await findPersonByHandle(db, guardianHandle);
  if (!guardian) {
    throw new APIError(
      'No hay ninguna persona con ese documento o correo en la institución',
      'NOT_FOUND'
    );
  }
  if (guardian.id === studentId) {
    throw new APIError('Una persona no puede ser su propio acudiente', 'VALIDATION_ERROR');
  }

  try {
    return await db.$transaction(async (tx) => {
      const student = await tx.person.findFirst({
        where: { id: studentId },
        select: { id: true },
      });
      if (!student) {
        throw new APIError('Person not found', 'NOT_FOUND');
      }

      await tx.guardianship.create({
        data: {
          institutionId,
          studentId,
          guardianId: guardian.id,
          relationship,
          isFinancialResponsible,
        },
      });

      const hasRole = await tx.membership.findFirst({
        where: { personId: guardian.id, role: 'GUARDIAN', revokedAt: null },
        select: { id: true },
      });
      if (!hasRole) {
        await tx.membership.create({
          data: { institutionId, personId: guardian.id, role: 'GUARDIAN' },
        });
        await tx.auditLog.create({
          data: {
            institutionId,
            actorId,
            entity: 'membership',
            entityId: guardian.id,
            action: 'granted',
            after: { role: 'GUARDIAN', reason: 'guardianship' },
          },
        });
      }

      await tx.auditLog.create({
        data: {
          institutionId,
          actorId,
          entity: 'guardianship',
          entityId: studentId,
          action: 'linked',
          after: { guardianId: guardian.id, relationship, isFinancialResponsible },
        },
      });

      return { guardianId: guardian.id };
    });
  } catch (err) {
    if (isUniqueViolation(err)) {
      throw new APIError('Esa persona ya es acudiente de esta persona', 'CONFLICT');
    }
    throw err;
  }
}

export async function unlinkGuardian({
  institutionId,
  actorId,
  studentId,
  guardianId,
}: {
  institutionId: string;
  actorId: string | null;
  studentId: string;
  guardianId: string;
}): Promise<{ unlinked: boolean }> {
  const db = createTenantClient(institutionId);

  return db.$transaction(async (tx) => {
    const existing = await tx.guardianship.findFirst({
      where: { studentId, guardianId, institutionId },
      select: { id: true },
    });
    if (!existing) {
      return { unlinked: false };
    }

    // A consent signed by this guardian stays valid: it happened, and the audit trail keeps
    // the link. What goes away is the guardian's standing to sign the next one.
    await tx.guardianship.delete({ where: { id: existing.id } });
    await tx.auditLog.create({
      data: {
        institutionId,
        actorId,
        entity: 'guardianship',
        entityId: studentId,
        action: 'unlinked',
        before: { guardianId },
      },
    });

    return { unlinked: true };
  });
}

/**
 * Records a consent that was given off-platform (on paper, or by email).
 *
 * The rule from the contract (endpoints.md:75): for a minor, whoever signs must be one of
 * their guardians. That is the whole point of the guardianship record.
 */
export async function recordConsent({
  institutionId,
  actorId,
  subjectId,
  channel,
  signedByHandle,
  now = new Date(),
}: {
  institutionId: string;
  actorId: string | null;
  subjectId: string;
  channel: ConsentChannel;
  signedByHandle: string | null;
  now?: Date;
}): Promise<{ consentId: string }> {
  const db = createTenantClient(institutionId);

  const subject = await db.person.findFirst({
    where: { id: subjectId },
    select: { id: true, birthDate: true },
  });
  if (!subject) {
    throw new APIError('Person not found', 'NOT_FOUND');
  }

  const isMinor = subject.birthDate ? calculateAgeAt(subject.birthDate, now) < 18 : false;

  let signerId = subjectId;
  if (signedByHandle) {
    const signer = await findPersonByHandle(db, signedByHandle);
    if (!signer) {
      throw new APIError(
        'No hay ninguna persona con ese documento o correo en la institución',
        'NOT_FOUND'
      );
    }
    signerId = signer.id;
  }

  if (isMinor) {
    if (signerId === subjectId) {
      throw new APIError(
        'Es menor de edad: el consentimiento lo firma su acudiente',
        'VALIDATION_ERROR'
      );
    }
    const guardianship = await db.guardianship.findFirst({
      where: { studentId: subjectId, guardianId: signerId, institutionId },
      select: { id: true },
    });
    if (!guardianship) {
      throw new APIError(
        'Quien firma no está registrado como acudiente de esta persona',
        'VALIDATION_ERROR'
      );
    }
  }

  const institution = await db.institution.findUniqueOrThrow({
    where: { id: institutionId },
    select: { dataPolicyVersion: true },
  });

  return db.$transaction(async (tx) => {
    const consent = await tx.consent.create({
      data: {
        institutionId,
        subjectId,
        signedById: signerId,
        policyVersion: institution.dataPolicyVersion,
        channel,
      },
      select: { id: true },
    });

    await tx.auditLog.create({
      data: {
        institutionId,
        actorId,
        entity: 'consent',
        entityId: consent.id,
        action: 'recorded',
        after: {
          subjectId,
          signedById: signerId,
          channel,
          policyVersion: institution.dataPolicyVersion,
        },
      },
    });

    return { consentId: consent.id };
  });
}
