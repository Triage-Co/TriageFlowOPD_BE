import { Injectable, Logger } from '@nestjs/common';
import {
  ClinicalRoomType,
  GenderTypeEnum,
  Prisma,
  Queue,
  Queue_Priority_Rule,
  QueueRuleTypeEnum,
  QueueStatusEnum,
  QueueTypeEnum,
  StepTypeEnum,
} from '@prisma/client';
import { PrismaService } from '../../shared/config/prisma.service';
import { QueueCacheService } from './queue-cache.service';

export interface RuleEvaluationInput {
  patient: { dob: Date | null; gender: GenderTypeEnum } | null;
  queueType: QueueTypeEnum;
  suggestedPriority: number | null;
  vitals: {
    temperature: number | null;
    heart_rate: number | null;
    spo2: number | null;
    blood_pressure_sys: number | null;
  } | null;
  appointmentOnTime: boolean;
  missedCount: number;
  roomType: ClinicalRoomType | null;
  specialtyId: string | null;
}

export interface RuleEvaluationResult {
  basePriority: number;
  appliedRules: { rule_code: string; weight: number }[];
}

export type QueueOrderStep = {
  step_type: StepTypeEnum | null;
  service_code: string | null;
  room_id?: string | null;
  flow?: {
    booking?: {
      patient?: { full_name: string } | null;
    } | null;
  } | null;
};

export type OrderedQueueRecord = Queue & {
  step?: QueueOrderStep | null;
};

export interface OrderedQueueEntry {
  queue: OrderedQueueRecord;
  effectiveScore: number;
  position: number;
  reasons: string[];
}

export type RoomQueueContext = {
  room_type?: ClinicalRoomType | null;
  specialty_id?: string | null;
};

const QUEUE_ORDER_SELECT = {
  queue_id: true,
  step_id: true,
  queue_number: true,
  status: true,
  room_id: true,
  queue_type: true,
  base_priority: true,
  applied_rules: true,
  is_pinned: true,
  pinned_at: true,
  hold_positions: true,
  enqueued_at: true,
  called_at: true,
  serving_started_at: true,
  finished_at: true,
  missed_at: true,
  missed_count: true,
  created_at: true,
  updated_at: true,
  step: {
    select: {
      step_type: true,
      service_code: true,
      room_id: true,
      flow: {
        select: {
          booking: {
            select: {
              patient: {
                select: { full_name: true },
              },
            },
          },
        },
      },
    },
  },
} satisfies Prisma.QueueSelect;

/**
 * Pure function to evaluate rule conditions against fact object.
 */
export function matchConditions(
  conditions: Record<string, any> | null | undefined,
  facts: Record<string, unknown>,
): boolean {
  if (
    !conditions ||
    typeof conditions !== 'object' ||
    Object.keys(conditions).length === 0
  ) {
    return true;
  }

  for (const [field, ops] of Object.entries(conditions)) {
    const value = facts[field];
    if (value === null || value === undefined) {
      return false;
    }

    if (typeof ops !== 'object' || ops === null) {
      return false;
    }

    for (const [op, target] of Object.entries(ops)) {
      switch (op) {
        case 'eq':
          if (value !== target) return false;
          break;
        case 'neq':
          if (value === target) return false;
          break;
        case 'gt':
          if (typeof value !== 'number' || value <= (target as number))
            return false;
          break;
        case 'gte':
          if (typeof value !== 'number' || value < (target as number))
            return false;
          break;
        case 'lt':
          if (typeof value !== 'number' || value >= (target as number))
            return false;
          break;
        case 'lte':
          if (typeof value !== 'number' || value > (target as number))
            return false;
          break;
        case 'in':
          if (!Array.isArray(target) || !target.includes(value)) return false;
          break;
        default:
          return false;
      }
    }
  }

  return true;
}

/**
 * Pure function to calculate effective scores and order queue entries.
 */
export function orderEntries(
  entries: OrderedQueueRecord[],
  rules: Queue_Priority_Rule[],
  now: Date,
  roomContext?: RoomQueueContext,
): OrderedQueueEntry[] {
  if (!entries || entries.length === 0) {
    return [];
  }

  // 1. Find active AGING rule scoped for this room
  const agingRules = rules.filter(
    (r) => r.is_active && r.rule_type === QueueRuleTypeEnum.AGING,
  );
  const scopedAgingRule =
    agingRules.find(
      (r) =>
        (r.room_type && r.room_type === roomContext?.room_type) ||
        (r.specialty_id && r.specialty_id === roomContext?.specialty_id),
    ) || agingRules.find((r) => !r.room_type && !r.specialty_id);

  const agingRate = scopedAgingRule?.aging_rate ?? 0;
  const maxAging = scopedAgingRule?.max_aging ?? 0;

  // Compute effectiveScore and annotate entries
  const evaluated = entries.map((q) => {
    const enqueuedAt = q.enqueued_at
      ? new Date(q.enqueued_at)
      : new Date(q.created_at);
    const waitedMs = Math.max(0, now.getTime() - enqueuedAt.getTime());
    const waitedMinutes = waitedMs / 60000;

    let agingBonus = agingRate * waitedMinutes;
    if (maxAging > 0 && agingBonus > maxAging) {
      agingBonus = maxAging;
    }

    const effectiveScore = q.base_priority + agingBonus;
    return {
      queue: q,
      effectiveScore,
      agingBonus,
    };
  });

  const isInterleave = (q: Queue) =>
    q.queue_type === QueueTypeEnum.RETURNING ||
    q.queue_type === QueueTypeEnum.QUICK_TASK;

  const comparator = (a: (typeof evaluated)[0], b: (typeof evaluated)[0]) => {
    if (a.effectiveScore !== b.effectiveScore)
      return b.effectiveScore - a.effectiveScore;
    const eA = new Date(a.queue.enqueued_at).getTime();
    const eB = new Date(b.queue.enqueued_at).getTime();
    if (eA !== eB) return eA - eB;
    return a.queue.queue_number.localeCompare(b.queue.queue_number);
  };

  // 2. Partition into 3 groups: PINNED, INTERLEAVE, REGULAR
  const pinnedList = evaluated
    .filter((e) => e.queue.is_pinned)
    .sort((a, b) => {
      const pA = a.queue.pinned_at ? new Date(a.queue.pinned_at).getTime() : 0;
      const pB = b.queue.pinned_at ? new Date(b.queue.pinned_at).getTime() : 0;
      if (pA !== pB) return pA - pB;
      return comparator(a, b);
    });

  const unpinned = evaluated.filter((e) => !e.queue.is_pinned);

  const interleaveList = unpinned
    .filter((e) => isInterleave(e.queue))
    .sort(comparator);
  const regularList = unpinned
    .filter((e) => !isInterleave(e.queue))
    .sort(comparator);

  // 3. Merge REGULAR and INTERLEAVE according to interleave_ratio (default 1)
  const interleaveRules = rules.filter(
    (r) =>
      r.is_active &&
      (r.rule_type === QueueRuleTypeEnum.RETURNING ||
        r.rule_type === QueueRuleTypeEnum.QUICK_TASK),
  );
  const scopedInterleave =
    interleaveRules.find(
      (r) =>
        (r.room_type && r.room_type === roomContext?.room_type) ||
        (r.specialty_id && r.specialty_id === roomContext?.specialty_id),
    ) || interleaveRules.find((r) => !r.room_type && !r.specialty_id);

  const rawRatio = Number((scopedInterleave?.params as any)?.interleave_ratio);
  const ratio = Number.isFinite(rawRatio) && rawRatio >= 1 ? Math.floor(rawRatio) : 1;

  const merged: (typeof evaluated)[0][] = [];
  let regIdx = 0;
  let intIdx = 0;

  while (regIdx < regularList.length || intIdx < interleaveList.length) {
    for (let r = 0; r < ratio && regIdx < regularList.length; r++) {
      merged.push(regularList[regIdx++]);
    }
    if (intIdx < interleaveList.length) {
      merged.push(interleaveList[intIdx++]);
    }
  }

  // 4. Apply hold_positions: sort hold entries by hold_positions DESC to prevent cascading
  const holdEntries = merged
    .map((entry) => ({ entry, hold: entry.queue.hold_positions ?? 0 }))
    .filter((item) => item.hold > 0)
    .sort((a, b) => b.hold - a.hold);

  for (const item of holdEntries) {
    const currentIdx = merged.indexOf(item.entry);
    const targetIdx = item.hold;
    if (currentIdx >= 0 && currentIdx < targetIdx) {
      merged.splice(currentIdx, 1);
      const insertAt = Math.min(targetIdx, merged.length);
      merged.splice(insertAt, 0, item.entry);
    }
  }

  // 5. Prepend PINNED group to top
  const finalList = [...pinnedList, ...merged];

  // 6. Assign position and build reasons
  return finalList.map((item, index) => {
    const q = item.queue;
    const reasons: string[] = [];

    if (q.applied_rules && Array.isArray(q.applied_rules)) {
      for (const rule of q.applied_rules as any[]) {
        if (rule && rule.rule_code) {
          reasons.push(rule.rule_code);
        }
      }
    }

    if (item.agingBonus > 0) {
      reasons.push(`AGING+${item.agingBonus.toFixed(1)}`);
    }

    if (q.is_pinned) {
      reasons.push('PINNED');
    }

    if (q.hold_positions && q.hold_positions > 0) {
      reasons.push(`HOLD_${q.hold_positions}`);
    }

    if (isInterleave(q)) {
      reasons.push('INTERLEAVE');
    }

    return {
      queue: q,
      effectiveScore: item.effectiveScore,
      position: index,
      reasons,
    };
  });
}

@Injectable()
export class QueuePriorityService {
  private readonly logger = new Logger(QueuePriorityService.name);
  private rulesCache: { data: Queue_Priority_Rule[]; loadedAt: number } | null =
    null;
  private readonly CACHE_TTL_MS = 60000;

  constructor(
    private readonly prisma: PrismaService,
    private readonly queueCacheService: QueueCacheService,
  ) { }

  clearRulesCache(): void {
    this.rulesCache = null;
    void this.queueCacheService.bumpRulesVersion();
  }

  async getActiveRules(): Promise<Queue_Priority_Rule[]> {
    const now = Date.now();
    if (this.rulesCache && now - this.rulesCache.loadedAt < this.CACHE_TTL_MS) {
      return this.rulesCache.data;
    }

    const rules = await this.prisma.queue_Priority_Rule.findMany({
      where: { is_active: true },
    });

    this.rulesCache = { data: rules, loadedAt: now };
    return rules;
  }

  async evaluateRulesForEntry(
    input: RuleEvaluationInput,
  ): Promise<RuleEvaluationResult> {
    const allRules = await this.getActiveRules();

    const scoringRuleTypes: QueueRuleTypeEnum[] = [
      QueueRuleTypeEnum.PATIENT_CATEGORY,
      QueueRuleTypeEnum.APPOINTMENT,
      QueueRuleTypeEnum.WALK_IN,
      QueueRuleTypeEnum.TRANSFER,
    ];

    const eligibleRules = allRules.filter((r) =>
      scoringRuleTypes.includes(r.rule_type),
    );

    const scopedRulesMap = new Map<string, Queue_Priority_Rule>();
    for (const rule of eligibleRules) {
      const isGlobal = !rule.room_type && !rule.specialty_id;
      const isRoomTypeMatch =
        rule.room_type && rule.room_type === input.roomType;
      const isSpecialtyMatch =
        rule.specialty_id && rule.specialty_id === input.specialtyId;

      if (!isGlobal && !isRoomTypeMatch && !isSpecialtyMatch) {
        continue;
      }

      const existing = scopedRulesMap.get(rule.rule_code);
      if (!existing) {
        scopedRulesMap.set(rule.rule_code, rule);
      } else {
        const existingIsScoped = Boolean(
          existing.room_type || existing.specialty_id,
        );
        const currentIsScoped = Boolean(rule.room_type || rule.specialty_id);
        if (!existingIsScoped && currentIsScoped) {
          scopedRulesMap.set(rule.rule_code, rule);
        }
      }
    }

    let age: number | null = null;
    if (input.patient?.dob) {
      const dob = new Date(input.patient.dob);
      const now = new Date();
      age = now.getFullYear() - dob.getFullYear();
      const m = now.getMonth() - dob.getMonth();
      if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) {
        age--;
      }
    }

    const facts: Record<string, unknown> = {
      age,
      gender: input.patient?.gender ?? null,
      queue_type: input.queueType,
      suggested_priority: input.suggestedPriority,
      temperature: input.vitals?.temperature ?? null,
      heart_rate: input.vitals?.heart_rate ?? null,
      spo2: input.vitals?.spo2 ?? null,
      blood_pressure_sys: input.vitals?.blood_pressure_sys ?? null,
      appointment_on_time: input.appointmentOnTime,
      missed_count: input.missedCount,
    };

    let basePriority = 0;
    const appliedRules: { rule_code: string; weight: number }[] = [];

    for (const rule of scopedRulesMap.values()) {
      const matched = matchConditions(
        rule.conditions as Record<string, any>,
        facts,
      );
      if (matched) {
        basePriority += rule.weight;
        appliedRules.push({ rule_code: rule.rule_code, weight: rule.weight });
      }
    }

    return { basePriority, appliedRules };
  }

  async computeQueueOrder(
    roomId: string,
    tx?: Prisma.TransactionClient,
    roomContext?: RoomQueueContext,
  ): Promise<OrderedQueueEntry[]> {
    const db = tx || this.prisma;
    const rules = await this.getActiveRules();

    const room =
      roomContext !== undefined
        ? roomContext
        : await db.room.findUnique({
          where: { room_id: roomId },
          select: { room_type: true, specialty_id: true },
        });

    const now = new Date();
    const dateFormatted = formatInTimeZone(now, TIME_ZONE, 'yyyy-MM-dd');
    const startOfDay = toDate(`${dateFormatted}T00:00:00`, { timeZone: TIME_ZONE });
    const endOfDay = toDate(`${dateFormatted}T23:59:59.999`, { timeZone: TIME_ZONE });

    const entries = await db.queue.findMany({
      where: {
        status: { in: [QueueStatusEnum.PENDING, QueueStatusEnum.QUEUED] },
        created_at: { gte: startOfDay, lte: endOfDay },
        // Prefer denormalized queue.room_id; also pick up orphans where only step.room_id is set
        OR: [
          { room_id: roomId },
          { room_id: null, step: { room_id: roomId } },
        ],
      },
      select: QUEUE_ORDER_SELECT,
    });

    // Repair denormalized room_id so TV/socket queries stay consistent
    const orphanIds = entries.filter((e) => !e.room_id).map((e) => e.queue_id);
    if (orphanIds.length > 0) {
      await db.queue.updateMany({
        where: { queue_id: { in: orphanIds } },
        data: { room_id: roomId },
      });
      for (const e of entries) {
        if (!e.room_id) e.room_id = roomId;
      }
    }

    return orderEntries(entries as OrderedQueueRecord[], rules, new Date(), {
      room_type: room?.room_type,
      specialty_id: room?.specialty_id,
    });
  }
}
