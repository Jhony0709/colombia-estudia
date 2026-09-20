/**
 * Área del estudiante.
 * SSOT: reference/01-routing/routes.md:27-38, plan/01:40-46.
 *
 * La misma barra lateral que el staff (`SideNav`, 20/9), con los destinos del estudiante
 * agrupados en «Estudiar» y «Mi historial», la marca hacia `/aprender` y las notificaciones
 * en `/aprender/notificaciones`. La cabecera horizontal del 19/9 (`StudentHeader`) se retiró:
 * dos navegaciones distintas para la misma plataforma eran dos cosas que aprender.
 * El `<main>` lo pone esta área (el enlace "saltar al contenido" tiene que llevar al
 * contenido, no al menú).
 *
 * La guardia es `requireStudentSession` (quién es) y no una capacidad: con el acceso
 * vencido se pierde `lesson.read` pero los resultados siguen siendo suyos, y un estudiante
 * sin matrícula no tiene capacidad ninguna y aun así `/aprender` tiene un mensaje para él.
 * Con `requireCapability('lesson.read')` esos dos casos daban un bucle de redirecciones
 * entre `/ingresar` y `/aprender` (arreglado el 19/9).
 */

import { cookies } from 'next/headers';
import { requireStudentSession } from '@/lib/authz/student';
import { SideNav } from '@/components/organisms/side-nav';
import { THEME_COOKIE, toTheme } from '@/lib/theme/theme';
import { buildStudentNav, STUDENT_SECTIONS } from '@/lib/nav/student-nav';
import { countUnread } from '@/features/notifications/server/notifications.service';

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireStudentSession();
  const unread = ctx.person
    ? await countUnread({ institutionId: ctx.institution.id, personId: ctx.person.id })
    : 0;
  const theme = toTheme((await cookies()).get(THEME_COOKIE)?.value);

  return (
    <div className="lg:flex">
      <SideNav
        theme={theme}
        institutionName={ctx.institution.name}
        items={buildStudentNav(ctx.capabilities)}
        sections={STUDENT_SECTIONS}
        homeHref="/aprender"
        notificationsHref="/aprender/notificaciones"
        personName={ctx.person ? `${ctx.person.givenName} ${ctx.person.familyName}` : null}
        unreadNotifications={unread}
      />
      <main id="contenido" className="min-w-0 flex-1">
        {children}
      </main>
    </div>
  );
}
