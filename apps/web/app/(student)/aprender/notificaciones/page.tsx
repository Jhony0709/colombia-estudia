/**
 * Notificaciones del estudiante.
 * SSOT: routes.md:29 (`/notificaciones`, «Autenticado»), plan/11-ux.md:77-80.
 *
 * La misma lista que el equipo (`components/organisms/notification-list`), bajo `/aprender`
 * porque el área del estudiante tiene su propia cabecera y no pasa por la guardia de staff.
 */

import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { getRequestContext } from '@/lib/authz/request-context';
import { listNotifications } from '@/features/notifications/server/notifications.service';
import { Page, PageHeader, PageSection } from '@/components/templates/page';
import { EmptyState } from '@/components/molecules/empty-state';
import { NotificationList } from '@/components/organisms/notification-list';

export const metadata: Metadata = { title: 'Notificaciones' };

export default async function StudentNotificationsPage() {
  const ctx = await getRequestContext();
  const t = await getTranslations('notifications');

  if (!ctx.person) {
    return (
      <Page>
        <PageHeader title={t('title')} />
        <EmptyState title={t('noSession')} description={t('noSessionHint')} />
      </Page>
    );
  }

  const { items, unread } = await listNotifications({
    institutionId: ctx.institution.id,
    personId: ctx.person.id,
  });

  return (
    <Page>
      <PageHeader
        title={t('title')}
        description={unread > 0 ? t('unreadCount', { count: unread }) : t('allRead')}
      />
      <PageSection title={t('listTitle')} id="lista">
        {items.length === 0 ? (
          <EmptyState title={t('emptyTitle')} description={t('emptyHint')} />
        ) : (
          <NotificationList items={items} unread={unread} />
        )}
      </PageSection>
    </Page>
  );
}
