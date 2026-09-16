/**
 * Admin area layout: (admin)/admin/* (plan/01:47). Same guard as (staff); the pages under it
 * add requireCapability('institution.manage') or the capability of each screen (routes.md:56-60).
 * SSOT: plan/03-identidad-y-acceso.md "MFA para staff"
 */

import { requireStaffSession } from '@/lib/authz/staff';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireStaffSession();
  return <>{children}</>;
}
