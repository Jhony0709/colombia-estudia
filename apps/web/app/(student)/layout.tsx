/**
 * Área del estudiante.
 * SSOT: reference/01-routing/routes.md:27-38, plan/01:40-46.
 *
 * Barra superior propia (`StudentTopNav`, 21/9), a la manera de Coursera: los destinos de
 * estudio como pestañas, y «Mi historial» y «Cerrar sesión» detrás de la persona. El 20/9 el
 * estudiante compartía la barra lateral del staff; se volvió a la barra arriba porque la
 * ruta del player (`RouteRail`) necesita la columna izquierda y porque quien estudia suele
 * hacerlo desde un celular. El `<main>` lo pone esta área (el enlace "saltar al contenido"
 * tiene que llevar al contenido, no al menú).
 *
 * La guardia es `requireStudentSession` (quién es) y no una capacidad: con el acceso
 * vencido se pierde `lesson.read` pero los resultados siguen siendo suyos, y un estudiante
 * sin matrícula no tiene capacidad ninguna y aun así `/aprender` tiene un mensaje para él.
 * Con `requireCapability('lesson.read')` esos dos casos daban un bucle de redirecciones
 * entre `/ingresar` y `/aprender` (arreglado el 19/9).
 */

import { cookies } from 'next/headers';
import { requireStudentSession } from '@/lib/authz/student';
import { StudentTopNav } from '@/components/organisms/student-top-nav';
import { ConnectivityBanner } from '@/components/organisms/connectivity-banner';
import { THEME_COOKIE, toTheme } from '@/lib/theme/theme';
import { buildStudentNav } from '@/lib/nav/student-nav';
import { buildSpaces } from '@/lib/nav/spaces';
import { countUnread } from '@/features/notifications/server/notifications.service';

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireStudentSession();
  const unread = ctx.person
    ? await countUnread({ institutionId: ctx.institution.id, personId: ctx.person.id })
    : 0;
  const theme = toTheme((await cookies()).get(THEME_COOKIE)?.value);

  return (
    <div className="min-h-screen">
      <StudentTopNav
        theme={theme}
        institutionName={ctx.institution.name}
        items={buildStudentNav(ctx.capabilities)}
        spaces={buildSpaces(ctx.capabilities)}
        personName={ctx.person ? `${ctx.person.givenName} ${ctx.person.familyName}` : null}
        unreadNotifications={unread}
      />
      <ConnectivityBanner />
      <main id="contenido" className="min-w-0">
        {children}
      </main>
    </div>
  );
}
