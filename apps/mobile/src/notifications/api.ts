import { request } from '../api';

// `NotificationListItem` de apps/web/features/notifications/server/notifications.service.ts:81.
export interface Notice {
  id: string;
  type: string;
  title: string;
  body: string;
  href: string | null;
  readAt: string | null;
  createdAt: string;
}

export const listNotifications = () =>
  request<{ items: Notice[]; unread: number }>('/api/notifications');

export const markRead = (id: string) =>
  request<{ readAt: string }>(`/api/notifications/${id}/read`, { method: 'PATCH' });

export const markAllRead = () =>
  request<{ marked: number }>('/api/notifications/read-all', { method: 'PATCH' });
