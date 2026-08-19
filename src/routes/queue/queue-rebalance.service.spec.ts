import {
  QueueStatusEnum,
  StepTypeEnum,
} from '@prisma/client';
import {
  buildStepTypeExpectedSecMap,
  computePatientEtas,
  computeTotalWaitingSecByRoom,
  expectedSecFromStat,
  type LightweightQueueForEta,
  type RoomServiceStatForEta,
} from './queue-eta.service';
import { QueueRebalanceService } from './queue-rebalance.service';
import {
  QUEUE_REBALANCE_ENQUEUE_DEBOUNCE_MS,
  DEFAULT_REBALANCE_PARAMS,
} from './queue.constants';

function legacyTotalWaitingSecByRoom(
  queues: LightweightQueueForEta[],
  stats: RoomServiceStatForEta[],
  now: Date,
): Map<string, number> {
  const roomIds = new Set<string>();
  for (const q of queues) {
    if (q.room_id) roomIds.add(q.room_id);
  }

  const result = new Map<string, number>();
  for (const roomId of roomIds) {
    const roomQueues = queues.filter((q) => q.room_id === roomId);
    const serving = roomQueues.find((q) => q.status === QueueStatusEnum.SERVING);
    const waiting = roomQueues.filter(
      (q) =>
        q.status === QueueStatusEnum.PENDING ||
        q.status === QueueStatusEnum.QUEUED,
    );
    const roomStats = stats.filter((s) => s.room_id === roomId);
    const stepMap = buildStepTypeExpectedSecMap(roomStats);
    const servingType = serving?.step?.step_type || StepTypeEnum.OTHER;
    const servingExpectedSec = expectedSecFromStat(
      roomStats.find((s) => s.step_type === servingType),
    );
    result.set(
      roomId,
      computePatientEtas(
        serving?.serving_started_at ?? null,
        servingExpectedSec,
        waiting.map((q) => ({
          queueId: q.queue_id,
          stepType: q.step?.step_type ?? null,
        })),
        stepMap,
        now,
      ).totalWaitingSec,
    );
  }
  return result;
}

function assertMapsEqual(
  actual: Map<string, number>,
  expected: Map<string, number>,
) {
  expect([...actual.keys()].sort()).toEqual([...expected.keys()].sort());
  for (const [roomId, sec] of expected) {
    expect(actual.get(roomId)).toBe(sec);
  }
}

describe('rebalance totalWaitingSec aggregate vs legacy computeEtaForRoom loop', () => {
  const now = new Date('2026-08-19T08:00:00.000Z');
  const roomA = 'room-a';
  const roomB = 'room-b';

  it('matches on mixed rooms including empty, SERVING without started_at, sample_count around 5, missing stat, and room_id null', () => {
    const queues: LightweightQueueForEta[] = [
      {
        queue_id: 'serve-a',
        room_id: roomA,
        status: QueueStatusEnum.SERVING,
        serving_started_at: null,
        step: { step_type: StepTypeEnum.LAB_TEST },
      },
      {
        queue_id: 'wait-a-1',
        room_id: roomA,
        status: QueueStatusEnum.QUEUED,
        serving_started_at: null,
        step: { step_type: StepTypeEnum.LAB_TEST },
      },
      {
        queue_id: 'wait-a-2',
        room_id: roomA,
        status: QueueStatusEnum.PENDING,
        serving_started_at: null,
        step: { step_type: StepTypeEnum.IMAGING },
      },
      {
        queue_id: 'serve-b',
        room_id: roomB,
        status: QueueStatusEnum.SERVING,
        serving_started_at: new Date('2026-08-19T07:50:00.000Z'),
        step: { step_type: StepTypeEnum.PROCEDURE },
      },
      {
        queue_id: 'wait-b',
        room_id: roomB,
        status: QueueStatusEnum.QUEUED,
        serving_started_at: null,
        step: { step_type: null },
      },
      {
        queue_id: 'orphan',
        room_id: null,
        status: QueueStatusEnum.QUEUED,
        serving_started_at: null,
        step: { step_type: StepTypeEnum.LAB_TEST },
      },
    ];

    const stats: RoomServiceStatForEta[] = [
      {
        room_id: roomA,
        step_type: StepTypeEnum.LAB_TEST,
        sample_count: 5,
        ema_duration_sec: 480.6,
        default_duration_sec: 900,
      },
      {
        room_id: roomA,
        step_type: StepTypeEnum.IMAGING,
        sample_count: 4,
        ema_duration_sec: 300,
        default_duration_sec: 720,
      },
      {
        room_id: roomB,
        step_type: StepTypeEnum.PROCEDURE,
        sample_count: 10,
        ema_duration_sec: null,
        default_duration_sec: 600,
      },
    ];

    const nextGen = computeTotalWaitingSecByRoom(queues, stats, now);
    const legacy = legacyTotalWaitingSecByRoom(queues, stats, now);

    assertMapsEqual(nextGen, legacy);
    expect(nextGen.has('orphan')).toBe(false);
    expect(nextGen.get(roomA)).toBe(
      0 + 481 + 720,
    );
  });

  it('returns 0 for a room with no queues (callers use ?? 0)', () => {
    const nextGen = computeTotalWaitingSecByRoom([], [], now);
    expect(nextGen.size).toBe(0);
    expect(nextGen.get('empty-room') ?? 0).toBe(0);
  });

  it('matches when serving elapsed exceeds expected duration', () => {
    const queues: LightweightQueueForEta[] = [
      {
        queue_id: 'serve',
        room_id: roomA,
        status: QueueStatusEnum.SERVING,
        serving_started_at: new Date('2026-08-19T07:00:00.000Z'),
        step: { step_type: StepTypeEnum.LAB_TEST },
      },
      {
        queue_id: 'wait',
        room_id: roomA,
        status: QueueStatusEnum.QUEUED,
        serving_started_at: null,
        step: { step_type: StepTypeEnum.OTHER },
      },
    ];
    const stats: RoomServiceStatForEta[] = [
      {
        room_id: roomA,
        step_type: StepTypeEnum.LAB_TEST,
        sample_count: 5,
        ema_duration_sec: 600,
        default_duration_sec: 900,
      },
    ];
    assertMapsEqual(
      computeTotalWaitingSecByRoom(queues, stats, now),
      legacyTotalWaitingSecByRoom(queues, stats, now),
    );
  });
});

describe('QueueRebalanceService.detectAndSuggest', () => {
  const prisma = {
    queue_Priority_Rule: { findFirst: jest.fn() },
    queue: { findMany: jest.fn() },
    room_Service_Stat: { findMany: jest.fn() },
    room_Service: { findMany: jest.fn() },
    queue_Rebalance_Suggestion: {
      updateMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  };
  const queuePriorityService = { computeQueueOrder: jest.fn() };
  const queueService = {};
  const queueGateway = {
    emitRebalanceSuggestion: jest.fn(),
    emitRebalanceResolved: jest.fn(),
  };
  const queueCacheService = { tryBeginRebalanceRun: jest.fn() };

  let service: QueueRebalanceService;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.queue.findMany.mockResolvedValue([]);
    prisma.room_Service_Stat.findMany.mockResolvedValue([]);
    prisma.room_Service.findMany.mockResolvedValue([]);
    prisma.queue_Rebalance_Suggestion.updateMany.mockResolvedValue({ count: 0 });
    queueCacheService.tryBeginRebalanceRun.mockResolvedValue(true);
    queuePriorityService.computeQueueOrder.mockResolvedValue([]);
    prisma.queue_Priority_Rule.findFirst.mockResolvedValue({
      params: { ...DEFAULT_REBALANCE_PARAMS },
    });
    service = new QueueRebalanceService(
      prisma as never,
      queuePriorityService as never,
      queueService as never,
      queueGateway as never,
      queueCacheService as never,
    );
  });

  it('returns early when enabled is false before any heavy query', async () => {
    prisma.queue_Priority_Rule.findFirst.mockResolvedValue({
      params: { enabled: false, eta_gap_minutes: 15, suggestion_ttl_minutes: 10 },
    });

    const result = await service.detectAndSuggest();

    expect(result).toEqual({ created: 0 });
    expect(prisma.queue.findMany).not.toHaveBeenCalled();
    expect(prisma.room_Service.findMany).not.toHaveBeenCalled();
    expect(prisma.room_Service_Stat.findMany).not.toHaveBeenCalled();
    expect(queueCacheService.tryBeginRebalanceRun).not.toHaveBeenCalled();
    expect(queuePriorityService.computeQueueOrder).not.toHaveBeenCalled();
  });

  it('does not call computeQueueOrder when no service group exceeds the gap', async () => {
    prisma.room_Service.findMany.mockResolvedValue([
      {
        room_id: 'room-a',
        service_id: 'svc-1',
        service: { service_code: 'XN01' },
      },
      {
        room_id: 'room-b',
        service_id: 'svc-1',
        service: { service_code: 'XN01' },
      },
    ]);
    prisma.queue.findMany.mockResolvedValue([
      {
        queue_id: 'q1',
        room_id: 'room-a',
        status: QueueStatusEnum.QUEUED,
        serving_started_at: null,
        step: { step_type: StepTypeEnum.LAB_TEST, service_code: 'XN01' },
      },
      {
        queue_id: 'q2',
        room_id: 'room-b',
        status: QueueStatusEnum.QUEUED,
        serving_started_at: null,
        step: { step_type: StepTypeEnum.LAB_TEST, service_code: 'XN01' },
      },
    ]);

    await service.detectAndSuggest();

    expect(prisma.queue.findMany).toHaveBeenCalledTimes(1);
    expect(queuePriorityService.computeQueueOrder).not.toHaveBeenCalled();
  });

  it('calls computeQueueOrder only for the most congested room of a group over the gap', async () => {
    prisma.room_Service.findMany.mockResolvedValue([
      {
        room_id: 'room-busy',
        service_id: 'svc-1',
        service: { service_code: 'XN01' },
      },
      {
        room_id: 'room-free',
        service_id: 'svc-1',
        service: { service_code: 'XN01' },
      },
    ]);
    prisma.queue.findMany.mockResolvedValue([
      {
        queue_id: 'q1',
        room_id: 'room-busy',
        status: QueueStatusEnum.QUEUED,
        serving_started_at: null,
        step: { step_type: StepTypeEnum.LAB_TEST, service_code: 'XN01' },
      },
      {
        queue_id: 'q2',
        room_id: 'room-busy',
        status: QueueStatusEnum.QUEUED,
        serving_started_at: null,
        step: { step_type: StepTypeEnum.LAB_TEST, service_code: 'XN01' },
      },
    ]);

    await service.detectAndSuggest();

    expect(queuePriorityService.computeQueueOrder).toHaveBeenCalledTimes(1);
    expect(queuePriorityService.computeQueueOrder).toHaveBeenCalledWith(
      'room-busy',
    );
  });
});

describe('QueueRebalanceService.scheduleDetectAndSuggest debounce', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('coalesces multiple post-enqueue triggers into a single run after 15s', async () => {
    const prisma = {
      queue_Priority_Rule: { findFirst: jest.fn().mockResolvedValue({ params: { enabled: false } }) },
      queue: { findMany: jest.fn() },
      room_Service_Stat: { findMany: jest.fn() },
      room_Service: { findMany: jest.fn() },
      queue_Rebalance_Suggestion: { updateMany: jest.fn() },
    };
    const service = new QueueRebalanceService(
      prisma as never,
      { computeQueueOrder: jest.fn() } as never,
      {} as never,
      {} as never,
      { tryBeginRebalanceRun: jest.fn() } as never,
    );
    const spy = jest.spyOn(service, 'detectAndSuggest').mockResolvedValue({
      created: 0,
    });

    service.scheduleDetectAndSuggest();
    service.scheduleDetectAndSuggest();
    service.scheduleDetectAndSuggest();

    jest.advanceTimersByTime(QUEUE_REBALANCE_ENQUEUE_DEBOUNCE_MS - 1);
    expect(spy).not.toHaveBeenCalled();

    jest.advanceTimersByTime(1);
    expect(spy).toHaveBeenCalledTimes(1);

    await Promise.resolve();
  });
});
