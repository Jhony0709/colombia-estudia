/**
 * Institution service: overview and settings for /admin/institucion.
 * SSOT: plan/01:113-115 (route handlers go through features/server, never lib/db directly),
 *       plan/06-cohortes-y-personas.md:11-18 (§1 Institución).
 */

import 'server-only';

import { createTenantClient } from '@/lib/db/tenant';

/**
 * Editable institution settings. Mirrors the form on /admin/institucion.
 * `slug` and `primaryDomain` are deliberately absent: tenant identity is not
 * self-service (plan/03, tenant fijo hasta tener el producto completo).
 */
export interface InstitutionSettings {
  id: string;
  name: string;
  legalName: string | null;
  taxId: string | null;
  brandColor: string | null;
  supportEmail: string;
  supportPhone: string | null;
  emailFromName: string;
  dataPolicyUrl: string | null;
  dataPolicyVersion: string;
}

/** The editable subset, as it travels from the form. */
export type UpdateInstitutionData = Omit<InstitutionSettings, 'id'>;

const SETTINGS_SELECT = {
  id: true,
  name: true,
  legalName: true,
  taxId: true,
  brandColor: true,
  supportEmail: true,
  supportPhone: true,
  emailFromName: true,
  dataPolicyUrl: true,
  dataPolicyVersion: true,
} as const;

/**
 * Overview data for the institution admin page.
 */
interface InstitutionOverview {
  settings: InstitutionSettings;
  primaryDomain: string | null;
}

/**
 * Get institution settings plus the read-only context the page shows around them.
 * The curriculum (programs, modules, subjects) comes from `curriculum.service`.
 */
export async function getInstitutionOverview(institutionId: string): Promise<InstitutionOverview> {
  const db = createTenantClient(institutionId);

  const institution = await db.institution.findUniqueOrThrow({
    where: { id: institutionId },
    select: { ...SETTINGS_SELECT, primaryDomain: true },
  });

  const { primaryDomain, ...settings } = institution;

  return { settings, primaryDomain };
}

/**
 * Fields that actually changed, comparing the incoming data with what is stored.
 * Exported for the unit test: the audit row must carry the diff, not the whole row.
 */
export function diffSettings(
  before: UpdateInstitutionData,
  after: UpdateInstitutionData
): Array<keyof UpdateInstitutionData> {
  return (Object.keys(after) as Array<keyof UpdateInstitutionData>).filter(
    (key) => before[key] !== after[key]
  );
}

/**
 * Update the institution and record the change.
 *
 * Writes one `AuditLog institution.updated` row carrying only the fields that changed,
 * `before` and `after`. A no-op update writes nothing: an audit trail full of empty
 * entries is an audit trail nobody reads.
 */
export async function updateInstitution({
  institutionId,
  actorId,
  data,
}: {
  institutionId: string;
  actorId: string | null;
  data: UpdateInstitutionData;
}): Promise<{ settings: InstitutionSettings; changed: Array<keyof UpdateInstitutionData> }> {
  const db = createTenantClient(institutionId);

  return db.$transaction(async (tx) => {
    const current = await tx.institution.findUniqueOrThrow({
      where: { id: institutionId },
      select: SETTINGS_SELECT,
    });

    // `current` lleva ademas el `id`, que no es un ajuste. No estorba: `diffSettings`
    // recorre las claves de `data` —el parche entrante—, nunca las del estado previo.
    const changed = diffSettings(current, data);

    if (changed.length === 0) {
      return { settings: current, changed };
    }

    const updated = await tx.institution.update({
      where: { id: institutionId },
      data,
      select: SETTINGS_SELECT,
    });

    await tx.auditLog.create({
      data: {
        institutionId,
        actorId,
        entity: 'institution',
        entityId: institutionId,
        action: 'updated',
        before: Object.fromEntries(changed.map((key) => [key, current[key]])),
        after: Object.fromEntries(changed.map((key) => [key, data[key]])),
      },
    });

    return { settings: updated, changed };
  });
}
