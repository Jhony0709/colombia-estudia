/**
 * El marco del personal: barra lateral con el conmutador de espacios, avisos y tema. Lo usan
 * los grupos `(staff)` y `(admin)` (4/10): eran dos copias y la de admin había perdido el
 * conmutador, así que Institución y Políticas no decían en qué espacio estaba uno.
 */

import { cookies } from 'next/headers';
import { requireStaffSession } from '@/lib/authz/staff';
import { getRequestContext } from '@/lib/authz/request-context';
import { SideNav } from '@/components/organisms/side-nav';
import { THEME_COOKIE, toTheme } from '@/lib/theme/theme';
import { buildStaffNav } from '@/lib/nav/staff-nav';
import { buildSpaces } from '@/lib/nav/spaces';
import { countUnread } from '@/features/notifications/server/notifications.service';
import { countWaitingConversations } from '@/features/messaging/server/conversations.service';
import { logger } from '@/lib/observability/logger';

export async function StaffShell({ children }: { children: React.ReactNode }) {
  await requireStaffSession();
  const ctx = await getRequestContext();
  const unread = ctx.person
    ? await countUnread({ institutionId: ctx.institution.id, personId: ctx.person.id })
    : 0;
  const items = buildStaffNav(ctx.capabilities);
  // Los chats que esperan asesor (5/11), sobre el icono de Mensajes: solo si lo ve.
  const messages = items.find((item) => item.href === '/mensajes');
  // Un contador no tumba el marco: si la consulta falla (migración sin aplicar), sin número.
  if (messages) {
    messages.count = await countWaitingConversations(ctx.institution.id).catch((err: unknown) => {
      logger.warn({ event: 'nav-waiting-count-failed', error: String(err) });
      return 0;
    });
  }

  // El layout raíz ya puso la clase en `<html>`; esto es solo para que el conmutador de la
  // barra lateral arranque marcando la opción correcta en vez de adivinarla al hidratar.
  const theme = toTheme((await cookies()).get(THEME_COOKIE)?.value);

  return (
    <div className="lg:flex">
      <SideNav
        theme={theme}
        institutionName={ctx.institution.name}
        items={items}
        spaces={buildSpaces(ctx.capabilities)}
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
