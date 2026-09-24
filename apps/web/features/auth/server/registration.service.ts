/**
 * El registro público (Fase B, 23/9): una persona se da de alta sola y, si la institución
 * tiene cohorte de introducción, entra a estudiar en el acto.
 * SSOT: docs/plan-redefinicion-2009.md Fase B.1, reference/02-api/endpoints.md (Auth).
 *
 * Lo que crea, en este orden: el usuario de Auth (Supabase), la `Person`, la membresía
 * `STUDENT`, el consentimiento (solo mayores de edad) y la matrícula en la cohorte de
 * introducción (`Institution.settings.introCohortId`). La matrícula pasa por `enrollPerson`,
 * **la misma función que usa operación**: menor sin acudiente, cohorte que no admite, acceso
 * hasta cuándo… se deciden ahí y no en dos sitios.
 *
 * Un menor de edad no firma la política (Ley 1581: firma el acudiente) y no se matricula
 * solo (`enrollPerson` exige acudiente): se le crea la cuenta y se le dice que operación
 * completará el resto. Es la misma regla que la invitación (`acceptInvitation`).
 *
 * El correo **no** se verifica antes de crear la cuenta (`email_confirm: true`), igual que
 * en la invitación —allí el enlace lo prueba; aquí no hay prueba—. Es una decisión abierta
 * (PRODUCT_DECISIONS.md 2026-09-23, Fase B): el daño posible es ocupar un correo ajeno, y
 * quien lo posee lo recupera por «Olvidé mi contraseña».
 */

import 'server-only';

import { calculateAgeAt } from '@colombia-estudia/domain';
import { APIError } from '@/lib/core/errors';
import { createTenantClient } from '@/lib/db/tenant';
import { getSupabaseAdmin } from '@/lib/auth/supabase-server';
import { parseInstitutionSettings } from '@/lib/institution/settings';
import { enrollPerson } from '@/features/cohorts/server/enrollments.service';

export interface RegistrationInput {
  institutionId: string;
  givenName: string;
  familyName: string;
  email: string;
  phone: string | null;
  /** ISO `YYYY-MM-DD`. Obligatoria: sin ella no hay matrícula (schema.prisma, `Person.birthDate`). */
  birthDate: string;
  password: string;
  acceptsDataPolicy: boolean;
  now?: Date;
}

export interface RegistrationResult {
  email: string;
  personId: string;
  isMinor: boolean;
  /** La cohorte en la que quedó matriculada, o por qué no. */
  enrollment:
    | { status: 'ENROLLED'; cohortCode: string; cohortName: string }
    | { status: 'NO_INTRO_COHORT' }
    | { status: 'MINOR_NEEDS_GUARDIAN' }
    | { status: 'FAILED'; reason: string };
}

export async function registerPerson(input: RegistrationInput): Promise<RegistrationResult> {
  const { institutionId, password } = input;
  const now = input.now ?? new Date();
  const email = input.email.trim().toLowerCase();
  const birthDate = new Date(`${input.birthDate}T00:00:00.000Z`);
  if (Number.isNaN(birthDate.getTime()) || birthDate > now) {
    throw new APIError('La fecha de nacimiento no es válida', 'VALIDATION_ERROR');
  }
  const isMinor = calculateAgeAt(birthDate, now) < 18;
  if (!isMinor && !input.acceptsDataPolicy) {
    throw new APIError('Debes aceptar la política de tratamiento de datos', 'CONSENT_REQUIRED');
  }

  const db = createTenantClient(institutionId);

  // Un correo que ya está en la institución no se registra otra vez: si tiene cuenta, que
  // entre; si operación le creó la ficha sin cuenta, el camino es la invitación (que sí
  // prueba el correo). Registrarse «encima» sería tomar una ficha ajena sabiendo un correo.
  const existing = await db.person.findFirst({
    where: { email, anonymizedAt: null },
    select: { id: true, authUserId: true },
  });
  if (existing) {
    throw new APIError(
      existing.authUserId
        ? 'Ya hay una cuenta con este correo: inicia sesión o recupera tu contraseña.'
        : 'Este correo ya está registrado en la institución. Pide tu enlace de invitación al equipo.',
      'CONFLICT'
    );
  }

  const institution = await db.institution.findUniqueOrThrow({
    where: { id: institutionId },
    select: { settings: true, dataPolicyVersion: true },
  });
  const { introCohortId = null } = parseInstitutionSettings(institution.settings);

  const admin = getSupabaseAdmin();
  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (authError || !authData.user) {
    if (authError?.code === 'email_exists') {
      throw new APIError(
        'Ya hay una cuenta con este correo: inicia sesión o recupera tu contraseña.',
        'CONFLICT'
      );
    }
    if (authError?.code === 'weak_password') {
      throw new APIError(
        'Esa contraseña es demasiado débil o apareció en filtraciones de datos; elige otra',
        'VALIDATION_ERROR'
      );
    }
    throw new APIError('Failed to create account', 'INTERNAL');
  }
  const authUserId = authData.user.id;

  let personId: string;
  try {
    personId = await db.$transaction(async (tx) => {
      const person = await tx.person.create({
        data: {
          institutionId,
          givenName: input.givenName.trim(),
          familyName: input.familyName.trim(),
          email,
          phone: input.phone,
          birthDate,
          authUserId,
        },
        select: { id: true },
      });
      await tx.membership.create({
        data: { institutionId, personId: person.id, role: 'STUDENT' },
      });
      if (!isMinor) {
        await tx.consent.create({
          data: {
            institutionId,
            subjectId: person.id,
            signedById: person.id,
            policyVersion: institution.dataPolicyVersion,
            channel: 'PLATFORM',
          },
        });
      }
      await tx.auditLog.create({
        data: {
          institutionId,
          actorId: person.id,
          entity: 'person',
          entityId: person.id,
          action: 'registered',
          after: { isMinor, introCohortId, consent: !isMinor },
        },
      });
      return person.id;
    });
  } catch {
    await admin.auth.admin.deleteUser(authUserId);
    throw new APIError('Failed to complete registration', 'INTERNAL');
  }

  return {
    email,
    personId,
    isMinor,
    enrollment: await enrollInIntroCohort({
      institutionId,
      personId,
      email,
      isMinor,
      introCohortId,
      now,
    }),
  };
}

/**
 * La matrícula, fuera de la transacción de la cuenta: si falla, la cuenta existe igual y la
 * pantalla dice que operación matriculará. Una cuenta sin matrícula se arregla en un clic;
 * una persona sin cuenta porque la cohorte estaba cerrada, no.
 */
async function enrollInIntroCohort({
  institutionId,
  personId,
  email,
  isMinor,
  introCohortId,
  now,
}: {
  institutionId: string;
  personId: string;
  email: string;
  isMinor: boolean;
  introCohortId: string | null;
  now: Date;
}): Promise<RegistrationResult['enrollment']> {
  if (introCohortId === null) return { status: 'NO_INTRO_COHORT' };
  if (isMinor) return { status: 'MINOR_NEEDS_GUARDIAN' };

  const db = createTenantClient(institutionId);
  try {
    await enrollPerson({
      institutionId,
      actorId: personId,
      cohortId: introCohortId,
      personHandle: email,
      now,
    });
    const cohort = await db.cohort.findFirstOrThrow({
      where: { id: introCohortId },
      select: { code: true, name: true },
    });
    return { status: 'ENROLLED', cohortCode: cohort.code, cohortName: cohort.name };
  } catch (err) {
    const reason = err instanceof APIError ? err.message : 'unknown';
    // Se audita para que operación vea que alguien se quedó sin matrícula y por qué.
    await db.auditLog.create({
      data: {
        institutionId,
        actorId: personId,
        entity: 'person',
        entityId: personId,
        action: 'registration_enrollment_failed',
        after: { introCohortId, reason },
      },
    });
    return { status: 'FAILED', reason };
  }
}
