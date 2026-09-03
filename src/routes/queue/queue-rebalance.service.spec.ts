import { QueueStatusEnum, StepTypeEnum } from '@prisma/client';
import {
  buildStepTypeExpectedSecMap,
  computePatientEtas,
  computeTotalWaitingSecByRoom,
  expectedSecFromStat,
  type LightweightQueueForEta,
  type RoomServiceStatForEta,
} from './queue-eta.service';
import {
  isEligibleRebalanceCandidate,
  QueueRebalanceService,
} from './queue-rebalance.service';
import type { OrderedQueueEntry } from './queue-priority.service';
import {
  QUEUE_REBALANCE_ENQUEUE_DEBOUNCE_MS,
  DEFAULT_REBALANCE_PARAMS,
  computeFairInsertAt,
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
    const serving = roomQueues.find(
      (q) => q.status === QueueStatusEnum.SERVING,
    );
    const waiting = roomQueues.filter(
      (q) => q.status === QueueStatusEnum.QUEUED,
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
    expect(nextGen.get(roomA)).toBe(0 + 481);
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
    prisma.queue_Rebalance_Suggestion.updateMany.mockResolvedValue({
      count: 0,
    });
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
      params: {
        enabled: false,
        eta_gap_minutes: 15,
        suggestion_ttl_minutes: 10,
      },
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
      queue_Priority_Rule: {
        findFirst: jest.fn().mockResolvedValue({ params: { enabled: false } }),
      },
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

function candidateEntry(overrides: {
  position: number;
  queue_id?: string;
  status?: QueueStatusEnum;
  is_pinned?: boolean;
  rebalance_locked?: boolean;
  step_type?: StepTypeEnum | null;
  service_code?: string | null;
}): OrderedQueueEntry {
  return {
    position: overrides.position,
    effectiveScore: 0,
    reasons: [],
    queue: {
      queue_id: overrides.queue_id ?? `q-${overrides.position}`,
      status: overrides.status ?? QueueStatusEnum.QUEUED,
      is_pinned: overrides.is_pinned ?? false,
      rebalance_locked: overrides.rebalance_locked ?? false,
      step: {
        step_type: overrides.step_type ?? StepTypeEnum.LAB_TEST,
        service_code: overrides.service_code ?? 'XN01',
      },
    },
  } as unknown as OrderedQueueEntry;
}

describe('isEligibleRebalanceCandidate', () => {
  it('skips the protected top 3 (position 0-2)', () => {
    expect(
      isEligibleRebalanceCandidate(candidateEntry({ position: 0 }), 'XN01'),
    ).toBe(false);
    expect(
      isEligibleRebalanceCandidate(candidateEntry({ position: 2 }), 'XN01'),
    ).toBe(false);
    expect(
      isEligibleRebalanceCandidate(candidateEntry({ position: 3 }), 'XN01'),
    ).toBe(true);
  });

  it('skips rebalance_locked queues', () => {
    expect(
      isEligibleRebalanceCandidate(
        candidateEntry({ position: 4, rebalance_locked: true }),
        'XN01',
      ),
    ).toBe(false);
  });
});

describe('computeFairInsertAt', () => {
  it('clamps insert index to at least 3 even when wait time would place first', () => {
    const dest = [
      { queue: { enqueued_at: new Date('2026-09-02T08:10:00.000Z') } },
      { queue: { enqueued_at: new Date('2026-09-02T08:20:00.000Z') } },
      { queue: { enqueued_at: new Date('2026-09-02T08:30:00.000Z') } },
    ];
    const transferred = new Date('2026-09-02T08:00:00.000Z');
    expect(computeFairInsertAt(dest, transferred)).toBe(3);
  });

  it('uses wait-time index when it is already past the top 3', () => {
    const dest = [
      { queue: { enqueued_at: new Date('2026-09-02T07:00:00.000Z') } },
      { queue: { enqueued_at: new Date('2026-09-02T07:10:00.000Z') } },
      { queue: { enqueued_at: new Date('2026-09-02T07:20:00.000Z') } },
      { queue: { enqueued_at: new Date('2026-09-02T07:30:00.000Z') } },
      { queue: { enqueued_at: new Date('2026-09-02T08:00:00.000Z') } },
    ];
    const transferred = new Date('2026-09-02T07:40:00.000Z');
    expect(computeFairInsertAt(dest, transferred)).toBe(4);
  });
});

describe('QueueRebalanceService.detectAndSuggest fairness', () => {
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

  function queuedLab(queueId: string, roomId: string) {
    return {
      queue_id: queueId,
      room_id: roomId,
      status: QueueStatusEnum.QUEUED,
      serving_started_at: null,
      step: { step_type: StepTypeEnum.LAB_TEST, service_code: 'XN01' },
    };
  }

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.queue_Rebalance_Suggestion.updateMany.mockResolvedValue({
      count: 0,
    });
    prisma.queue_Rebalance_Suggestion.findFirst.mockResolvedValue(null);
    prisma.queue_Rebalance_Suggestion.create.mockImplementation(
      async ({ data }: { data: { queue_id: string } }) => ({
        suggestion_id: `sug-${data.queue_id}`,
        ...data,
        queue: {
          queue_number: '10',
          step: { flow: { booking: { patient: { full_name: 'A' } } } },
        },
        fromRoom: { room_name: 'Busy' },
        toRoom: { room_name: 'Free' },
      }),
    );
    prisma.$transaction.mockImplementation(
      async (fn: (tx: typeof prisma) => Promise<unknown>) => fn(prisma),
    );
    queueCacheService.tryBeginRebalanceRun.mockResolvedValue(true);
    prisma.queue_Priority_Rule.findFirst.mockResolvedValue({
      params: { ...DEFAULT_REBALANCE_PARAMS },
    });
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
      queuedLab('wait-1', 'room-busy'),
      queuedLab('wait-2', 'room-busy'),
      queuedLab('wait-3', 'room-busy'),
      queuedLab('wait-4', 'room-busy'),
    ]);
    prisma.room_Service_Stat.findMany.mockResolvedValue([
      {
        room_id: 'room-busy',
        step_type: StepTypeEnum.LAB_TEST,
        sample_count: 5,
        ema_duration_sec: 600,
        default_duration_sec: 900,
      },
      {
        room_id: 'room-free',
        step_type: StepTypeEnum.LAB_TEST,
        sample_count: 5,
        ema_duration_sec: 600,
        default_duration_sec: 900,
      },
    ]);
    service = new QueueRebalanceService(
      prisma as never,
      queuePriorityService as never,
      queueService as never,
      queueGateway as never,
      queueCacheService as never,
    );
  });

  it('does not suggest top 3 waiting patients', async () => {
    queuePriorityService.computeQueueOrder.mockResolvedValue([
      candidateEntry({ position: 0, queue_id: 'q-0' }),
      candidateEntry({ position: 1, queue_id: 'q-1' }),
      candidateEntry({ position: 2, queue_id: 'q-2' }),
      candidateEntry({ position: 3, queue_id: 'q-3' }),
      candidateEntry({ position: 4, queue_id: 'q-4' }),
    ]);

    const result = await service.detectAndSuggest();

    expect(result.created).toBeGreaterThan(0);
    const createdIds = prisma.queue_Rebalance_Suggestion.create.mock.calls.map(
      (call: [{ data: { queue_id: string } }]) => call[0].data.queue_id,
    );
    expect(createdIds).not.toEqual(expect.arrayContaining(['q-0', 'q-1', 'q-2']));
    expect(createdIds).toEqual(expect.arrayContaining(['q-3', 'q-4']));
  });

  it('skips locked queues even when they sit after the top 3', async () => {
    queuePriorityService.computeQueueOrder.mockResolvedValue([
      candidateEntry({ position: 0, queue_id: 'q-0' }),
      candidateEntry({ position: 1, queue_id: 'q-1' }),
      candidateEntry({ position: 2, queue_id: 'q-2' }),
      candidateEntry({
        position: 3,
        queue_id: 'q-locked',
        rebalance_locked: true,
      }),
      candidateEntry({ position: 4, queue_id: 'q-4' }),
    ]);

    await service.detectAndSuggest();

    const createdIds = prisma.queue_Rebalance_Suggestion.create.mock.calls.map(
      (call: [{ data: { queue_id: string } }]) => call[0].data.queue_id,
    );
    expect(createdIds).toEqual(['q-4']);
  });

  it('reduces the ETA gap using the candidate LAB_TEST duration, not OTHER', async () => {
    queuePriorityService.computeQueueOrder.mockResolvedValue([
      candidateEntry({ position: 0, queue_id: 'q-0' }),
      candidateEntry({ position: 1, queue_id: 'q-1' }),
      candidateEntry({ position: 2, queue_id: 'q-2' }),
      candidateEntry({ position: 3, queue_id: 'q-3' }),
      candidateEntry({ position: 4, queue_id: 'q-4' }),
    ]);

    const result = await service.detectAndSuggest();

    // 4 * 600 waiting = 2400 gap. LAB_TEST 600+600=1200 → second candidate still over 900.
    // OTHER 900+900=1800 would stop after the first suggestion.
    expect(result.created).toBe(2);
  });
});

describe('QueueRebalanceService.confirmSuggestion fairness', () => {
  it('keeps enqueued_at, locks the queue, and inserts at max(3, wait-time index)', async () => {
    const queueUpdate = jest.fn().mockResolvedValue({});
    const notificationCreate = jest.fn();
    const prisma = {
      account: { findUnique: jest.fn().mockResolvedValue({ role: 'ADMIN' }) },
      queue_Rebalance_Suggestion: {
        findUnique: jest.fn().mockResolvedValue({
          suggestion_id: 'sug-1',
          from_room_id: 'room-a',
          to_room_id: 'room-b',
          status: 'PENDING',
          expires_at: new Date('2099-01-01'),
          queue_id: 'q-1',
          queue: {
            queue_id: 'q-1',
            step_id: 'step-1',
            queue_number: '105',
            status: QueueStatusEnum.QUEUED,
            enqueued_at: new Date('2026-09-02T08:05:00.000Z'),
            step: {
              flow: {
                booking: {
                  patient: { account_id: 'acc-1', full_name: 'A' },
                },
              },
            },
          },
          fromRoom: { room_name: 'Phòng A' },
          toRoom: { room_name: 'Phòng B' },
        }),
      },
      $transaction: jest.fn(),
    };
    const queuePriorityService = {
      computeQueueOrder: jest.fn().mockResolvedValue([
        { queue: { enqueued_at: new Date('2026-09-02T08:00:00.000Z') } },
        { queue: { enqueued_at: new Date('2026-09-02T08:10:00.000Z') } },
        { queue: { enqueued_at: new Date('2026-09-02T08:20:00.000Z') } },
        { queue: { enqueued_at: new Date('2026-09-02T08:30:00.000Z') } },
      ]),
    };
    const queueService = {
      generateQueueNumberForRoom: jest.fn().mockResolvedValue('88'),
      broadcastRoomUpdate: jest.fn().mockResolvedValue(undefined),
      assertCanManageRoom: jest.fn(),
    };
    const queueGateway = { emitRebalanceResolved: jest.fn() };

    prisma.$transaction.mockImplementation(
      async (fn: (tx: unknown) => Promise<unknown>) =>
        fn({
          step: { update: jest.fn() },
          queue: { update: queueUpdate },
          queue_Rebalance_Suggestion: { update: jest.fn() },
          move_Log: { create: jest.fn() },
          notification: { create: notificationCreate },
        }),
    );

    const service = new QueueRebalanceService(
      prisma as never,
      queuePriorityService as never,
      queueService as never,
      queueGateway as never,
      { tryBeginRebalanceRun: jest.fn() } as never,
    );

    await service.confirmSuggestion('sug-1', { id: 'admin', role: 'ADMIN' });

    const data = queueUpdate.mock.calls[0][0].data as Record<string, unknown>;
    expect(data.enqueued_at).toBeUndefined();
    expect(data.rebalance_locked).toBe(true);
    expect(data.hold_positions).toBe(3);
    expect(data.queue_number).toBe('88');
    expect(notificationCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          message: expect.stringMatching(
            /Để giảm thời gian chờ[\s\S]*phòng Phòng B[\s\S]*Số thứ tự mới: 88/,
          ),
        }),
      }),
    );
    expect(queueService.broadcastRoomUpdate).toHaveBeenCalledWith('room-a');
    expect(queueService.broadcastRoomUpdate).toHaveBeenCalledWith('room-b');
    expect(queueGateway.emitRebalanceResolved).toHaveBeenCalled();
  });
});
