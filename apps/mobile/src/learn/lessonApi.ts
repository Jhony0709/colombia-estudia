import { request } from '../api';
import type { CohortGate } from './api';

// Lo que la app lee de apps/web/features/learn/server/lesson.service.ts:42-98 y outline.ts:285.
export type LessonGate =
  | { kind: 'COHORT'; cohort: CohortGate }
  | { kind: 'NOT_ASSIGNED' }
  | { kind: 'BLOCKED'; blockedBy: string }
  | { kind: 'NOT_YET' }
  | { kind: 'CLOSED' }
  | { kind: 'LOCKED' };

export type Status = 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';

export interface Neighbour {
  assignmentId: string;
  title: string;
  kind: 'LESSON' | 'ASSESSMENT';
  enabled: boolean;
  blockedBy: string | null;
  locked: boolean;
}

export interface Transcript {
  assetId: string;
  title: string | null;
  cues: { start: number; end: number; text: string }[];
}

export interface Lesson {
  gate: LessonGate | null;
  lesson: {
    assignmentId: string;
    title: string;
    moduleName: string;
    estimatedMinutes: number | null;
    requiresSubmission: boolean;
    form: 'VIDEO' | 'MARKDOWN' | 'SUBMISSION';
    html: string;
    missingAssets: string[];
    transcripts: Transcript[];
  } | null;
  progress: { status: Status } | null;
  navigation: { previous: Neighbour | null; next: Neighbour | null };
}

export interface Evidence {
  secondsOnLesson: number;
  scrolledToEnd?: true;
  transcriptReadToEnd?: true;
  videoPositionSeconds?: number;
  videoDurationSeconds?: number;
}

export const getLesson = (id: string) => request<Lesson>(`/api/learn/lessons/${id}`);

/** `recordEvidence` (apps/web/features/learn/server/progress.service.ts:228). */
export const postEvidence = (id: string, evidence: Evidence) =>
  request<{ status: Status; justCompleted: boolean }>(`/api/learn/lessons/${id}/evidence`, {
    method: 'POST',
    body: evidence,
  });
