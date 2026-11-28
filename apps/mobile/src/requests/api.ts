import { request } from '../api';

// Lo que la app pinta de `StaffRequestRow` (apps/web/features/requests/server/requests.service.ts).
export interface RequestRow {
  id: string;
  kind: 'ENROLL' | 'UNLOCK' | 'ATTEMPT';
  status: 'PENDING' | 'DONE' | 'DISMISSED';
  createdAt: string;
  resolvedAt: string | null;
  resolvedByName: string | null;
  person: { name: string; isMinor: boolean; hasGuardian: boolean };
  cohort: { id: string; code: string; programName: string; open: boolean };
  module: { id: string; name: string };
  enrollmentId: string | null;
  assessment: { title: string } | null;
  whatsappAt: string | null;
  billing: { overdue: number } | null;
}

export type RequestsView = 'pending' | 'closed';

export async function listRequests(view: RequestsView): Promise<RequestRow[]> {
  return (await request<{ requests: RequestRow[] }>(`/api/access-requests?status=${view}`))
    .requests;
}

/** Habilitar cierra la solicitud en el servidor, como en la web. */
export const unlockModule = (enrollmentId: string, moduleId: string) =>
  request<unknown>(`/api/cohorts/enrollments/${enrollmentId}/modules/${moduleId}`, {
    method: 'PUT',
    body: { unlocked: true },
  });

const decide = (action: 'grant' | 'dismiss') => (id: string) =>
  request<unknown>(`/api/access-requests/${id}`, { method: 'PATCH', body: { action } });

export const grantAttempt = decide('grant');
export const dismissRequest = decide('dismiss');
