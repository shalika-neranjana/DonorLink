import type { RequestStatus } from './statuses';

export interface StatusHistoryEntry {
  status: RequestStatus;
  /** ISO timestamp */
  at: string;
  /** Short, non-sensitive note, e.g. "Verified by Colombo General". */
  note?: string;
}

export const TIMELINE_STAGES = [
  { key: 'submitted', label: 'Submitted', hint: 'Your request was received.' },
  { key: 'verified', label: 'Verified', hint: 'Request details were reviewed.' },
  { key: 'matching', label: 'Matching', hint: 'Looking for suitable donors nearby.' },
  { key: 'donors_contacted', label: 'Donors contacted', hint: 'Available donors were notified.' },
  { key: 'response_received', label: 'Response received', hint: 'At least one donor accepted.' },
  { key: 'blood_secured', label: 'Blood secured', hint: 'Enough donors have accepted.' },
  { key: 'completed', label: 'Completed', hint: 'Donation confirmed.' },
] as const;

export type TimelineStageKey = (typeof TIMELINE_STAGES)[number]['key'];
export type TimelineStageState = 'done' | 'current' | 'upcoming';

export interface TimelineStage {
  key: TimelineStageKey;
  label: string;
  hint: string;
  state: TimelineStageState;
  /** ISO timestamp the stage was completed, when known. */
  at?: string;
}

/** Number of leading stages that are complete for a "normal path" status. */
const COMPLETED_STAGES: Partial<Record<RequestStatus, number>> = {
  draft: 0,
  submitted: 1,
  pending_verification: 1,
  verified: 2,
  matching: 2,
  donors_contacted: 4,
  partially_fulfilled: 5,
  fulfilled: 6,
  completed: 7,
};

/** Which history status marks the end of each stage (used for timestamps). */
const STAGE_COMPLETION_STATUS: Record<TimelineStageKey, RequestStatus[]> = {
  submitted: ['submitted'],
  verified: ['verified'],
  matching: ['donors_contacted'],
  donors_contacted: ['donors_contacted'],
  response_received: ['partially_fulfilled', 'fulfilled'],
  blood_secured: ['fulfilled'],
  completed: ['completed'],
};

function completedStageCount(status: RequestStatus, history: StatusHistoryEntry[]): number {
  const direct = COMPLETED_STAGES[status];
  if (direct !== undefined) return direct;
  // cancelled / expired / rejected: show how far the request had got.
  let best = 0;
  for (const entry of history) {
    const count = COMPLETED_STAGES[entry.status];
    if (count !== undefined && count > best) best = count;
  }
  return best;
}

/**
 * Builds the vertical timeline shown on Request Tracking (Milestone 02 design).
 * Terminal off-path states (cancelled, expired, rejected) freeze the timeline
 * where it stopped, with no "current" stage.
 */
export function buildTimeline(status: RequestStatus, history: StatusHistoryEntry[]): TimelineStage[] {
  const completed = completedStageCount(status, history);
  const offPath = status === 'cancelled' || status === 'expired' || status === 'rejected';

  return TIMELINE_STAGES.map((stage, index) => {
    const state: TimelineStageState =
      index < completed ? 'done' : index === completed && !offPath && status !== 'completed' ? 'current' : 'upcoming';
    const entry =
      state === 'done'
        ? history.find((h) => STAGE_COMPLETION_STATUS[stage.key].includes(h.status))
        : undefined;
    return { ...stage, state, at: entry?.at };
  });
}

/** Parses the JSON statusHistory column defensively. */
export function parseStatusHistory(raw: string | null | undefined): StatusHistoryEntry[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is StatusHistoryEntry =>
        typeof item === 'object' &&
        item !== null &&
        typeof (item as StatusHistoryEntry).status === 'string' &&
        typeof (item as StatusHistoryEntry).at === 'string',
    );
  } catch {
    return [];
  }
}
