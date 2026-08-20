import { Injectable, Logger } from '@nestjs/common';
import { QueueStatusEnum, StepTypeEnum } from '@prisma/client';
import { PrismaService } from '../../shared/config/prisma.service';
import {
  OrderedQueueEntry,
  QueuePriorityService,
} from './queue-priority.service';

export interface EntryEtaInfo {
  queueId: string;
  position: number;
  etaSec: number;
  etaTime: string;
}

export interface RoomEtaResult {
  roomId: string;
  expectedDurationSec: number;
  currentServingRemainingSec: number;
  entries: EntryEtaInfo[];
  totalWaitingSec: number;
}

/**
 * Pure function to calculate Exponential Moving Average (EMA).
 */
export function calculateEma(
  currentEma: number | null,
  sampleCount: number,
  durationSec: number,
  alpha = 0.3,
): number {
  if (sampleCount === 0 || currentEma === null) {
    return durationSec;
  }
  return alpha * durationSec + (1 - alpha) * currentEma;
}

/**
 * Pure function to check if a service duration is an outlier.
 */
export function isOutlierDuration(
  durationSec: number,
  stepType: StepTypeEnum | null,
): boolean {
  if (durationSec < 30) return true; // accidental click
  if (
    stepType === StepTypeEnum.PROCEDURE ||
    stepType === StepTypeEnum.FUNCTIONAL_EXPLORATION
  ) {
    return durationSec > 14400; // > 4 hours
  }
  return durationSec > 7200; // > 2 hours
}

/**
 * Pure function to compute per-patient ETAs.
 */
export function computePatientEtas(
  servingStartedAt: Date | null,
  servingExpectedSec: number,
  waitingEntries: { queueId: string; stepType: StepTypeEnum | null }[],
  stepTypeExpectedSecMap: Map<StepTypeEnum | 'DEFAULT', number>,
  now: Date = new Date(),
): {
  remainingServingSec: number;
  entries: EntryEtaInfo[];
  totalWaitingSec: number;
} {
  let remainingServingSec = 0;
  if (servingStartedAt) {
    const elapsedSec = Math.max(
      0,
      (now.getTime() - servingStartedAt.getTime()) / 1000,
    );
    remainingServingSec = Math.max(
      0,
      Math.round(servingExpectedSec - elapsedSec),
    );
  }

  let accumulatedSec = remainingServingSec;
  const entries: EntryEtaInfo[] = [];

  for (let i = 0; i < waitingEntries.length; i++) {
    const entry = waitingEntries[i];
    const expectedSec =
      (entry.stepType && stepTypeExpectedSecMap.get(entry.stepType)) ||
      stepTypeExpectedSecMap.get('DEFAULT') ||
      900;

    const etaSec = Math.round(accumulatedSec);
    const etaTime = new Date(now.getTime() + etaSec * 1000).toISOString();

    entries.push({
      queueId: entry.queueId,
      position: i,
      etaSec,
      etaTime,
    });

    accumulatedSec += expectedSec;
  }

  const totalWaitingSec = Math.round(accumulatedSec);

  return {
    remainingServingSec,
    entries,
    totalWaitingSec,
  };
}

export type StatDurationInput = {
  sample_count: number;
  ema_duration_sec: number | null;
  default_duration_sec: number;
};

export function expectedSecFromStat(
  stat: StatDurationInput | null | undefined,
): number {
  if (stat && stat.sample_count >= 5 && stat.ema_duration_sec !== null) {
    return Math.round(stat.ema_duration_sec);
  }
  return stat?.default_duration_sec ?? 900;
}

export function buildStepTypeExpectedSecMap(
  stats: Array<StatDurationInput & { step_type: StepTypeEnum }>,
): Map<StepTypeEnum | 'DEFAULT', number> {
  const stepTypeExpectedSecMap = new Map<StepTypeEnum | 'DEFAULT', number>();
  for (const stat of stats) {
    stepTypeExpectedSecMap.set(stat.step_type, expectedSecFromStat(stat));
  }
  stepTypeExpectedSecMap.set('DEFAULT', 900);
  return stepTypeExpectedSecMap;
}

export type LightweightQueueForEta = {
  queue_id: string;
  room_id: string | null;
  status: QueueStatusEnum;
  serving_started_at: Date | null;
  step: { step_type: StepTypeEnum | null } | null;
};

export type RoomServiceStatForEta = StatDurationInput & {
  room_id: string;
  step_type: StepTypeEnum;
};

/**
 * Order-independent totalWaitingSec per room (same math as computeEtaForRoom).
 * Queues with room_id = null are ignored.
 */
export function computeTotalWaitingSecByRoom(
  queues: LightweightQueueForEta[],
  stats: RoomServiceStatForEta[],
  now: Date = new Date(),
): Map<string, number> {
  const statsByRoom = new Map<string, RoomServiceStatForEta[]>();
  for (const stat of stats) {
    const list = statsByRoom.get(stat.room_id) ?? [];
    list.push(stat);
    statsByRoom.set(stat.room_id, list);
  }

  const queuesByRoom = new Map<string, LightweightQueueForEta[]>();
  for (const q of queues) {
    if (!q.room_id) continue;
    const list = queuesByRoom.get(q.room_id) ?? [];
    list.push(q);
    queuesByRoom.set(q.room_id, list);
  }

  const result = new Map<string, number>();
  for (const [roomId, roomQueues] of queuesByRoom) {
    result.set(
      roomId,
      computeRoomTotalWaitingSec(
        roomQueues,
        statsByRoom.get(roomId) ?? [],
        now,
      ),
    );
  }
  return result;
}

/** Per-room totalWaitingSec using the same path as computeEtaForRoom (legacy loop). */
export function computeRoomTotalWaitingSec(
  roomQueues: LightweightQueueForEta[],
  roomStats: Array<StatDurationInput & { step_type: StepTypeEnum }>,
  now: Date = new Date(),
): number {
  const stepTypeExpectedSecMap = buildStepTypeExpectedSecMap(roomStats);
  const serving = roomQueues.find((q) => q.status === QueueStatusEnum.SERVING);
  const servingType = serving?.step?.step_type || StepTypeEnum.OTHER;
  const servingExpectedSec = stepTypeExpectedSecMap.get(servingType) ?? 900;
  const waiting = roomQueues.filter(
    (q) =>
      q.status === QueueStatusEnum.PENDING ||
      q.status === QueueStatusEnum.QUEUED,
  );
  const waitingInput = waiting.map((q) => ({
    queueId: q.queue_id,
    stepType: q.step?.step_type ?? null,
  }));
  return computePatientEtas(
    serving?.serving_started_at ?? null,
    servingExpectedSec,
    waitingInput,
    stepTypeExpectedSecMap,
    now,
  ).totalWaitingSec;
}

@Injectable()
export class QueueEtaService {
  private readonly logger = new Logger(QueueEtaService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly queuePriorityService: QueuePriorityService,
  ) {}

  async recordServiceDuration(
    roomId: string,
    stepType: StepTypeEnum | null,
    durationSec: number,
  ): Promise<void> {
    const type = stepType || StepTypeEnum.OTHER;
    if (isOutlierDuration(durationSec, type)) {
      this.logger.log(
        `Skipping outlier duration ${durationSec}s for room ${roomId}, stepType ${type}`,
      );
      return;
    }

    try {
      await this.prisma.$transaction(async (tx) => {
        const existingStat = await tx.room_Service_Stat.findUnique({
          where: {
            room_id_step_type: {
              room_id: roomId,
              step_type: type,
            },
          },
        });

        const newEma = calculateEma(
          existingStat?.ema_duration_sec ?? null,
          existingStat?.sample_count ?? 0,
          durationSec,
        );

        await tx.room_Service_Stat.upsert({
          where: {
            room_id_step_type: {
              room_id: roomId,
              step_type: type,
            },
          },
          update: {
            ema_duration_sec: newEma,
            sample_count: { increment: 1 },
          },
          create: {
            room_id: roomId,
            step_type: type,
            ema_duration_sec: newEma,
            sample_count: 1,
            default_duration_sec: 900,
          },
        });
      });
    } catch (err: any) {
      this.logger.warn(`Failed to record service duration: ${err.message}`);
    }
  }

  async getExpectedDurationSec(
    roomId: string,
    stepType: StepTypeEnum | null,
  ): Promise<number> {
    const type = stepType || StepTypeEnum.OTHER;
    const stat = await this.prisma.room_Service_Stat.findUnique({
      where: {
        room_id_step_type: {
          room_id: roomId,
          step_type: type,
        },
      },
    });

    return expectedSecFromStat(stat);
  }

  async computeEtaForRoom(
    roomId: string,
    preOrdered?: OrderedQueueEntry[],
  ): Promise<RoomEtaResult> {
    const now = new Date();

    const servingQueue = await this.prisma.queue.findFirst({
      where: {
        room_id: roomId,
        status: QueueStatusEnum.SERVING,
      },
      select: {
        serving_started_at: true,
        step: { select: { step_type: true } },
      },
    });

    const servingStepType = servingQueue?.step?.step_type ?? null;

    const orderedEntries =
      preOrdered ?? (await this.queuePriorityService.computeQueueOrder(roomId));

    const allStats = await this.prisma.room_Service_Stat.findMany({
      where: { room_id: roomId },
    });

    const stepTypeExpectedSecMap = buildStepTypeExpectedSecMap(allStats);
    const servingType = servingStepType || StepTypeEnum.OTHER;
    const servingExpectedSec = stepTypeExpectedSecMap.get(servingType) ?? 900;

    const waitingInput = orderedEntries.map((o) => ({
      queueId: o.queue.queue_id,
      stepType: o.queue.step?.step_type ?? null,
    }));

    const result = computePatientEtas(
      servingQueue?.serving_started_at ?? null,
      servingExpectedSec,
      waitingInput,
      stepTypeExpectedSecMap,
      now,
    );

    return {
      roomId,
      expectedDurationSec: servingExpectedSec,
      currentServingRemainingSec: result.remainingServingSec,
      entries: result.entries,
      totalWaitingSec: result.totalWaitingSec,
    };
  }

  async updateDefaultDurationSec(
    roomId: string,
    stepType: StepTypeEnum,
    defaultDurationSec: number,
  ): Promise<any> {
    const updated = await this.prisma.room_Service_Stat.upsert({
      where: {
        room_id_step_type: {
          room_id: roomId,
          step_type: stepType,
        },
      },
      update: {
        default_duration_sec: defaultDurationSec,
      },
      create: {
        room_id: roomId,
        step_type: stepType,
        default_duration_sec: defaultDurationSec,
      },
    });

    return updated;
  }
}
