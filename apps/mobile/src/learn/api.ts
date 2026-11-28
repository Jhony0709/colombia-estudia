import { request } from '../api';

// Las formas de apps/web/features/learn/server/cohort.service.ts:35-97 y outline.ts:16-63, lo
// que la app lee. Las fechas llegan en ISO.
export type CohortGate =
  | { kind: 'NO_ENROLLMENT' }
  | { kind: 'NOT_STARTED_YET'; startsOn: string }
  | { kind: 'NOT_OPEN_YET' }
  | { kind: 'ACCESS_EXPIRED'; accessUntil: string }
  | { kind: 'COMPLETED' }
  | { kind: 'WITHDRAWN' };

export type ModuleAccess =
  | { state: 'OPEN' }
  | { state: 'LOCKED' }
  | { state: 'NOT_YET'; from: string }
  | { state: 'CLOSED'; until: string };

export interface RouteItem {
  kind: 'LESSON' | 'ASSESSMENT';
  assignmentId: string;
  title: string;
  status: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';
  requiresSubmission?: boolean;
  form?: 'VIDEO' | 'MARKDOWN' | 'SUBMISSION' | 'ASSESSMENT';
  estimatedMinutes?: number | null;
  enabled: boolean;
  blockedBy: string | null;
  unavailableReason: 'NOT_YET' | 'CLOSED' | 'LOCKED' | null;
}

export interface RouteModule {
  id: string;
  name: string;
  access: ModuleAccess;
  installment: { position: number; amount: number } | null;
  items: RouteItem[];
}

export interface CohortSummary {
  id: string;
  name: string;
  programName: string;
  programFree: boolean;
}

export interface CohortOutline {
  gate: CohortGate | null;
  enrollmentId: string | null;
  cohort: CohortSummary | null;
  modules: RouteModule[];
  resume: RouteItem | null;
  progress: { completed: number; total: number };
  partnerFunded: boolean;
  awaitingPlan: boolean;
}

export interface MyEnrollment {
  enrollmentId: string;
  cohort: CohortSummary;
}

export async function listEnrollments(): Promise<MyEnrollment[]> {
  return (await request<{ enrollments: MyEnrollment[] }>('/api/learn/enrollments')).enrollments;
}

export const getOutline = (enrollmentId: string | null) =>
  request<CohortOutline>(
    enrollmentId ? `/api/learn/cohort?enrollmentId=${enrollmentId}` : '/api/learn/cohort'
  );

export async function unreadNotifications(): Promise<number> {
  return (await request<{ unread: number }>('/api/notifications?limit=1')).unread;
}

/** Un examen o una actividad se hacen en la web (reference/03-ui/movil.md, M2). */
export const onWeb = (item: RouteItem) => item.kind === 'ASSESSMENT' || !!item.requiresSubmission;

export const webPathOf = (item: RouteItem) =>
  item.kind === 'ASSESSMENT'
    ? `/aprender/examen/${item.assignmentId}`
    : `/aprender/tema/${item.assignmentId}`;
