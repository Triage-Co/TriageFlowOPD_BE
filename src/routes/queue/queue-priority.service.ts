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
import { formatInTimeZone, toDate } from 'date-fns-tz';
import {
  buildQueueDateFilter,
  FLAGGABLE_RULE_TYPES,
  isAppointmentSlotDue,
  parseSlotStartOnDate,
  parseStringCodeList,
} from './queue.constants';

const TIME_ZONE = 'Asia/Ho_Chi_Minh';

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
  /** Staff-attached rule codes; unioned with auto-matched rules. */
  manualRuleCodes?: string[];
}

export interface RuleEvaluationResult {
  basePriority: number;
  appliedRules: { rule_code: string; weight: number }[];
  /** Set when QUICK_TASK / RETURNING is in the applied union (interleave). */
  queueType?: QueueTypeEnum;
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
  rebalance_locked: true,
  manual_rule_codes: true,
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

/** True when the rule has no predicates (null, {}, or non-object). */
export function isVacuousConditions(conditions: unknown): boolean {
  return (
    conditions == null ||
    typeof conditions !== 'object' ||
    Array.isArray(conditions) ||
    Object.keys(conditions as object).length === 0
  );
}

/**
 * Admin catalog flags with empty conditions must not auto-stamp every ticket.
 * Only WALK_IN_BASE is designed to match everyone (weight 0).
 */
export function shouldAutoMatchScoringRule(rule: {
  rule_type: QueueRuleTypeEnum;
  conditions: unknown;
}): boolean {
  if (!isVacuousConditions(rule.conditions)) return true;
  return rule.rule_type === QueueRuleTypeEnum.WALK_IN;
}

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
  const ratio =
    Number.isFinite(rawRatio) && rawRatio >= 1 ? Math.floor(rawRatio) : 1;

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

  async getFlaggableRules(): Promise<
    Array<{
      rule_id: string;
      rule_code: string;
      name: string;
      description: string | null;
      rule_type: QueueRuleTypeEnum;
      weight: number;
    }>
  > {
    // Catalog for the staff picker: always hit DB (do not use the 60s engine cache).
    const rules = await this.prisma.queue_Priority_Rule.findMany({
      where: {
        is_active: true,
        rule_type: { in: FLAGGABLE_RULE_TYPES },
      },
      orderBy: [{ weight: 'desc' }, { name: 'asc' }, { rule_code: 'asc' }],
      select: {
        rule_id: true,
        rule_code: true,
        name: true,
        description: true,
        rule_type: true,
        weight: true,
      },
    });
    const seen = new Set<string>();
    const result: Array<{
      rule_id: string;
      rule_code: string;
      name: string;
      description: string | null;
      rule_type: QueueRuleTypeEnum;
      weight: number;
    }> = [];
    for (const rule of rules) {
      if (seen.has(rule.rule_code)) continue;
      seen.add(rule.rule_code);
      result.push(rule);
    }
    return result;
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
    const appliedCodes = new Set<string>();

    for (const rule of scopedRulesMap.values()) {
      if (!shouldAutoMatchScoringRule(rule)) continue;
      const matched = matchConditions(
        rule.conditions as Record<string, unknown>,
        facts,
      );
      if (matched) {
        basePriority += rule.weight;
        appliedRules.push({ rule_code: rule.rule_code, weight: rule.weight });
        appliedCodes.add(rule.rule_code);
      }
    }

    const manualCodes = parseStringCodeList(input.manualRuleCodes);
    let queueTypeOverride: QueueTypeEnum | undefined;
    if (manualCodes.length > 0) {
      const rulesByCode = new Map<string, Queue_Priority_Rule>();
      for (const rule of allRules) {
        if (!rulesByCode.has(rule.rule_code)) {
          rulesByCode.set(rule.rule_code, rule);
        }
      }

      for (const code of manualCodes) {
        const rule = rulesByCode.get(code);
        if (!rule) continue;

        if (!appliedCodes.has(rule.rule_code)) {
          basePriority += rule.weight;
          appliedRules.push({
            rule_code: rule.rule_code,
            weight: rule.weight,
          });
          appliedCodes.add(rule.rule_code);
        }

        if (rule.rule_type === QueueRuleTypeEnum.RETURNING) {
          queueTypeOverride = QueueTypeEnum.RETURNING;
        } else if (
          rule.rule_type === QueueRuleTypeEnum.QUICK_TASK &&
          queueTypeOverride !== QueueTypeEnum.RETURNING
        ) {
          queueTypeOverride = QueueTypeEnum.QUICK_TASK;
        }
      }
    }

    return {
      basePriority,
      appliedRules,
      ...(queueTypeOverride ? { queueType: queueTypeOverride } : {}),
    };
  }

  async autoEnqueueDueAppointments(
    roomId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    const db = tx || this.prisma;
    const now = new Date();
    const dateFormatted = formatInTimeZone(now, TIME_ZONE, 'yyyy-MM-dd');
    const startOfDay = toDate(`${dateFormatted}T00:00:00`, {
      timeZone: TIME_ZONE,
    });
    const endOfDay = toDate(`${dateFormatted}T23:59:59.999`, {
      timeZone: TIME_ZONE,
    });

    const todaySteps = await db.step.findMany({
      where: {
        room_id: roomId,
        step_status: {
          in: ['PENDING', 'IN_PROGRESS'] as any,
        },
        flow: {
          booking: {
            slot: {
              shift: {
                date: { gte: startOfDay, lte: endOfDay },
              },
            },
          },
        },
      },
      include: {
        queues: true,
        flow: {
          include: {
            booking: {
              include: {
                patient: true,
                slot: {
                  include: {
                    shift: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    const dueSteps = (todaySteps || []).filter((step) => {
      const slot = step.flow?.booking?.slot;
      if (!slot?.start_time || !slot.shift?.date) return false;
      return isAppointmentSlotDue(
        slot.start_time,
        new Date(slot.shift.date),
        now,
        TIME_ZONE,
      );
    });

    if (dueSteps.length === 0) return;

    for (const step of dueSteps) {
      const activeQueue = (step.queues || []).find(
        (q) =>
          q.status !== QueueStatusEnum.FINISHED &&
          q.status !== QueueStatusEnum.CANCELLED,
      );

      const slotStartTimeStr = step.flow?.booking?.slot?.start_time;
      let enqueuedAt = now;
      if (slotStartTimeStr) {
        const parsed = parseSlotStartOnDate(
          slotStartTimeStr,
          dateFormatted,
          TIME_ZONE,
        );
        if (parsed && parsed <= now) enqueuedAt = parsed;
      }

      if (!activeQueue) {
        const count = await db.queue.count({
          where: {
            room_id: roomId,
            created_at: { gte: startOfDay, lte: endOfDay },
          },
        });
        const queueNumber = (count + 1).toString();

        const evalResult = await this.evaluateRulesForEntry({
          patient: step.flow?.booking?.patient ?? null,
          queueType: QueueTypeEnum.APPOINTMENT,
          suggestedPriority: null,
          vitals: null,
          appointmentOnTime: true,
          missedCount: 0,
          roomType: null,
          specialtyId: null,
        });

        await db.queue.create({
          data: {
            step_id: step.step_id,
            room_id: roomId,
            queue_number: queueNumber,
            queue_type: QueueTypeEnum.APPOINTMENT,
            base_priority: evalResult.basePriority,
            applied_rules: evalResult.appliedRules ?? undefined,
            enqueued_at: enqueuedAt,
            status: QueueStatusEnum.QUEUED,
          },
        });
      } else if (activeQueue.status === QueueStatusEnum.PENDING) {
        await db.queue.update({
          where: { queue_id: activeQueue.queue_id },
          data: {
            status: QueueStatusEnum.QUEUED,
            enqueued_at: enqueuedAt,
            room_id: roomId,
          },
        });
      }
    }
  }

  /**
   * Promote all due PENDING appointment queues (any room). Returns affected room IDs.
   */
  async activateDueAppointmentQueues(
    tx?: Prisma.TransactionClient,
  ): Promise<string[]> {
    const db = tx || this.prisma;
    const now = new Date();
    const dateFormatted = formatInTimeZone(now, TIME_ZONE, 'yyyy-MM-dd');
    const startOfDay = toDate(`${dateFormatted}T00:00:00`, {
      timeZone: TIME_ZONE,
    });
    const endOfDay = toDate(`${dateFormatted}T23:59:59.999`, {
      timeZone: TIME_ZONE,
    });

    const pendingQueues = await db.queue.findMany({
      where: {
        status: QueueStatusEnum.PENDING,
        step: {
          flow: {
            booking: {
              slot: {
                shift: {
                  date: { gte: startOfDay, lte: endOfDay },
                },
              },
            },
          },
        },
      },
      include: {
        step: {
          include: {
            flow: {
              include: {
                booking: {
                  include: {
                    slot: {
                      include: {
                        shift: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    const roomIds = new Set<string>();

    for (const queue of pendingQueues) {
      const slot = queue.step?.flow?.booking?.slot;
      if (!slot?.start_time || !slot.shift?.date) continue;
      if (
        !isAppointmentSlotDue(
          slot.start_time,
          new Date(slot.shift.date),
          now,
          TIME_ZONE,
        )
      ) {
        continue;
      }

      let enqueuedAt = queue.enqueued_at || now;
      const parsed = parseSlotStartOnDate(
        slot.start_time,
        dateFormatted,
        TIME_ZONE,
      );
      if (parsed && parsed <= now) enqueuedAt = parsed;

      const roomId = queue.room_id || queue.step?.room_id || null;

      await db.queue.update({
        where: { queue_id: queue.queue_id },
        data: {
          status: QueueStatusEnum.QUEUED,
          enqueued_at: enqueuedAt,
          ...(roomId && !queue.room_id ? { room_id: roomId } : {}),
        },
      });

      if (roomId) roomIds.add(roomId);
    }

    return [...roomIds];
  }

  async computeQueueOrder(
    roomId: string,
    tx?: Prisma.TransactionClient,
    roomContext?: RoomQueueContext,
  ): Promise<OrderedQueueEntry[]> {
    const db = tx || this.prisma;
    await this.autoEnqueueDueAppointments(roomId, db);
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
    const startOfDay = toDate(`${dateFormatted}T00:00:00`, {
      timeZone: TIME_ZONE,
    });
    const endOfDay = toDate(`${dateFormatted}T23:59:59.999`, {
      timeZone: TIME_ZONE,
    });

    const entries = await db.queue.findMany({
      where: {
        status: QueueStatusEnum.QUEUED,
        AND: [
          buildQueueDateFilter(startOfDay, endOfDay),
          {
            // Prefer denormalized queue.room_id; also pick up orphans where only step.room_id is set
            OR: [
              { room_id: roomId },
              { room_id: null, step: { room_id: roomId } },
            ],
          },
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

    return orderEntries(entries, rules, new Date(), {
      room_type: room?.room_type,
      specialty_id: room?.specialty_id,
    });
  }
}
