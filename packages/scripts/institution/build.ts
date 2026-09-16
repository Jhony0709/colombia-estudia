/**
 * Pure function to build demo institution data.
 * SSOT: plan/02-fundaciones.md §10
 *
 * This module has NO runtime dependencies (no Prisma, no Supabase).
 * It builds the data structures used by create.ts.
 */

/** Slug must match apps/web/lib/authz/tenant.ts:9 */
export const TENANT_SLUG = 'colombia-estudia';

export interface CreateInstitutionArgs {
  domain: string;
  adminEmail: string;
  adminName: string;
  supportEmail: string;
}

export interface InstitutionData {
  slug: string;
  name: string;
  primaryDomain: string;
  supportEmail: string;
  emailFromName: string;
  dataPolicyVersion: string;
}

export interface PersonData {
  givenName: string;
  familyName: string;
  email: string;
}

export interface ProgramData {
  code: string;
  name: string;
}

export interface DemoInstitutionData {
  institution: InstitutionData;
  admin: PersonData;
  program: ProgramData;
  auditAction: 'created';
  auditEntity: 'institution';
}

/**
 * Parse a name like "Jhonny Admin" into given and family names.
 * If only one word, uses it as givenName with empty familyName.
 */
export function parseName(fullName: string): { givenName: string; familyName: string } {
  const trimmed = fullName.trim();
  const parts = trimmed.split(/\s+/).filter(Boolean);

  if (parts.length === 0) {
    return { givenName: '', familyName: '' };
  }

  if (parts.length === 1) {
    return { givenName: parts[0] as string, familyName: '' };
  }

  // First part is given name, rest is family name
  const [givenName, ...rest] = parts as [string, ...string[]];
  return { givenName, familyName: rest.join(' ') };
}

/**
 * Validate password meets minimum requirements.
 * @returns Error message if invalid, undefined if valid.
 */
export function validatePassword(password: string | undefined): string | undefined {
  if (!password) {
    return 'ADMIN_PASSWORD is required';
  }
  if (password.length < 12) {
    return 'ADMIN_PASSWORD must be at least 12 characters';
  }
  return undefined;
}

/**
 * Build the data structures for creating a demo institution.
 * Pure function: no side effects, no database access.
 */
export function buildDemoInstitution(args: CreateInstitutionArgs): DemoInstitutionData {
  const { givenName, familyName } = parseName(args.adminName);

  return {
    institution: {
      slug: TENANT_SLUG,
      name: 'Colombia Estudia (demo)',
      primaryDomain: args.domain,
      supportEmail: args.supportEmail,
      emailFromName: 'Colombia Estudia (demo)',
      dataPolicyVersion: '1',
    },
    admin: {
      givenName,
      familyName,
      email: args.adminEmail,
    },
    program: {
      code: 'DEMO',
      name: 'Programa demo',
    },
    auditAction: 'created',
    auditEntity: 'institution',
  };
}
