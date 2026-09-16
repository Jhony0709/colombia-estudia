/**
 * Invitation layout.
 * SSOT: plan/03-identidad-y-acceso.md §9c
 *
 * Centered container for invitation pages. No navigation.
 */

export default function InvitationLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-surface-canvas flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">{children}</div>
    </div>
  );
}
