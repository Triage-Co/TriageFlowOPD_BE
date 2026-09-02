import {
  BadRequestException,
  ForbiddenException,
  forwardRef,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  QueueRuleTypeEnum,
  QueueStatusEnum,
  RebalanceSuggestionStatusEnum,
  RoleTypeEnum,
} from '@prisma/client';
import { PrismaService } from '../../shared/config/prisma.service';
import { QueueGateway } from '../../shared/gateways/queue.gateway';
import {
  computeTotalWaitingSecByRoom,
  expectedSecFromStat,
} from './queue-eta.service';
import { QueuePriorityService } from './queue-priority.service';
import type { OrderedQueueEntry } from './queue-priority.service';
import { QueueService } from './queue.service';
import { QueueCacheService } from './queue-cache.service';
import {
  computeFairInsertAt,
  DEFAULT_REBALANCE_PARAMS,
  QUEUE_REBALANCE_ENQUEUE_DEBOUNCE_MS,
  REBALANCE_PROTECTED_TOP_N,
  REBALANCEABLE_STEP_TYPES,
  toRebalanceConfig,
} from './queue.constants';

export { REBALANCEABLE_STEP_TYPES } from './queue.constants';

export function isEligibleRebalanceCandidate(
  entry: OrderedQueueEntry,
  serviceCode: string,
): boolean {
  if (entry.position < REBALANCE_PROTECTED_TOP_N) {
    return false;
  }
  const q = entry.queue;
  if (q.rebalance_locked) {
    return false;
  }
  if (q.is_pinned) {
    return false;
  }
  if (q.status !== QueueStatusEnum.QUEUED) {
    return false;
  }
  const step = q.step;
  const stepType = step?.step_type ?? undefined;
  const stepServiceCode = step?.service_code ?? null;
  if (stepServiceCode !== serviceCode) {
    return false;
  }
  if (!stepType || !REBALANCEABLE_STEP_TYPES.includes(stepType)) {
    return false;
  }
  return true;
}

@Injectable()
export class QueueRebalanceService {
  private readonly logger = new Logger(QueueRebalanceService.name);
  private isRunning = false;
  private coalesceQueued = false;
  private enqueueDebounceTimer: ReturnType<typeof setTimeout> | undefined;

  constructor(
    private readonly prisma: PrismaService,
    private readonly queuePriorityService: QueuePriorityService,

    @Inject(forwardRef(() => QueueService))
    private readonly queueService: QueueService,

    @Inject(forwardRef(() => QueueGateway))
    private readonly queueGateway: QueueGateway,

    private readonly queueCacheService: QueueCacheService,
  ) {}

  /**
   * Trailing debounce for post-enqueue trigger: many enqueues in 15s run once.
   */
  scheduleDetectAndSuggest(): void {
    if (this.enqueueDebounceTimer) {
      clearTimeout(this.enqueueDebounceTimer);
    }
    this.enqueueDebounceTimer = setTimeout(() => {
      this.enqueueDebounceTimer = undefined;
      this.detectAndSuggest().catch((err: unknown) => {
        const message = err instanceof Error ? err.message : String(err);
        this.logger.warn(`Post-enqueue rebalance failed: ${message}`);
      });
    }, QUEUE_REBALANCE_ENQUEUE_DEBOUNCE_MS);
  }

  private async isAdmin(userId: string): Promise<boolean> {
    const account = await this.prisma.account.findUnique({
      where: { account_id: userId },
      select: { role: true },
    });
    return account?.role === RoleTypeEnum.ADMIN;
  }

  /**
   * Run congestion detector and generate rebalance suggestions.
   */
  async detectAndSuggest(): Promise<{ created: number }> {
    if (this.isRunning) {
      this.coalesceQueued = true;
      return { created: 0 };
    }

    this.isRunning = true;
    let created = 0;
    try {
      let skipThrottle = false;
      do {
        this.coalesceQueued = false;
        const result = await this.runDetectAndSuggest(skipThrottle);
        created += result.created;
        skipThrottle = true;
      } while (this.coalesceQueued);
    } finally {
      this.isRunning = false;
    }
    return { created };
  }

  private async runDetectAndSuggest(
    skipThrottle: boolean,
  ): Promise<{ created: number }> {
    const now = new Date();

    const rule = await this.prisma.queue_Priority_Rule.findFirst({
      where: {
        rule_type: QueueRuleTypeEnum.REBALANCE,
        is_active: true,
      },
    });

    const ruleConfig = toRebalanceConfig(rule?.params);
    if (ruleConfig.enabled === false) {
      return { created: 0 };
    }

    if (!skipThrottle) {
      const acquired = await this.queueCacheService.tryBeginRebalanceRun();
      if (!acquired) {
        return { created: 0 };
      }
    }

    await this.prisma.queue_Rebalance_Suggestion.updateMany({
      where: {
        status: RebalanceSuggestionStatusEnum.PENDING,
        expires_at: { lt: now },
      },
      data: {
        status: RebalanceSuggestionStatusEnum.EXPIRED,
      },
    });

    const etaGapMinutes =
      ruleConfig.eta_gap_minutes ?? DEFAULT_REBALANCE_PARAMS.eta_gap_minutes;
    const suggestionTtlMinutes =
      ruleConfig.suggestion_ttl_minutes ??
      DEFAULT_REBALANCE_PARAMS.suggestion_ttl_minutes;
    const etaGapSec = etaGapMinutes * 60;

    const [queues, allStats, roomServices] = await Promise.all([
      this.prisma.queue.findMany({
        where: {
          status: {
            in: [
              QueueStatusEnum.PENDING,
              QueueStatusEnum.QUEUED,
              QueueStatusEnum.SERVING,
            ],
          },
        },
        select: {
          queue_id: true,
          room_id: true,
          status: true,
          serving_started_at: true,
          step: { select: { step_type: true, service_code: true } },
        },
      }),
      this.prisma.room_Service_Stat.findMany(),
      this.prisma.room_Service.findMany({
        where: { is_active: true },
        select: {
          room_id: true,
          service_id: true,
          service: { select: { service_code: true } },
        },
      }),
    ]);

    const waitingSecByRoom = computeTotalWaitingSecByRoom(
      queues,
      allStats,
      now,
    );

    const statsByRoomType = new Map<string, (typeof allStats)[number]>();
    for (const stat of allStats) {
      statsByRoomType.set(`${stat.room_id}:${stat.step_type}`, stat);
    }

    const serviceRoomsMap = new Map<
      string,
      { roomIds: string[]; serviceCode: string | null }
    >();
    for (const rs of roomServices) {
      const entry = serviceRoomsMap.get(rs.service_id) || {
        roomIds: [] as string[],
        serviceCode: rs.service?.service_code ?? null,
      };
      if (!entry.roomIds.includes(rs.room_id)) {
        entry.roomIds.push(rs.room_id);
      }
      if (!entry.serviceCode && rs.service?.service_code) {
        entry.serviceCode = rs.service.service_code;
      }
      serviceRoomsMap.set(rs.service_id, entry);
    }

    let createdCount = 0;

    for (const [
      serviceId,
      { roomIds, serviceCode },
    ] of serviceRoomsMap.entries()) {
      if (roomIds.length < 2 || !serviceCode) continue;

      const roomEtas = roomIds.map((roomId) => ({
        roomId,
        totalWaitingSec: waitingSecByRoom.get(roomId) ?? 0,
      }));

      roomEtas.sort((a, b) => b.totalWaitingSec - a.totalWaitingSec);
      const maxRoom = roomEtas[0];
      const minRoom = roomEtas[roomEtas.length - 1];

      const gapSec = maxRoom.totalWaitingSec - minRoom.totalWaitingSec;
      if (gapSec <= etaGapSec) continue;

      const maxRoomOrdered = await this.queuePriorityService.computeQueueOrder(
        maxRoom.roomId,
      );

      const candidates: typeof maxRoomOrdered = [];
      for (let i = maxRoomOrdered.length - 1; i >= 0; i--) {
        const entry = maxRoomOrdered[i];
        if (isEligibleRebalanceCandidate(entry, serviceCode)) {
          candidates.push(entry);
        }
      }

      let moved = 0;
      let currentGap = gapSec;

      for (const candidate of candidates) {
        if (moved >= 3 || currentGap <= etaGapSec) break;

        const queueId = candidate.queue.queue_id;
        const candidateStepType = candidate.queue.step?.step_type;
        const maxRoomExpectedSec = expectedSecFromStat(
          candidateStepType
            ? statsByRoomType.get(`${maxRoom.roomId}:${candidateStepType}`)
            : undefined,
        );
        const minRoomExpectedSec = expectedSecFromStat(
          candidateStepType
            ? statsByRoomType.get(`${minRoom.roomId}:${candidateStepType}`)
            : undefined,
        );
        const expiresAt = new Date(
          Date.now() + suggestionTtlMinutes * 60 * 1000,
        );

        try {
          const createdSuggestion = await this.prisma.$transaction(
            async (tx) => {
              const existingPending =
                await tx.queue_Rebalance_Suggestion.findFirst({
                  where: {
                    queue_id: queueId,
                    status: RebalanceSuggestionStatusEnum.PENDING,
                    expires_at: { gt: now },
                  },
                });
              if (existingPending) return null;

              return tx.queue_Rebalance_Suggestion.create({
                data: {
                  from_room_id: maxRoom.roomId,
                  to_room_id: minRoom.roomId,
                  queue_id: queueId,
                  eta_gain_sec: Math.round(currentGap),
                  status: RebalanceSuggestionStatusEnum.PENDING,
                  expires_at: expiresAt,
                },
                include: {
                  queue: {
                    include: {
                      step: {
                        include: {
                          flow: {
                            include: {
                              booking: { include: { patient: true } },
                            },
                          },
                        },
                      },
                    },
                  },
                  fromRoom: true,
                  toRoom: true,
                },
              });
            },
          );

          if (!createdSuggestion) continue;

          createdCount++;
          moved++;
          currentGap -= maxRoomExpectedSec + minRoomExpectedSec;

          this.queueGateway.emitRebalanceSuggestion(
            createdSuggestion.from_room_id,
            createdSuggestion.to_room_id,
            {
              suggestion_id: createdSuggestion.suggestion_id,
              from_room_id: createdSuggestion.from_room_id,
              from_room_name: createdSuggestion.fromRoom.room_name,
              to_room_id: createdSuggestion.to_room_id,
              to_room_name: createdSuggestion.toRoom.room_name,
              queue_id: queueId,
              queue_number: createdSuggestion.queue.queue_number,
              patient_name:
                createdSuggestion.queue.step?.flow?.booking?.patient
                  ?.full_name || '---',
              eta_gain_minutes: Math.round(createdSuggestion.eta_gain_sec / 60),
              expires_at: createdSuggestion.expires_at,
              service_id: serviceId,
            },
          );
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : String(err);
          this.logger.warn(
            `Failed to create suggestion for queue ${queueId}: ${message}`,
          );
        }
      }
    }

    return { created: createdCount };
  }

  /**
   * Non-admin must pass room_id they can manage. Admin may omit room_id for hospital-wide list.
   */
  async getPendingSuggestions(
    roomId?: string,
    user?: { id: string; role: string },
  ) {
    if (!user) {
      throw new ForbiddenException('Bạn cần đăng nhập để xem gợi ý điều phối.');
    }

    const admin = await this.isAdmin(user.id);

    if (!roomId) {
      if (!admin) {
        throw new ForbiddenException(
          'Chỉ admin được xem toàn bộ gợi ý. Vui lòng truyền room_id.',
        );
      }
    } else {
      await this.queueService.assertCanManageRoom(user, roomId);
    }

    const now = new Date();
    const whereCondition: Prisma.Queue_Rebalance_SuggestionWhereInput = {
      status: RebalanceSuggestionStatusEnum.PENDING,
      expires_at: { gt: now },
      ...(roomId
        ? { OR: [{ from_room_id: roomId }, { to_room_id: roomId }] }
        : {}),
    };

    const suggestions = await this.prisma.queue_Rebalance_Suggestion.findMany({
      where: whereCondition,
      include: {
        queue: {
          include: {
            step: {
              include: {
                flow: {
                  include: {
                    booking: { include: { patient: true } },
                  },
                },
              },
            },
          },
        },
        fromRoom: true,
        toRoom: true,
      },
      orderBy: { created_at: 'desc' },
    });

    return {
      code: 200,
      status: 'success',
      message: 'Lấy danh sách gợi ý điều phối thành công.',
      data: suggestions.map((s) => ({
        suggestion_id: s.suggestion_id,
        from_room_id: s.from_room_id,
        from_room_name: s.fromRoom.room_name,
        to_room_id: s.to_room_id,
        to_room_name: s.toRoom.room_name,
        queue_id: s.queue_id,
        queue_number: s.queue.queue_number,
        patient_name:
          s.queue.step?.flow?.booking?.patient?.full_name || '---',
        eta_gain_minutes: Math.round(s.eta_gain_sec / 60),
        status: s.status,
        expires_at: s.expires_at,
        created_at: s.created_at,
      })),
    };
  }

  async confirmSuggestion(
    suggestionId: string,
    user: { id: string; role: string },
  ) {
    const suggestion = await this.prisma.queue_Rebalance_Suggestion.findUnique({
      where: { suggestion_id: suggestionId },
      include: {
        queue: {
          include: {
            step: {
              include: {
                flow: {
                  include: {
                    booking: { include: { patient: true } },
                  },
                },
              },
            },
          },
        },
        fromRoom: true,
        toRoom: true,
      },
    });

    if (!suggestion) {
      throw new NotFoundException({
        message: 'Không tìm thấy gợi ý chuyển hàng chờ',
        detail: `Không tìm thấy suggestion với ID: ${suggestionId}`,
      });
    }

    const admin = await this.isAdmin(user.id);
    if (!admin) {
      const canManageFrom = await this.queueService
        .assertCanManageRoom(user, suggestion.from_room_id)
        .then(() => true)
        .catch(() => false);
      const canManageTo = await this.queueService
        .assertCanManageRoom(user, suggestion.to_room_id)
        .then(() => true)
        .catch(() => false);

      if (!canManageFrom && !canManageTo) {
        throw new ForbiddenException({
          message: 'Bạn không có quyền xác nhận gợi ý chuyển này',
          detail: 'Cần có quyền quản lý phòng nguồn hoặc phòng đích',
        });
      }
    }

    const now = new Date();
    if (
      suggestion.status !== RebalanceSuggestionStatusEnum.PENDING ||
      suggestion.expires_at < now
    ) {
      throw new BadRequestException({
        message: 'Gợi ý không còn hiệu lực hoặc đã hết hạn',
        detail: `Trạng thái hiện tại: ${suggestion.status}, Hạn: ${suggestion.expires_at}`,
      });
    }

    if (suggestion.queue.status !== QueueStatusEnum.QUEUED) {
      throw new BadRequestException({
        message: 'Lượt chờ không ở trạng thái chờ khám (QUEUED)',
        detail: `Trạng thái hiện tại của lượt chờ là: ${suggestion.queue.status}`,
      });
    }

    const oldQueueNumber = suggestion.queue.queue_number;
    const patient = suggestion.queue.step?.flow?.booking?.patient;

    const result = await this.prisma.$transaction(async (tx) => {
      const newQueueNumber = await this.queueService.generateQueueNumberForRoom(
        suggestion.to_room_id,
        tx,
      );

      const destOrder = await this.queuePriorityService.computeQueueOrder(
        suggestion.to_room_id,
        tx,
      );
      const insertAt = computeFairInsertAt(
        destOrder,
        suggestion.queue.enqueued_at,
      );

      await tx.step.update({
        where: { step_id: suggestion.queue.step_id },
        data: {
          room_id: suggestion.to_room_id,
          staff_id: null,
        },
      });

      await tx.queue.update({
        where: { queue_id: suggestion.queue_id },
        data: {
          room_id: suggestion.to_room_id,
          queue_number: newQueueNumber,
          rebalance_locked: true,
          hold_positions: insertAt,
          is_pinned: false,
          pinned_at: null,
        },
      });

      await tx.queue_Rebalance_Suggestion.update({
        where: { suggestion_id: suggestionId },
        data: {
          status: RebalanceSuggestionStatusEnum.CONFIRMED,
          confirmed_by: user.id,
        },
      });

      await tx.move_Log.create({
        data: {
          queue_id: suggestion.queue_id,
          action_type: 'REBALANCED',
          actor_account_id: user.id,
          payload: {
            from_room_id: suggestion.from_room_id,
            to_room_id: suggestion.to_room_id,
            suggestion_id: suggestionId,
            old_queue_number: oldQueueNumber,
            new_queue_number: newQueueNumber,
            insert_at: insertAt,
          },
        },
      });

      if (patient?.account_id) {
        const destName = suggestion.toRoom.room_name;
        await tx.notification.create({
          data: {
            account_id: patient.account_id,
            message: `Để giảm thời gian chờ, hệ thống đã ưu tiên sắp xếp quý khách sang phòng ${destName}. Vui lòng di chuyển đến phòng ${destName}. Số thứ tự mới: ${newQueueNumber}.`,
          },
        });
      }

      return { newQueueNumber, insertAt };
    });

    await this.queueService.broadcastRoomUpdate(suggestion.from_room_id);
    await this.queueService.broadcastRoomUpdate(suggestion.to_room_id);

    this.queueGateway.emitRebalanceResolved(
      suggestion.from_room_id,
      suggestion.to_room_id,
      {
        suggestion_id: suggestionId,
        status: RebalanceSuggestionStatusEnum.CONFIRMED,
      },
    );

    return {
      code: 200,
      status: 'success',
      message: 'Xác nhận chuyển phòng thành công.',
      data: {
        suggestion_id: suggestionId,
        old_queue_number: oldQueueNumber,
        new_queue_number: result.newQueueNumber,
        to_room_name: suggestion.toRoom.room_name,
      },
    };
  }

  async rejectSuggestion(
    suggestionId: string,
    user: { id: string; role: string },
  ) {
    const suggestion = await this.prisma.queue_Rebalance_Suggestion.findUnique({
      where: { suggestion_id: suggestionId },
    });

    if (!suggestion) {
      throw new NotFoundException({
        message: 'Không tìm thấy gợi ý chuyển hàng chờ',
        detail: `Không tìm thấy suggestion với ID: ${suggestionId}`,
      });
    }

    const admin = await this.isAdmin(user.id);
    if (!admin) {
      const canManageFrom = await this.queueService
        .assertCanManageRoom(user, suggestion.from_room_id)
        .then(() => true)
        .catch(() => false);
      const canManageTo = await this.queueService
        .assertCanManageRoom(user, suggestion.to_room_id)
        .then(() => true)
        .catch(() => false);

      if (!canManageFrom && !canManageTo) {
        throw new ForbiddenException({
          message: 'Bạn không có quyền từ chối gợi ý chuyển này',
          detail: 'Cần có quyền quản lý phòng nguồn hoặc phòng đích',
        });
      }
    }

    const updated = await this.prisma.queue_Rebalance_Suggestion.update({
      where: { suggestion_id: suggestionId },
      data: {
        status: RebalanceSuggestionStatusEnum.REJECTED,
        confirmed_by: user.id,
      },
    });

    this.queueGateway.emitRebalanceResolved(
      suggestion.from_room_id,
      suggestion.to_room_id,
      {
        suggestion_id: suggestionId,
        status: RebalanceSuggestionStatusEnum.REJECTED,
      },
    );

    return {
      code: 200,
      status: 'success',
      message: 'Từ chối gợi ý chuyển phòng thành công.',
      data: updated,
    };
  }
}
