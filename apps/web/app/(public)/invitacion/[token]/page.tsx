/**
 * Invitation page.
 * SSOT: plan/03-identidad-y-acceso.md §9c
 *
 * Server component that validates token and renders appropriate UI.
 * Calls lib function directly (correction 9).
 */

import { validateInvitationToken } from '@/lib/invitations/validate-token';
import InvitationContent from './invitation-content';
import InvitationError from './invitation-error';

interface Props {
  params: Promise<{ token: string }>;
}

export default async function InvitationPage({ params }: Props) {
  const { token } = await params;
  const result = await validateInvitationToken(token);

  if (result.status !== 'valid') {
    return <InvitationError status={result.status} token={token} />;
  }

  return (
    <InvitationContent
      token={token}
      givenName={result.givenName}
      isMinor={result.isMinor}
      institutionName={result.institutionName}
      dataPolicyUrl={result.dataPolicyUrl}
    />
  );
}
