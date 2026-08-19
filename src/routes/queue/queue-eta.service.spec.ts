import { StepTypeEnum } from '@prisma/client';
import {
  calculateEma,
  computePatientEtas,
  expectedSecFromStat,
  isOutlierDuration,
  QueueEtaService,
} from './queue-eta.service';

describe('QueueEtaService Pure Functions', () => {
  describe('calculateEma', () => {
    it('should return durationSec when sampleCount is 0 or currentEma is null', () => {
      expect(calculateEma(null, 0, 600)).toBe(600);
      expect(calculateEma(900, 0, 600)).toBe(600);
    });

    it('should calculate EMA using 0.3 * duration + 0.7 * currentEma when sampleCount > 0', () => {
      // 0.3 * 600 + 0.7 * 1000 = 180 + 700 = 880
      expect(calculateEma(1000, 1, 600)).toBeCloseTo(880, 2);
    });
  });

  describe('isOutlierDuration', () => {
    it('should return true for durations under 30 seconds', () => {
      expect(isOutlierDuration(20, StepTypeEnum.OTHER)).toBe(true);
      expect(isOutlierDuration(29, StepTypeEnum.CLINICAL)).toBe(true);
    });

    it('should return false for normal durations', () => {
      expect(isOutlierDuration(600, StepTypeEnum.CLINICAL)).toBe(false);
      expect(isOutlierDuration(3600, StepTypeEnum.OTHER)).toBe(false);
    });

    it('should return true for normal step types with duration > 7200 seconds', () => {
      expect(isOutlierDuration(7201, StepTypeEnum.CLINICAL)).toBe(true);
      expect(isOutlierDuration(7201, StepTypeEnum.LAB_TEST)).toBe(true);
    });

    it('should allow PROCEDURE and FUNCTIONAL_EXPLORATION up to 14400 seconds', () => {
      expect(isOutlierDuration(10000, StepTypeEnum.PROCEDURE)).toBe(false);
      expect(isOutlierDuration(10000, StepTypeEnum.FUNCTIONAL_EXPLORATION)).toBe(false);
      expect(isOutlierDuration(14401, StepTypeEnum.PROCEDURE)).toBe(true);
    });
  });

  describe('computePatientEtas', () => {
    const now = new Date('2026-08-04T10:00:00.000Z');

    it('should calculate remaining serving time and accumulate ETAs correctly', () => {
      const servingStartedAt = new Date('2026-08-04T09:55:00.000Z'); // 5 mins elapsed (300s)
      const servingExpectedSec = 900; // 15 mins total -> 10 mins (600s) remaining

      const waitingEntries = [
        { queueId: 'q1', stepType: StepTypeEnum.CLINICAL },
        { queueId: 'q2', stepType: StepTypeEnum.LAB_TEST },
      ];

      const stepTypeMap = new Map<StepTypeEnum | 'DEFAULT', number>([
        [StepTypeEnum.CLINICAL, 600], // 10 mins
        [StepTypeEnum.LAB_TEST, 300], // 5 mins
        ['DEFAULT', 900],
      ]);

      const result = computePatientEtas(servingStartedAt, servingExpectedSec, waitingEntries, stepTypeMap, now);

      expect(result.remainingServingSec).toBe(600); // 600s remaining for current serving
      expect(result.entries.length).toBe(2);

      // Entry 0 (q1): starts after remaining serving (600s)
      expect(result.entries[0].queueId).toBe('q1');
      expect(result.entries[0].position).toBe(0);
      expect(result.entries[0].etaSec).toBe(600);

      // Entry 1 (q2): starts after q1 (600s + 600s = 1200s)
      expect(result.entries[1].queueId).toBe('q2');
      expect(result.entries[1].position).toBe(1);
      expect(result.entries[1].etaSec).toBe(1200);

      // Total waiting sec: 1200s + 300s (q2 duration) = 1500s
      expect(result.totalWaitingSec).toBe(1500);
    });
  });

  describe('expectedSecFromStat', () => {
    it('uses rounded EMA when sample_count >= 5 and ema is set', () => {
      expect(
        expectedSecFromStat({
          sample_count: 5,
          ema_duration_sec: 610.4,
          default_duration_sec: 900,
        }),
      ).toBe(610);
    });

    it('uses default_duration_sec when sample_count < 5', () => {
      expect(
        expectedSecFromStat({
          sample_count: 4,
          ema_duration_sec: 610.4,
          default_duration_sec: 800,
        }),
      ).toBe(800);
    });

    it('uses default_duration_sec when ema is null even if sample_count >= 5', () => {
      expect(
        expectedSecFromStat({
          sample_count: 10,
          ema_duration_sec: null,
          default_duration_sec: 700,
        }),
      ).toBe(700);
    });

    it('falls back to 900 when stat is missing', () => {
      expect(expectedSecFromStat(undefined)).toBe(900);
      expect(expectedSecFromStat(null)).toBe(900);
    });
  });
});

describe('QueueEtaService.computeEtaForRoom', () => {
  const prisma = {
    queue: { findFirst: jest.fn() },
    room_Service_Stat: { findMany: jest.fn() },
  };
  const queuePriorityService = {
    computeQueueOrder: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.queue.findFirst.mockResolvedValue(null);
    prisma.room_Service_Stat.findMany.mockResolvedValue([]);
    queuePriorityService.computeQueueOrder.mockResolvedValue([]);
  });

  it('skips computeQueueOrder when preOrdered is provided', async () => {
    const service = new QueueEtaService(
      prisma as never,
      queuePriorityService as never,
    );
    const preOrdered = [
      {
        queue: { queue_id: 'q1', step: { step_type: StepTypeEnum.LAB_TEST } },
        effectiveScore: 0,
        position: 0,
        reasons: [],
      },
    ];

    await service.computeEtaForRoom('room-1', preOrdered as never);

    expect(queuePriorityService.computeQueueOrder).not.toHaveBeenCalled();
  });

  it('calls computeQueueOrder when preOrdered is omitted', async () => {
    const service = new QueueEtaService(
      prisma as never,
      queuePriorityService as never,
    );

    await service.computeEtaForRoom('room-1');

    expect(queuePriorityService.computeQueueOrder).toHaveBeenCalledWith('room-1');
  });
});
