import { StepTypeEnum } from '@prisma/client';

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
