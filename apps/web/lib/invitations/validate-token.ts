/**
 * Invitation token validation.
 * SSOT: plan/03-identidad-y-acceso.md §9c
 *
 * Shared between GET /api/invitations/[token] and the page server component.
 */

import 'server-only';

import { calculateAgeAt } from '@colombia-estudia/domain';

import { hashToken } from '@/lib/auth/invitation-token';
import { prisma } from '@/lib/db/tenant';

/**
 * Invitation status codes for the UI.
 */
export type InvitationStatus = 'valid' | 'not_found' | 'expired' | 'used' | 'already_registered';

/**
 * Data returned for a valid invitation.
 * Minimal set: no email, no familyName, no expiresAt (correction 3).
 */
interface ValidInvitationData {
  status: 'valid';
  givenName: string;
  isMinor: boolean;
  institutionName: string;
  dataPolicyUrl: string | null;
  /** Internal: needed for accept flow */
  invitationId: string;
  institutionId: string;
  personId: string;
  dataPolicyVersion: string;
}

interface InvalidInvitationData {
  status: 'not_found' | 'expired' | 'used' | 'already_registered';
}

type InvitationValidationResult = ValidInvitationData | InvalidInvitationData;

/**
 * Determine if a person is a minor.
 *
 * Rule (correction 1):
 * - menor = alguna matrícula con isMinorAtEnrollment
 * - sin matrículas → edad por birthDate si existe
 * - sin birthDate → adulto
 */
function isPersonMinor(
  enrollments: Array<{ isMinorAtEnrollment: boolean }>,
  birthDate: Date | null,
  at: Date
): boolean {
  // Check enrollments first
  if (enrollments.length > 0) {
    return enrollments.some((e) => e.isMinorAtEnrollment);
  }

  // No enrollments: check birthDate
  if (birthDate) {
    return calculateAgeAt(birthDate, at) < 18;
  }

  // No birthDate: treat as adult
  return false;
}

/**
 * Validate an invitation token.
 *
 * @param token - The raw token from the URL
 * @returns Invitation data or error status
 */
export async function validateInvitationToken(token: string): Promise<InvitationValidationResult> {
  const hash = hashToken(token);

  // Find invitation by hash (cross-tenant, token is globally unique)
  const invitation = await prisma.invitation.findFirst({
    where: { tokenHash: hash },
    include: {
      person: {
        select: {
          id: true,
          givenName: true,
          birthDate: true,
          authUserId: true,
          enrollments: {
            select: { isMinorAtEnrollment: true },
          },
        },
      },
      institution: {
        select: {
          id: true,
          name: true,
          dataPolicyUrl: true,
          dataPolicyVersion: true,
        },
      },
    },
  });

  if (!invitation) {
    return { status: 'not_found' };
  }

  if (invitation.acceptedAt) {
    return { status: 'used' };
  }

  if (invitation.expiresAt < new Date()) {
    return { status: 'expired' };
  }

  if (invitation.person.authUserId) {
    return { status: 'already_registered' };
  }

  const isMinor = isPersonMinor(
    invitation.person.enrollments,
    invitation.person.birthDate,
    new Date()
  );

  return {
    status: 'valid',
    givenName: invitation.person.givenName,
    isMinor,
    institutionName: invitation.institution.name,
    dataPolicyUrl: invitation.institution.dataPolicyUrl,
    // Internal fields for accept flow
    invitationId: invitation.id,
    institutionId: invitation.institution.id,
    personId: invitation.person.id,
    dataPolicyVersion: invitation.institution.dataPolicyVersion,
  };
}
