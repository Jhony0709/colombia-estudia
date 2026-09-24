/**
 * Área del acudiente (Fase C, 23/9).
 * SSOT: reference/01-routing/routes.md (`/familia`), docs/plan-redefinicion-2009.md Fase C.
 *
 * La misma barra superior que el estudiante (`StudentTopNav`): el acudiente suele entrar
 * desde el celular y no opera nada, así que la barra lateral del staff le sobra. Los
 * destinos son dos: «Mi familia» y, si además estudia, su propio «Mis programas».
 */

import { cookies } from 'next/headers';
import { requireGuardianSession } from '@/lib/authz/guardian';
import { StudentTopNav } from '@/components/organisms/student-top-nav';
import { ConnectivityBanner } from '@/components/organisms/connectivity-banner';
import { THEME_COOKIE, toTheme } from '@/lib/theme/theme';
import { buildFamilyNav } from '@/lib/nav/family-nav';
import { countUnread } from '@/features/notifications/server/notifications.service';
import { buildSpaces } from '@/lib/nav/spaces';

export default async function FamilyLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireGuardianSession();
  const unread = ctx.person
    ? await countUnread({ institutionId: ctx.institution.id, personId: ctx.person.id })
    : 0;
  const theme = toTheme((await cookies()).get(THEME_COOKIE)?.value);

  return (
    <div className="min-h-screen">
      <StudentTopNav
        theme={theme}
        institutionName={ctx.institution.name}
        items={buildFamilyNav(ctx.capabilities)}
        spaces={buildSpaces(ctx.capabilities)}
        personName={ctx.person ? `${ctx.person.givenName} ${ctx.person.familyName}` : null}
        unreadNotifications={unread}
        homeHref="/familia"
        notificationsHref="/familia/notificaciones"
      />
      <ConnectivityBanner />
      <main id="contenido" className="min-w-0">
        {children}
      </main>
    </div>
  );
}
