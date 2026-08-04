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
  QueueRuleTypeEnum,
  QueueStatusEnum,
  RebalanceSuggestionStatusEnum,
  RoleTypeEnum,
  StepTypeEnum,
} from '@prisma/client';
import { PrismaService } from '../../shared/config/prisma.service';
import { QueueGateway } from '../../shared/gateways/queue.gateway';
import { QueueEtaService } from './queue-eta.service';
import { QueuePriorityService } from './queue-priority.service';
import { QueueService } from './queue.service';
import { REBALANCEABLE_STEP_TYPES } from './queue.constants';

export { REBALANCEABLE_STEP_TYPES } from './queue.constants';

@Injectable()
export class QueueRebalanceService {
  private readonly logger = new Logger(QueueRebalanceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly queuePriorityService: QueuePriorityService,
    private readonly queueEtaService: QueueEtaService,

    @Inject(forwardRef(() => QueueService))
    private readonly queueService: QueueService,

    @Inject(forwardRef(() => QueueGateway))
    private readonly queueGateway: QueueGateway,
  ) {}

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
    const now = new Date();

    await this.prisma.queue_Rebalance_Suggestion.updateMany({
      where: {
        status: RebalanceSuggestionStatusEnum.PENDING,
        expires_at: { lt: now },
      },
      data: {
        status: RebalanceSuggestionStatusEnum.EXPIRED,
      },
    });

    const rule = await this.prisma.queue_Priority_Rule.findFirst({
      where: {
        rule_type: QueueRuleTypeEnum.REBALANCE,
        is_active: true,
      },
    });

    const ruleConfig = (rule?.params as any) || {};
    if ((ruleConfig.enabled ?? true) === false) {
      return { created: 0 };
    }

    const etaGapMinutes = ruleConfig.eta_gap_minutes ?? 15;
    const suggestionTtlMinutes = ruleConfig.suggestion_ttl_minutes ?? 10;
    const etaGapSec = etaGapMinutes * 60;

    const roomServices = await this.prisma.room_Service.findMany({
      where: { is_active: true },
      include: { room: true, service: true },
    });

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

    for (const [serviceId, { roomIds, serviceCode }] of serviceRoomsMap.entries()) {
      if (roomIds.length < 2 || !serviceCode) continue;

      const roomEtas: { roomId: string; totalWaitingSec: number }[] = [];
      for (const roomId of roomIds) {
        const etaResult = await this.queueEtaService.computeEtaForRoom(roomId);
        roomEtas.push({ roomId, totalWaitingSec: etaResult.totalWaitingSec });
      }

      roomEtas.sort((a, b) => b.totalWaitingSec - a.totalWaitingSec);
      const maxRoom = roomEtas[0];
      const minRoom = roomEtas[roomEtas.length - 1];

      const gapSec = maxRoom.totalWaitingSec - minRoom.totalWaitingSec;
      if (gapSec <= etaGapSec) continue;

      const maxRoomOrdered = await this.queuePriorityService.computeQueueOrder(
        maxRoom.roomId,
      );
      const maxRoomExpectedSec = await this.queueEtaService.getExpectedDurationSec(
        maxRoom.roomId,
        null,
      );
      const minRoomExpectedSec = await this.queueEtaService.getExpectedDurationSec(
        minRoom.roomId,
        null,
      );

      const candidates: typeof maxRoomOrdered = [];
      for (let i = maxRoomOrdered.length - 1; i >= 0; i--) {
        const entry = maxRoomOrdered[i];
        const q = entry.queue;
        const step = (q as any).step;
        const stepType = step?.step_type as StepTypeEnum | undefined;
        const stepServiceCode = step?.service_code as string | null | undefined;

        // Only move patients whose step belongs to this service group
        if (stepServiceCode !== serviceCode) continue;

        if (
          q.status === QueueStatusEnum.QUEUED &&
          !q.is_pinned &&
          stepType &&
          REBALANCEABLE_STEP_TYPES.includes(stepType)
        ) {
          candidates.push(entry);
        }
      }

      let moved = 0;
      let currentGap = gapSec;

      for (const candidate of candidates) {
        if (moved >= 3 || currentGap <= etaGapSec) break;

        const queueId = candidate.queue.queue_id;
        const expiresAt = new Date(Date.now() + suggestionTtlMinutes * 60 * 1000);

        try {
          const createdSuggestion = await this.prisma.$transaction(async (tx) => {
            const existingPending = await tx.queue_Rebalance_Suggestion.findFirst({
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
                          include: { booking: { include: { patient: true } } },
                        },
                      },
                    },
                  },
                },
                fromRoom: true,
                toRoom: true,
              },
            });
          });

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
                (createdSuggestion.queue as any).step?.flow?.booking?.patient
                  ?.full_name || '---',
              eta_gain_minutes: Math.round(createdSuggestion.eta_gain_sec / 60),
              expires_at: createdSuggestion.expires_at,
              service_id: serviceId,
            },
          );
        } catch (err: any) {
          this.logger.warn(
            `Failed to create suggestion for queue ${queueId}: ${err.message}`,
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
    const whereCondition: any = {
      status: RebalanceSuggestionStatusEnum.PENDING,
      expires_at: { gt: now },
    };
    if (roomId) {
      whereCondition.OR = [{ from_room_id: roomId }, { to_room_id: roomId }];
    }

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
          (s.queue as any).step?.flow?.booking?.patient?.full_name || '---',
        eta_gain_minutes: Math.round(s.eta_gain_sec / 60),
        status: s.status,
        expires_at: s.expires_at,
        created_at: s.created_at,
      })),
    };
  }

  async confirmSuggestion(suggestionId: string, user: { id: string; role: string }) {
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
    const patient = (suggestion.queue as any).step?.flow?.booking?.patient;

    const result = await this.prisma.$transaction(async (tx) => {
      const newQueueNumber = await this.queueService.generateQueueNumberForRoom(
        suggestion.to_room_id,
        tx,
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
          },
        },
      });

      if (patient?.account_id) {
        await tx.notification.create({
          data: {
            account_id: patient.account_id,
            message: `Lượt chờ của bạn đã được chuyển từ phòng ${suggestion.fromRoom.room_name} sang phòng ${suggestion.toRoom.room_name}. Số thứ tự mới của bạn là ${newQueueNumber}.`,
          },
        });
      }

      return { newQueueNumber };
    });

    try {
      const fromDisplay = await this.queueService.getRoomDisplayPayload(
        suggestion.from_room_id,
      );
      const toDisplay = await this.queueService.getRoomDisplayPayload(
        suggestion.to_room_id,
      );
      this.queueGateway.emitQueueUpdate(suggestion.from_room_id, fromDisplay);
      this.queueGateway.emitQueueUpdate(suggestion.to_room_id, toDisplay);
    } catch (err: any) {
      this.logger.warn(`Failed emitting WS updates post-confirm: ${err.message}`);
    }

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

  async rejectSuggestion(suggestionId: string, user: { id: string; role: string }) {
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

    return {
      code: 200,
      status: 'success',
      message: 'Từ chối gợi ý chuyển phòng thành công.',
      data: updated,
    };
  }
}
