/**
 * Staff area layout: (staff) route group (contenido, cohortes, personas, aliados, cartera,
 * inclusion). Guard in lib/authz/staff.ts; per-area capability guards go in sub-layouts.
 * SSOT: plan/03-identidad-y-acceso.md "MFA para staff", plan/01:40-46
 */

import { requireStaffSession } from '@/lib/authz/staff';

export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  await requireStaffSession();
  return <>{children}</>;
}
