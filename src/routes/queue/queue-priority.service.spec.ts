import {
  GenderTypeEnum,
  Queue,
  Queue_Priority_Rule,
  QueueRuleTypeEnum,
  QueueStatusEnum,
  QueueTypeEnum,
} from '@prisma/client';
import { matchConditions, orderEntries } from './queue-priority.service';

describe('QueuePriorityService Pure Functions', () => {
  describe('matchConditions', () => {
    it('should return true for null, undefined or empty conditions', () => {
      expect(matchConditions(null, { age: 10 })).toBe(true);
      expect(matchConditions(undefined, { age: 10 })).toBe(true);
      expect(matchConditions({}, { age: 10 })).toBe(true);
    });

    it('should evaluate eq operator correctly', () => {
      expect(
        matchConditions(
          { appointment_on_time: { eq: true } },
          { appointment_on_time: true },
        ),
      ).toBe(true);
      expect(
        matchConditions(
          { appointment_on_time: { eq: true } },
          { appointment_on_time: false },
        ),
      ).toBe(false);
    });

    it('should evaluate neq operator correctly', () => {
      expect(
        matchConditions({ gender: { neq: 'MALE' } }, { gender: 'FEMALE' }),
      ).toBe(true);
      expect(
        matchConditions({ gender: { neq: 'MALE' } }, { gender: 'MALE' }),
      ).toBe(false);
    });

    it('should evaluate gt and gte operators correctly', () => {
      expect(
        matchConditions({ temperature: { gt: 38.5 } }, { temperature: 39.0 }),
      ).toBe(true);
      expect(
        matchConditions({ temperature: { gt: 38.5 } }, { temperature: 38.5 }),
      ).toBe(false);
      expect(
        matchConditions({ temperature: { gte: 39.0 } }, { temperature: 39.0 }),
      ).toBe(true);
      expect(
        matchConditions({ temperature: { gte: 39.0 } }, { temperature: 38.9 }),
      ).toBe(false);
    });

    it('should evaluate lt and lte operators correctly', () => {
      expect(matchConditions({ age: { lte: 6 } }, { age: 6 })).toBe(true);
      expect(matchConditions({ age: { lte: 6 } }, { age: 5 })).toBe(true);
      expect(matchConditions({ age: { lte: 6 } }, { age: 7 })).toBe(false);
      expect(matchConditions({ age: { lt: 6 } }, { age: 6 })).toBe(false);
    });

    it('should evaluate in operator correctly', () => {
      expect(
        matchConditions(
          { queue_type: { in: ['RETURNING', 'QUICK_TASK'] } },
          { queue_type: 'RETURNING' },
        ),
      ).toBe(true);
      expect(
        matchConditions(
          { queue_type: { in: ['RETURNING', 'QUICK_TASK'] } },
          { queue_type: 'NEW' },
        ),
      ).toBe(false);
    });

    it('should return false if fact field is null or undefined', () => {
      expect(
        matchConditions({ temperature: { gte: 39 } }, { temperature: null }),
      ).toBe(false);
      expect(matchConditions({ age: { lte: 6 } }, {})).toBe(false);
    });

    it('should return false for unknown operator or invalid format', () => {
      expect(matchConditions({ age: { invalid_op: 5 } }, { age: 5 })).toBe(
        false,
      );
    });
  });

  describe('orderEntries', () => {
    const now = new Date('2026-08-04T10:00:00Z');

    const defaultRuleAging: Queue_Priority_Rule = {
      rule_id: 'rule-aging',
      rule_code: 'AGING_DEFAULT',
      name: 'Aging',
      description: null,
      rule_type: QueueRuleTypeEnum.AGING,
      conditions: null,
      weight: 0,
      aging_rate: 0.2,
      max_aging: 15,
      params: null,
      room_type: null,
      specialty_id: null,
      is_active: true,
      created_at: now,
      updated_at: now,
    };

    function createMockQueue(partial: Partial<Queue>): Queue {
      return {
        queue_id: partial.queue_id || 'q-1',
        step_id: 'step-1',
        queue_number: partial.queue_number || '1',
        status: QueueStatusEnum.QUEUED,
        room_id: 'room-1',
        queue_type: partial.queue_type || QueueTypeEnum.NEW,
        base_priority: partial.base_priority ?? 0,
        applied_rules: partial.applied_rules ?? [],
        is_pinned: partial.is_pinned ?? false,
        pinned_at: partial.pinned_at ?? null,
        hold_positions: partial.hold_positions ?? null,
        enqueued_at: partial.enqueued_at ?? now,
        called_at: null,
        serving_started_at: null,
        finished_at: null,
        missed_at: null,
        missed_count: 0,
        created_at: now,
        updated_at: now,
      };
    }

    it('should return empty array for empty entries', () => {
      expect(orderEntries([], [defaultRuleAging], now)).toEqual([]);
    });

    it('should order entries by effectiveScore DESC, then enqueued_at ASC', () => {
      const q1 = createMockQueue({
        queue_id: 'q1',
        queue_number: '1',
        base_priority: 5,
        enqueued_at: new Date('2026-08-04T09:50:00Z'), // 10m waiting -> +2 aging -> effective = 7
      });
      const q2 = createMockQueue({
        queue_id: 'q2',
        queue_number: '2',
        base_priority: 10,
        enqueued_at: new Date('2026-08-04T09:59:00Z'), // 1m waiting -> +0.2 aging -> effective = 10.2
      });

      const result = orderEntries([q1, q2], [defaultRuleAging], now);

      expect(result[0].queue.queue_id).toBe('q2');
      expect(result[1].queue.queue_id).toBe('q1');
    });

    it('should allow aging to overcome base priority when waiting time is long enough', () => {
      const qHighPriorityNew = createMockQueue({
        queue_id: 'q-new-high',
        queue_number: '1',
        base_priority: 6,
        enqueued_at: new Date('2026-08-04T09:59:00Z'), // 1m wait -> 6 + 0.2 = 6.2
      });
      const qLowPriorityOld = createMockQueue({
        queue_id: 'q-old-low',
        queue_number: '2',
        base_priority: 0,
        enqueued_at: new Date('2026-08-04T09:20:00Z'), // 40m wait -> 0 + 8.0 = 8.0
      });

      const result = orderEntries(
        [qHighPriorityNew, qLowPriorityOld],
        [defaultRuleAging],
        now,
      );

      expect(result[0].queue.queue_id).toBe('q-old-low');
      expect(result[1].queue.queue_id).toBe('q-new-high');
    });

    it('should respect max_aging cap', () => {
      const qWaiting150Mins = createMockQueue({
        queue_id: 'q-old',
        queue_number: '1',
        base_priority: 0,
        enqueued_at: new Date('2026-08-04T07:30:00Z'), // 150m wait -> 0.2*150 = 30, capped at 15
      });
      const qEmergencyNew = createMockQueue({
        queue_id: 'q-acute',
        queue_number: '2',
        base_priority: 20,
        enqueued_at: new Date('2026-08-04T09:59:00Z'), // 20 + 0.2 = 20.2
      });

      const result = orderEntries(
        [qWaiting150Mins, qEmergencyNew],
        [defaultRuleAging],
        now,
      );

      expect(result[0].queue.queue_id).toBe('q-acute');
      expect(result[0].effectiveScore).toBeCloseTo(20.2, 1);
      expect(result[1].queue.queue_id).toBe('q-old');
      expect(result[1].effectiveScore).toBe(15.0); // capped
    });

    it('should place pinned entries at top and order pinned entries by pinned_at ASC', () => {
      const qRegular = createMockQueue({
        queue_id: 'q-reg',
        base_priority: 10,
      });
      const qPinnedLater = createMockQueue({
        queue_id: 'q-pin-2',
        is_pinned: true,
        pinned_at: new Date('2026-08-04T09:55:00Z'),
      });
      const qPinnedEarlier = createMockQueue({
        queue_id: 'q-pin-1',
        is_pinned: true,
        pinned_at: new Date('2026-08-04T09:50:00Z'),
      });

      const result = orderEntries(
        [qRegular, qPinnedLater, qPinnedEarlier],
        [defaultRuleAging],
        now,
      );

      expect(result[0].queue.queue_id).toBe('q-pin-1');
      expect(result[1].queue.queue_id).toBe('q-pin-2');
      expect(result[2].queue.queue_id).toBe('q-reg');
      expect(result[0].reasons).toContain('PINNED');
    });

    it('should interleave regular and returning/quick task entries 1-1', () => {
      const r1 = createMockQueue({
        queue_id: 'r1',
        queue_number: 'R1',
        base_priority: 5,
      });
      const r2 = createMockQueue({
        queue_id: 'r2',
        queue_number: 'R2',
        base_priority: 4,
      });
      const r3 = createMockQueue({
        queue_id: 'r3',
        queue_number: 'R3',
        base_priority: 3,
      });

      const i1 = createMockQueue({
        queue_id: 'i1',
        queue_number: 'I1',
        queue_type: QueueTypeEnum.RETURNING,
        base_priority: 2,
      });
      const i2 = createMockQueue({
        queue_id: 'i2',
        queue_number: 'I2',
        queue_type: QueueTypeEnum.QUICK_TASK,
        base_priority: 1,
      });

      const result = orderEntries(
        [r1, r2, r3, i1, i2],
        [defaultRuleAging],
        now,
      );
      const orderedIds = result.map((r) => r.queue.queue_id);

      expect(orderedIds).toEqual(['r1', 'i1', 'r2', 'i2', 'r3']);
    });

    it('should enforce hold_positions shifting held entries down', () => {
      const entries = [
        createMockQueue({ queue_id: 'q0', base_priority: 10 }),
        createMockQueue({
          queue_id: 'q1',
          base_priority: 9,
          hold_positions: 3,
        }),
        createMockQueue({ queue_id: 'q2', base_priority: 8 }),
        createMockQueue({ queue_id: 'q3', base_priority: 7 }),
        createMockQueue({ queue_id: 'q4', base_priority: 6 }),
      ];

      const result = orderEntries(entries, [defaultRuleAging], now);
      const orderedIds = result.map((r) => r.queue.queue_id);

      // q1 had hold_positions = 3, so it should be moved to index 3
      expect(orderedIds[3]).toBe('q1');
      expect(result.find((r) => r.queue.queue_id === 'q1')?.position).toBe(3);
    });

    it('should handle multiple entries with different hold_positions in descending order', () => {
      const entries = [
        createMockQueue({ queue_id: 'q0', base_priority: 10 }),
        createMockQueue({
          queue_id: 'q1',
          base_priority: 9,
          hold_positions: 3,
        }),
        createMockQueue({
          queue_id: 'q2',
          base_priority: 8,
          hold_positions: 4,
        }),
        createMockQueue({ queue_id: 'q3', base_priority: 7 }),
        createMockQueue({ queue_id: 'q4', base_priority: 6 }),
        createMockQueue({ queue_id: 'q5', base_priority: 5 }),
      ];

      const result = orderEntries(entries, [defaultRuleAging], now);
      expect(result.length).toBe(6);
      expect(
        result.find((r) => r.queue.queue_id === 'q1')?.position,
      ).toBeGreaterThanOrEqual(3);
      expect(
        result.find((r) => r.queue.queue_id === 'q2')?.position,
      ).toBeGreaterThanOrEqual(4);
    });

    it('should handle edge cases: list with only interleave entries or only pinned entries', () => {
      const i1 = createMockQueue({
        queue_id: 'i1',
        queue_type: QueueTypeEnum.RETURNING,
        base_priority: 5,
      });
      const i2 = createMockQueue({
        queue_id: 'i2',
        queue_type: QueueTypeEnum.QUICK_TASK,
        base_priority: 3,
      });

      const resInterleave = orderEntries([i1, i2], [defaultRuleAging], now);
      expect(resInterleave.map((r) => r.queue.queue_id)).toEqual(['i1', 'i2']);

      const p1 = createMockQueue({
        queue_id: 'p1',
        is_pinned: true,
        pinned_at: new Date('2026-08-04T09:00:00Z'),
      });
      const p2 = createMockQueue({
        queue_id: 'p2',
        is_pinned: true,
        pinned_at: new Date('2026-08-04T09:05:00Z'),
      });

      const resPinned = orderEntries([p1, p2], [defaultRuleAging], now);
      expect(resPinned.map((r) => r.queue.queue_id)).toEqual(['p1', 'p2']);
    });
  });
});
