/**
 * Admin area layout: (admin) route group.
 * Same chrome as the staff area — it is the same person doing the same shift — with the same
 * staff guard on top.
 * SSOT: plan/03-identidad-y-acceso.md, plan/01:40-46
 */

import { requireStaffSession } from '@/lib/authz/staff';
import { getRequestContext } from '@/lib/authz/request-context';
import { cookies } from 'next/headers';
import { SideNav } from '@/components/organisms/side-nav';
import { THEME_COOKIE, toTheme } from '@/lib/theme/theme';
import { buildStaffNav } from '@/lib/nav/staff-nav';
import { countUnread } from '@/features/notifications/server/notifications.service';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireStaffSession();
  const ctx = await getRequestContext();
  const unread = ctx.person
    ? await countUnread({ institutionId: ctx.institution.id, personId: ctx.person.id })
    : 0;

  // El layout raíz ya puso la clase en `<html>`; esto es solo para que el conmutador de la
  // barra lateral arranque marcando la opción correcta en vez de adivinarla al hidratar.
  const theme = toTheme((await cookies()).get(THEME_COOKIE)?.value);

  return (
    <div className="lg:flex">
      <SideNav
        theme={theme}
        institutionName={ctx.institution.name}
        items={buildStaffNav(ctx.capabilities)}
        personName={ctx.person ? `${ctx.person.givenName} ${ctx.person.familyName}` : null}
        unreadNotifications={unread}
      />
      {/* `min-w-0` para que una tabla ancha no empuje la columna: sin él, el contenido
          estira el flex y la navegación se sale de la pantalla. */}
      <main id="contenido" className="min-w-0 flex-1">
        {children}
      </main>
    </div>
  );
}
