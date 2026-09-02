import { Prisma, QueueRuleTypeEnum, StepTypeEnum } from '@prisma/client';

/** Step types allowed for cross-room load balancing (non-booking queues). */
export const REBALANCEABLE_STEP_TYPES: StepTypeEnum[] = [
  StepTypeEnum.LAB_TEST,
  StepTypeEnum.IMAGING,
  StepTypeEnum.PROCEDURE,
  StepTypeEnum.FUNCTIONAL_EXPLORATION,
];

export const QUEUE_DISPLAY_CACHE_TTL_MS = 30_000;
export const QUEUE_REBALANCE_THROTTLE_MS = 15_000;
export const QUEUE_REBALANCE_ENQUEUE_DEBOUNCE_MS = 15_000;

/** Detector / dest insert: do not touch the first N waiting positions (0-based index N). */
export const REBALANCE_PROTECTED_TOP_N = 3;
/** TV overlay window for CONFIRMED redirects on the source room. */
export const REBALANCE_REDIRECT_OVERLAY_MS = 10 * 60 * 1000;

export const FLAGGABLE_RULE_TYPES: QueueRuleTypeEnum[] = [
  QueueRuleTypeEnum.PATIENT_CATEGORY,
  QueueRuleTypeEnum.QUICK_TASK,
  QueueRuleTypeEnum.RETURNING,
  QueueRuleTypeEnum.TRANSFER,
];

export function parseStringCodeList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of value) {
    if (typeof item !== 'string') continue;
    const code = item.trim();
    if (!code || seen.has(code)) continue;
    seen.add(code);
    result.push(code);
  }
  return result;
}

export type SessionFlagCandidate = {
  booking_id: string | null;
  visit_date: Date;
  manual_rule_codes: unknown;
};

/**
 * Prefer the booking's own session, then a same-day walk-in session
 * (null booking_id — typical reception chips), then the latest flagged row.
 * `sessions` should already be filtered to the same calendar day.
 */
export function pickSameDayFlaggedSession<T extends SessionFlagCandidate>(
  sessions: T[],
  bookingId?: string | null,
): T | undefined {
  const flagged = sessions.filter(
    (s) => parseStringCodeList(s.manual_rule_codes).length > 0,
  );
  if (flagged.length === 0) return undefined;
  if (bookingId) {
    const attached = flagged.find((s) => s.booking_id === bookingId);
    if (attached) return attached;
  }
  return flagged.find((s) => s.booking_id == null) ?? flagged[0];
}

/**
 * Only reuse a same-day walk-in visit when it actually has priority flags.
 * Do not attach an unflagged nurse/EMR session onto a later booking.
 */
export function pickUnbookedFlaggedSession<T extends SessionFlagCandidate>(
  sessions: T[],
): T | undefined {
  return sessions.find(
    (s) =>
      s.booking_id == null &&
      parseStringCodeList(s.manual_rule_codes).length > 0,
  );
}

/**
 * Copy visit/fallback flags onto the queue only when the queue has none.
 * Returned `codes` are what evaluateRulesForEntry should union.
 */
export function resolveManualCodesForEnqueue(
  queueCodes: unknown,
  visitSessionCodes: unknown,
  fallbackSessionCodes: unknown = [],
): { codes: string[]; copyToQueue: boolean } {
  const queue = parseStringCodeList(queueCodes);
  if (queue.length > 0) {
    return { codes: queue, copyToQueue: false };
  }
  const visit = parseStringCodeList(visitSessionCodes);
  const source =
    visit.length > 0 ? visit : parseStringCodeList(fallbackSessionCodes);
  return { codes: source, copyToQueue: source.length > 0 };
}

/**
 * Dest insert index so the transferred patient keeps wait-time order
 * but never displaces the protected top N of the destination room.
 */
export function computeFairInsertAt(
  destOrder: Array<{ queue: { enqueued_at: Date } }>,
  transferredEnqueuedAt: Date,
  protectedTopN: number = REBALANCE_PROTECTED_TOP_N,
): number {
  const transferred = new Date(transferredEnqueuedAt).getTime();
  let targetIndex = destOrder.length;
  for (let i = 0; i < destOrder.length; i++) {
    if (new Date(destOrder[i].queue.enqueued_at).getTime() > transferred) {
      targetIndex = i;
      break;
    }
  }
  return Math.max(protectedTopN, targetIndex);
}

export const QUEUE_RULES_VERSION_KEY = 'queue:rulesVersion';
export const QUEUE_REBALANCE_LAST_RUN_KEY = 'queue:rebalance:lastRun';

export const DEFAULT_REBALANCE_PARAMS = {
  enabled: true,
  eta_gap_minutes: 15,
  suggestion_ttl_minutes: 10,
} as const;

export type RebalanceRuleParams = {
  enabled: boolean;
  eta_gap_minutes: number;
  suggestion_ttl_minutes: number;
};

export function parseRebalanceRuleParams(
  params: unknown,
): Partial<RebalanceRuleParams> & Record<string, unknown> {
  if (!params || typeof params !== 'object' || Array.isArray(params)) {
    return {};
  }
  return { ...(params as Record<string, unknown>) };
}

export function mergeRebalanceParams(
  existing: unknown,
  patch: {
    enabled?: boolean;
    eta_gap_minutes?: number;
    suggestion_ttl_minutes?: number;
  },
): RebalanceRuleParams & Record<string, unknown> {
  const current = parseRebalanceRuleParams(existing);
  const merged: RebalanceRuleParams & Record<string, unknown> = {
    ...DEFAULT_REBALANCE_PARAMS,
    ...current,
  };
  if (typeof patch.enabled === 'boolean') {
    merged.enabled = patch.enabled;
  }
  if (typeof patch.eta_gap_minutes === 'number') {
    merged.eta_gap_minutes = patch.eta_gap_minutes;
  }
  if (typeof patch.suggestion_ttl_minutes === 'number') {
    merged.suggestion_ttl_minutes = patch.suggestion_ttl_minutes;
  }
  return merged;
}

export function toRebalanceConfig(params: unknown): RebalanceRuleParams {
  const merged = mergeRebalanceParams(params, {});
  return {
    enabled: merged.enabled ?? DEFAULT_REBALANCE_PARAMS.enabled,
    eta_gap_minutes:
      merged.eta_gap_minutes ?? DEFAULT_REBALANCE_PARAMS.eta_gap_minutes,
    suggestion_ttl_minutes:
      merged.suggestion_ttl_minutes ??
      DEFAULT_REBALANCE_PARAMS.suggestion_ttl_minutes,
  };
}

export function displayCacheKey(roomId: string, rulesVersion: number): string {
  return `queue:display:${roomId}:v${rulesVersion}`;
}

/**
 * Builds a Prisma `where` filter for Queue queries to match the target date range.
 * - For bookings with scheduled shifts: matches `shift.date` within the date range.
 * - For walk-in / triage / steps without a booking shift: falls back to `created_at` within the date range.
 */
export function buildQueueDateFilter(
  startOfDay: Date,
  endOfDay?: Date,
): Prisma.QueueWhereInput {
  const dateRange = endOfDay
    ? { gte: startOfDay, lte: endOfDay }
    : { gte: startOfDay };

  return {
    OR: [
      {
        step: {
          flow: {
            booking: {
              slot: {
                shift: {
                  date: dateRange,
                },
              },
            },
          },
        },
      },
      {
        step: {
          OR: [{ flow_id: null }, { flow: null }],
        },
        created_at: dateRange,
      },
    ],
  };
}

