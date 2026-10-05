/**
 * Staff area layout: (staff) route group (cohortes, personas, aliados, cartera, inclusión).
 * Guard in lib/authz/staff.ts; per-area capability guards go in sub-layouts.
 * SSOT: plan/03-identidad-y-acceso.md "MFA para staff", plan/01:40-46
 */

import { StaffShell } from './_shell/staff-shell';

export default function StaffLayout({ children }: { children: React.ReactNode }) {
  return <StaffShell>{children}</StaffShell>;
}
