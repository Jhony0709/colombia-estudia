/**
 * El registro público, visto desde la institución (Fase B, 23/9): en qué cohorte entra
 * quien se registra.
 * SSOT: docs/plan-redefinicion-2009.md Fase B.1 («`Institution.settings.introCohortId`,
 * elegida en `/admin/institucion` entre las cohortes abiertas»).
 */

import 'server-only';

import { createTenantClient } from '@/lib/db/tenant';
import { APIError } from '@/lib/core/errors';
import { parseInstitutionSettings } from '@/lib/institution/settings';
import type { JsonObject } from '@/lib/db/prisma';

export interface RegistrationCohortOption {
  id: string;
  code: string;
  name: string;
  status: string;
  programName: string;
}

export interface RegistrationSettings {
  introCohortId: string | null;
  /** La elegida, si sigue existiendo; nula si la borraron o la archivaron. */
  introCohort: RegistrationCohortOption | null;
  /** Entre qué se puede elegir: cohortes planeadas o abiertas. */
  candidates: RegistrationCohortOption[];
}

const COHORT_SELECT = {
  id: true,
  code: true,
  name: true,
  status: true,
  program: { select: { name: true } },
} as const;

const toOption = (c: {
  id: string;
  code: string;
  name: string;
  status: string;
  program: { name: string };
}): RegistrationCohortOption => ({
  id: c.id,
  code: c.code,
  name: c.name,
  status: c.status,
  programName: c.program.name,
});

export async function getRegistrationSettings(
  institutionId: string
): Promise<RegistrationSettings> {
  const db = createTenantClient(institutionId);

  const [institution, cohorts] = await Promise.all([
    db.institution.findUniqueOrThrow({ where: { id: institutionId }, select: { settings: true } }),
    db.cohort.findMany({
      where: { status: { in: ['PLANNED', 'OPEN'] } },
      orderBy: [{ status: 'asc' }, { startsOn: 'desc' }],
      select: COHORT_SELECT,
    }),
  ]);

  const { introCohortId = null } = parseInstitutionSettings(institution.settings);
  const candidates = cohorts.map(toOption);
  const introCohort = candidates.find((c) => c.id === introCohortId) ?? null;

  return { introCohortId, introCohort, candidates };
}

/**
 * Cambia la cohorte de introducción. Solo una planeada o abierta: una cerrada no deja
 * entrar a nadie, y registrarse para no poder estudiar es peor que no registrarse.
 */
export async function updateRegistrationSettings({
  institutionId,
  actorId,
  introCohortId,
}: {
  institutionId: string;
  actorId: string | null;
  introCohortId: string | null;
}): Promise<{ introCohortId: string | null }> {
  const db = createTenantClient(institutionId);

  if (introCohortId !== null) {
    const cohort = await db.cohort.findFirst({
      where: { id: introCohortId, status: { in: ['PLANNED', 'OPEN'] } },
      select: { id: true },
    });
    if (!cohort) {
      throw new APIError('La cohorte no existe o ya no admite matrículas', 'VALIDATION_ERROR');
    }
  }

  await db.$transaction(async (tx) => {
    const current = await tx.institution.findUniqueOrThrow({
      where: { id: institutionId },
      select: { settings: true },
    });
    const settings = parseInstitutionSettings(current.settings);
    const before = settings.introCohortId ?? null;
    if (before === introCohortId) return;

    await tx.institution.update({
      where: { id: institutionId },
      data: { settings: { ...settings, introCohortId } as JsonObject },
    });
    await tx.auditLog.create({
      data: {
        institutionId,
        actorId,
        entity: 'institution',
        entityId: institutionId,
        action: 'registration_updated',
        before: { introCohortId: before },
        after: { introCohortId },
      },
    });
  });

  return { introCohortId };
}
