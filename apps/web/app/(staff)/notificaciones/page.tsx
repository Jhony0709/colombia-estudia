/**
 * Centro de notificaciones.
 * SSOT: plan/06-cohortes-y-personas.md:65-70 (§7), plan/11-ux.md:77-80, routes.md.
 *
 * La lista vive en `components/organisms/notification-list` (compartida con
 * `/aprender/notificaciones` desde el 19/9); esta página es la del equipo.
 */

import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { getRequestContext } from '@/lib/authz/request-context';
import { listNotifications } from '@/features/notifications/server/notifications.service';
import { Page, PageHeader, PageSection } from '@/components/templates/page';
import { EmptyState } from '@/components/molecules/empty-state';
import { NotificationList } from '@/components/organisms/notification-list';
import { Breadcrumb } from '@/components/molecules/breadcrumb';

export const metadata: Metadata = { title: 'Notificaciones' };

export default async function NotificationsPage() {
  const ctx = await getRequestContext();
  const t = await getTranslations('notifications');

  if (!ctx.person) {
    // El layout de (staff) ya exige sesión; esto es el cinturón por si alguien mueve la
    // página de grupo y se lleva la guardia por delante.
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

  const tc = await getTranslations('crumbs');

  return (
    <Page>
      <PageHeader
        back={
          <Breadcrumb
            label={tc('label')}
            items={[{ label: tc('home'), href: '/ingresar' }, { label: tc('notifications') }]}
          />
        }
        overline={t('overline')}
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
