/**
 * Public area layout: auth screens and invitation.
 * SSOT: plan/01:40-46.
 *
 * Owns its own `<main id="contenido">`: the skip link points here, and there is no chrome to
 * skip past on these screens.
 */

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return <main id="contenido">{children}</main>;
}
