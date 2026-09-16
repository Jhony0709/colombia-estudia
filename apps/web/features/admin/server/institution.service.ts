/**
 * Institution service: read-only overview for /admin/institucion.
 * SSOT: plan/01:113-115 (route handlers go through features/server, never lib/db directly).
 */

import 'server-only';

import { createTenantClient } from '@/lib/db/tenant';

/**
 * Overview data for the institution admin page.
 */
interface InstitutionOverview {
  id: string;
  name: string;
  primaryDomain: string | null;
  supportEmail: string;
  supportPhone: string | null;
  dataPolicyUrl: string | null;
  dataPolicyVersion: string;
  programs: Array<{
    id: string;
    code: string;
    name: string;
  }>;
}

/**
 * Get institution overview for the admin page.
 * Returns institution data with programs ordered by code.
 */
export async function getInstitutionOverview(institutionId: string): Promise<InstitutionOverview> {
  const db = createTenantClient(institutionId);

  const institution = await db.institution.findUniqueOrThrow({
    where: { id: institutionId },
    select: {
      id: true,
      name: true,
      primaryDomain: true,
      supportEmail: true,
      supportPhone: true,
      dataPolicyUrl: true,
      dataPolicyVersion: true,
    },
  });

  const programs = await db.program.findMany({
    select: { id: true, code: true, name: true },
    orderBy: { code: 'asc' },
  });

  return {
    ...institution,
    programs,
  };
}
