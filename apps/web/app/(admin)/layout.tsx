/**
 * Admin area layout: (admin) route group.
 * Same chrome as the staff area — it is the same person doing the same shift — with the same
 * staff guard on top.
 * SSOT: plan/03-identidad-y-acceso.md, plan/01:40-46
 */

import { StaffShell } from '../(staff)/_shell/staff-shell';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <StaffShell>{children}</StaffShell>;
}
