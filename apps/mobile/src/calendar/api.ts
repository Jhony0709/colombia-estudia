import { request } from '../api';

// `CalendarItem` de apps/web/features/cohorts/server/live-sessions.service.ts:215.
export interface CalendarItem {
  kind: 'COHORT_START' | 'COHORT_END' | 'ACCESS_UNTIL' | 'ASSESSMENT_DUE' | 'LIVE_SESSION';
  id: string;
  title: string;
  at: string;
  endsAt: string | null;
  href: string | null;
  joinable: boolean;
  description: string | null;
  programName: string;
  done: boolean;
}

export const getCalendar = () => request<CalendarItem[]>('/api/learn/calendar');
