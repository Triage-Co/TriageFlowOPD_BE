import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  QueueRuleTypeEnum,
  QueueStatusEnum,
  RebalanceSuggestionStatusEnum,
} from '@prisma/client';
import { formatInTimeZone, toDate } from 'date-fns-tz';
import { PrismaService } from '../../shared/config/prisma.service';
import { QueueGateway } from '../../shared/gateways/queue.gateway';
import {
  CreatePriorityRuleDto,
  CreateRoomServiceDto,
  QueryPriorityRuleDto,
  UpdatePriorityRuleDto,
  UpdateRebalanceConfigDto,
  UpdateRoomServiceDto,
} from './dto/admin-rule.dto';
import { QueueEtaService } from './queue-eta.service';
import { QueuePriorityService } from './queue-priority.service';
import {
  buildQueueDateFilter,
  DEFAULT_REBALANCE_PARAMS,
  mergeRebalanceParams,
  toRebalanceConfig,
} from './queue.constants';

export const ALLOWED_CONDITION_KEYS = [
  'age',
  'gender',
  'queue_type',
  'suggested_priority',
  'temperature',
  'heart_rate',
  'spo2',
  'blood_pressure_sys',
  'appointment_on_time',
  'missed_count',
];

export const ALLOWED_OPERATORS = ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'in'];

export function validateConditions(
  conditions: Record<string, any> | null | undefined,
): void {
  if (!conditions || typeof conditions !== 'object') return;

  for (const [key, val] of Object.entries(conditions)) {
    if (!ALLOWED_CONDITION_KEYS.includes(key)) {
      throw new BadRequestException({
        message: `Tên trường điều kiện không hợp lệ: ${key}`,
        detail: `Các trường hỗ trợ: ${ALLOWED_CONDITION_KEYS.join(', ')}`,
      });
    }

    if (typeof val === 'object' && val !== null && !Array.isArray(val)) {
      for (const op of Object.keys(val)) {
        if (!ALLOWED_OPERATORS.includes(op)) {
          throw new BadRequestException({
            message: `Toán tử không hợp lệ: ${op} ở trường ${key}`,
            detail: `Các toán tử hỗ trợ: ${ALLOWED_OPERATORS.join(', ')}`,
          });
        }
      }
    }
  }
}

export function validateParams(
  ruleType: QueueRuleTypeEnum,
  params: Record<string, any> | null | undefined,
): void {
  if (ruleType === QueueRuleTypeEnum.MISSED_TURN) {
    const hold = params?.hold_positions;
    if (typeof hold !== 'number' || hold <= 0) {
      throw new BadRequestException({
        message:
          'Rule MISSED_TURN bắt buộc có tham số params.hold_positions là số nguyên lớn hơn 0',
      });
    }
  } else if (ruleType === QueueRuleTypeEnum.REBALANCE) {
    const gap = params?.eta_gap_minutes;
    if (typeof gap !== 'number' || gap <= 0) {
      throw new BadRequestException({
        message:
          'Rule REBALANCE bắt buộc có tham số params.eta_gap_minutes là số lớn hơn 0',
      });
    }
  }
}

@Injectable()
export class QueueAdminService {
  private readonly logger = new Logger(QueueAdminService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly queuePriorityService: QueuePriorityService,
    private readonly queueEtaService: QueueEtaService,
    private readonly queueGateway: QueueGateway,
  ) {}

  // ─── 1. Priority Rules CRUD ──────────────────────────────────────────────────

  async getRules(query: QueryPriorityRuleDto) {
    const where: any = {};

    if (query.rule_type) where.rule_type = query.rule_type;
    if (query.is_active !== undefined) where.is_active = query.is_active;
    if (query.room_type) where.room_type = query.room_type;
    if (query.specialty_id) where.specialty_id = query.specialty_id;

    const rules = await this.prisma.queue_Priority_Rule.findMany({
      where,
      include: { specialty: true },
      orderBy: [{ weight: 'desc' }, { created_at: 'asc' }],
    });

    return {
      code: 200,
      status: 'success',
      message: 'Lấy danh sách quy tắc ưu tiên thành công.',
      data: rules,
    };
  }

  async createRule(dto: CreatePriorityRuleDto) {
    validateConditions(dto.conditions);
    validateParams(dto.rule_type, dto.params);

    if (dto.specialty_id) {
      const specialty = await this.prisma.specialty.findUnique({
        where: { specialty_id: dto.specialty_id },
      });
      if (!specialty) {
        throw new NotFoundException({
          message: 'Không tìm thấy chuyên khoa',
          detail: `Không tìm thấy specialty với ID: ${dto.specialty_id}`,
        });
      }
    }

    const existingRule = await this.prisma.queue_Priority_Rule.findUnique({
      where: { rule_code: dto.rule_code },
    });

    if (existingRule) {
      if (!existingRule.is_active) {
        // Re-activate soft-deleted rule
        const updated = await this.prisma.queue_Priority_Rule.update({
          where: { rule_id: existingRule.rule_id },
          data: {
            name: dto.name,
            description: dto.description ?? null,
            rule_type: dto.rule_type,
            weight: dto.weight ?? 0,
            aging_rate: dto.aging_rate ?? 0,
            max_aging: dto.max_aging ?? 0,
            conditions: dto.conditions ?? Prisma.DbNull,
            params: dto.params ?? Prisma.DbNull,
            room_type: dto.room_type ?? null,
            specialty_id: dto.specialty_id ?? null,
            is_active: true,
          },
        });

        this.queuePriorityService.clearRulesCache();
        return {
          code: 200,
          status: 'success',
          message: 'Kích hoạt lại quy tắc ưu tiên đã bị tắt thành công.',
          data: updated,
        };
      } else {
        throw new ConflictException({
          message: 'Mã quy tắc đã tồn tại',
          detail: `rule_code '${dto.rule_code}' đã tồn tại và đang hoạt động.`,
        });
      }
    }

    const created = await this.prisma.queue_Priority_Rule.create({
      data: {
        rule_code: dto.rule_code,
        name: dto.name,
        description: dto.description ?? null,
        rule_type: dto.rule_type,
        weight: dto.weight ?? 0,
        aging_rate: dto.aging_rate ?? 0,
        max_aging: dto.max_aging ?? 0,
        conditions: dto.conditions ?? Prisma.DbNull,
        params: dto.params ?? Prisma.DbNull,
        room_type: dto.room_type ?? null,
        specialty_id: dto.specialty_id ?? null,
        is_active: true,
      },
    });

    this.queuePriorityService.clearRulesCache();

    return {
      code: 201,
      status: 'success',
      message: 'Tạo quy tắc ưu tiên thành công.',
      data: created,
    };
  }

  async updateRule(ruleId: string, dto: UpdatePriorityRuleDto) {
    const existing = await this.prisma.queue_Priority_Rule.findUnique({
      where: { rule_id: ruleId },
    });

    if (!existing) {
      throw new NotFoundException({
        message: 'Không tìm thấy quy tắc ưu tiên',
        detail: `Không tìm thấy rule với ID: ${ruleId}`,
      });
    }

    const effectiveRuleType = dto.rule_type || existing.rule_type;
    if (dto.conditions !== undefined) validateConditions(dto.conditions);
    if (dto.params !== undefined) validateParams(effectiveRuleType, dto.params);

    if (dto.specialty_id) {
      const specialty = await this.prisma.specialty.findUnique({
        where: { specialty_id: dto.specialty_id },
      });
      if (!specialty) {
        throw new NotFoundException({
          message: 'Không tìm thấy chuyên khoa',
          detail: `Không tìm thấy specialty với ID: ${dto.specialty_id}`,
        });
      }
    }

    const updated = await this.prisma.queue_Priority_Rule.update({
      where: { rule_id: ruleId },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.rule_type !== undefined && { rule_type: dto.rule_type }),
        ...(dto.weight !== undefined && { weight: dto.weight }),
        ...(dto.aging_rate !== undefined && { aging_rate: dto.aging_rate }),
        ...(dto.max_aging !== undefined && { max_aging: dto.max_aging }),
        ...(dto.conditions !== undefined && {
          conditions: dto.conditions ?? Prisma.DbNull,
        }),
        ...(dto.params !== undefined && {
          params: dto.params ?? Prisma.DbNull,
        }),
        ...(dto.room_type !== undefined && { room_type: dto.room_type }),
        ...(dto.specialty_id !== undefined && {
          specialty_id: dto.specialty_id,
        }),
        ...(dto.is_active !== undefined && { is_active: dto.is_active }),
      },
    });

    this.queuePriorityService.clearRulesCache();

    return {
      code: 200,
      status: 'success',
      message: 'Cập nhật quy tắc ưu tiên thành công.',
      data: updated,
    };
  }

  async deleteRule(ruleId: string) {
    const existing = await this.prisma.queue_Priority_Rule.findUnique({
      where: { rule_id: ruleId },
    });

    if (!existing) {
      throw new NotFoundException({
        message: 'Không tìm thấy quy tắc ưu tiên',
        detail: `Không tìm thấy rule với ID: ${ruleId}`,
      });
    }

    const updated = await this.prisma.queue_Priority_Rule.update({
      where: { rule_id: ruleId },
      data: { is_active: false },
    });

    this.queuePriorityService.clearRulesCache();

    return {
      code: 200,
      status: 'success',
      message: 'Đã tắt (soft-delete) quy tắc ưu tiên thành công.',
      data: updated,
    };
  }

  async getRebalanceConfig() {
    const rule = await this.prisma.queue_Priority_Rule.findFirst({
      where: { rule_type: QueueRuleTypeEnum.REBALANCE },
      orderBy: { created_at: 'asc' },
    });
    const config = toRebalanceConfig(rule?.params);
    return {
      code: 200,
      status: 'success',
      message: 'Lấy cấu hình tự sắp xếp hàng chờ thành công.',
      data: {
        ...config,
        rule_id: rule?.rule_id ?? null,
      },
    };
  }

  async updateRebalanceConfig(dto: UpdateRebalanceConfigDto) {
    const existing = await this.prisma.queue_Priority_Rule.findFirst({
      where: { rule_type: QueueRuleTypeEnum.REBALANCE },
      orderBy: { created_at: 'asc' },
    });

    const wasEnabled = existing
      ? toRebalanceConfig(existing.params).enabled
      : DEFAULT_REBALANCE_PARAMS.enabled;
    const mergedParams = mergeRebalanceParams(existing?.params, dto);
    const disabling = wasEnabled && mergedParams.enabled === false;

    const { rule, expiredSuggestions } = await this.prisma.$transaction(
      async (tx) => {
        let expired: Array<{
          suggestion_id: string;
          from_room_id: string;
          to_room_id: string;
        }> = [];

        if (disabling) {
          expired = await tx.queue_Rebalance_Suggestion.findMany({
            where: { status: RebalanceSuggestionStatusEnum.PENDING },
            select: {
              suggestion_id: true,
              from_room_id: true,
              to_room_id: true,
            },
          });
          await tx.queue_Rebalance_Suggestion.updateMany({
            where: { status: RebalanceSuggestionStatusEnum.PENDING },
            data: { status: RebalanceSuggestionStatusEnum.EXPIRED },
          });
        }

        const paramsJson = mergedParams as Prisma.InputJsonValue;
        const ruleRow = existing
          ? await tx.queue_Priority_Rule.update({
              where: { rule_id: existing.rule_id },
              data: {
                params: paramsJson,
                is_active: true,
              },
            })
          : await tx.queue_Priority_Rule.create({
              data: {
                rule_code: 'REBALANCE_DEFAULT',
                name: 'Cấu hình Load Balancing',
                description:
                  'Ngưỡng chênh lệch ETA 15 phút, suggestion TTL 10 phút',
                rule_type: QueueRuleTypeEnum.REBALANCE,
                weight: 0,
                aging_rate: 0,
                max_aging: 0,
                params: paramsJson,
                is_active: true,
              },
            });

        return { rule: ruleRow, expiredSuggestions: expired };
      },
    );

    this.queuePriorityService.clearRulesCache();

    for (const suggestion of expiredSuggestions) {
      this.queueGateway.emitRebalanceResolved(
        suggestion.from_room_id,
        suggestion.to_room_id,
        {
          suggestion_id: suggestion.suggestion_id,
          status: RebalanceSuggestionStatusEnum.EXPIRED,
        },
      );
    }

    const config = toRebalanceConfig(rule.params);
    return {
      code: 200,
      status: 'success',
      message: disabling
        ? 'Đã tắt tự sắp xếp hàng chờ và hết hạn các gợi ý đang chờ.'
        : 'Cập nhật cấu hình tự sắp xếp hàng chờ thành công.',
      data: {
        ...config,
        rule_id: rule.rule_id,
      },
    };
  }

  // ─── 2. Room-Service Mapping CRUD ──────────────────────────────────────────

  async getRoomServices(roomId?: string, serviceId?: string) {
    const where: any = {};
    if (roomId) where.room_id = roomId;
    if (serviceId) where.service_id = serviceId;

    const list = await this.prisma.room_Service.findMany({
      where,
      include: { room: true, service: true },
      orderBy: { created_at: 'desc' },
    });

    return {
      code: 200,
      status: 'success',
      message: 'Lấy danh sách phân công dịch vụ phòng thành công.',
      data: list,
    };
  }

  async createRoomService(dto: CreateRoomServiceDto) {
    const room = await this.prisma.room.findUnique({
      where: { room_id: dto.room_id },
    });
    if (!room) {
      throw new NotFoundException({
        message: 'Không tìm thấy phòng khám',
        detail: `Không tìm thấy room với ID: ${dto.room_id}`,
      });
    }

    const service = await this.prisma.service.findUnique({
      where: { service_id: dto.service_id },
    });
    if (!service) {
      throw new NotFoundException({
        message: 'Không tìm thấy dịch vụ',
        detail: `Không tìm thấy service với ID: ${dto.service_id}`,
      });
    }

    if (!service.is_active) {
      throw new ConflictException({
        message: 'Không thể gán dịch vụ đã bị vô hiệu hóa cho phòng',
        detail: `Dịch vụ '${service.service_name ?? service.service_id}' hiện đang bị tắt (is_active=false).`,
      });
    }

    const existing = await this.prisma.room_Service.findUnique({
      where: {
        room_id_service_id: {
          room_id: dto.room_id,
          service_id: dto.service_id,
        },
      },
    });

    let mapping;
    let isReactivated = false;
    if (existing) {
      // Upsert/reactivate thay vì báo lỗi trùng lặp
      mapping = await this.prisma.room_Service.update({
        where: { id: existing.id },
        data: { is_active: true },
        include: { room: true, service: true },
      });
      isReactivated = true;
    } else {
      mapping = await this.prisma.room_Service.create({
        data: {
          room_id: dto.room_id,
          service_id: dto.service_id,
          is_active: true,
        },
        include: { room: true, service: true },
      });
    }

    const warning =
      service.room_type && service.room_type !== room.room_type
        ? `Cảnh báo: Loại dịch vụ (${service.room_type}) không khớp với loại phòng (${room.room_type}).`
        : undefined;

    return {
      code: isReactivated ? 200 : 201,
      status: 'success',
      message: isReactivated
        ? 'Kích hoạt lại phân công dịch vụ phòng thành công.'
        : 'Tạo phân công dịch vụ phòng thành công.',
      warning,
      data: mapping,
    };
  }

  async updateRoomService(id: string, dto: UpdateRoomServiceDto) {
    const existing = await this.prisma.room_Service.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException({
        message: 'Không tìm thấy bản ghi phân công dịch vụ phòng',
        detail: `Không tìm thấy room_service với ID: ${id}`,
      });
    }

    const updated = await this.prisma.room_Service.update({
      where: { id },
      data: { is_active: dto.is_active },
      include: { room: true, service: true },
    });

    return {
      code: 200,
      status: 'success',
      message: 'Cập nhật phân công dịch vụ phòng thành công.',
      data: updated,
    };
  }

  async deleteRoomService(id: string) {
    const existing = await this.prisma.room_Service.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException({
        message: 'Không tìm thấy bản ghi phân công dịch vụ phòng',
        detail: `Không tìm thấy room_service với ID: ${id}`,
      });
    }

    await this.prisma.room_Service.delete({
      where: { id },
    });

    return {
      code: 200,
      status: 'success',
      message: 'Xóa phân công dịch vụ phòng thành công.',
      data: null,
    };
  }

  // ─── 3. Default Duration Config Stats ─────────────────────────────────────

  async getRoomStats(roomId?: string) {
    const where: any = {};
    if (roomId) where.room_id = roomId;

    const stats = await this.prisma.room_Service_Stat.findMany({
      where,
      include: { room: true },
      orderBy: { updated_at: 'desc' },
    });

    return {
      code: 200,
      status: 'success',
      message: 'Lấy cấu hình thời gian phục vụ phòng khám thành công.',
      data: stats,
    };
  }

  // ─── 4. Heatmap Snapshot ──────────────────────────────────────────────────

  async getHeatmapData() {
    const timeZone = 'Asia/Ho_Chi_Minh';
    const now = new Date();
    const todayDateString = formatInTimeZone(now, timeZone, 'yyyy-MM-dd');
    const startOfDay = toDate(`${todayDateString}T00:00:00`, { timeZone });

    const endOfDay = toDate(`${todayDateString}T23:59:59.999`, { timeZone });

    // 1. Fetch today's queues first, then only rooms with activity
    const todayQueues = await this.prisma.queue.findMany({
      where: {
        room_id: { not: null },
        ...buildQueueDateFilter(startOfDay, endOfDay),
      },
    });

    const roomQueuesMap = new Map<string, typeof todayQueues>();
    for (const q of todayQueues) {
      if (!q.room_id) continue;
      const list = roomQueuesMap.get(q.room_id) || [];
      list.push(q);
      roomQueuesMap.set(q.room_id, list);
    }

    const activeRoomIds = [...roomQueuesMap.keys()];
    const rooms =
      activeRoomIds.length === 0
        ? []
        : await this.prisma.room.findMany({
            where: { room_id: { in: activeRoomIds } },
            include: {
              specialty: true,
              physical_room: true,
            },
          });

    let totalWaitingAll = 0;
    let busiestRoomId: string | null = null;
    let maxWaitingSecAll = -1;

    let totalServedWaitMinutesSum = 0;
    let totalServedCount = 0;

    const roomResults: any[] = [];

    for (const room of rooms) {
      const roomQueues = roomQueuesMap.get(room.room_id) || [];

      let waitingCount = 0;
      let servingCount = 0;
      let missingCount = 0;
      let completedCount = 0;

      let servedWaitMinutesSum = 0;
      let servedCount = 0;

      let maxCurrentWaitMinutes = 0;

      for (const q of roomQueues) {
        if (q.status === QueueStatusEnum.QUEUED) {
          waitingCount++;

          const enqueuedAt = q.enqueued_at
            ? new Date(q.enqueued_at)
            : new Date(q.created_at);
          const waitedMins = Math.floor(
            Math.max(0, now.getTime() - enqueuedAt.getTime()) / 60000,
          );
          if (waitedMins > maxCurrentWaitMinutes) {
            maxCurrentWaitMinutes = waitedMins;
          }
        } else if (
          q.status === QueueStatusEnum.SERVING ||
          q.status === QueueStatusEnum.CALLED
        ) {
          servingCount++;
        } else if (q.status === QueueStatusEnum.MISSING) {
          missingCount++;
        } else if (q.status === QueueStatusEnum.FINISHED) {
          completedCount++;
        }

        if (q.serving_started_at) {
          const enqueuedAt = q.enqueued_at
            ? new Date(q.enqueued_at)
            : new Date(q.created_at);
          const waitMins = Math.max(
            0,
            (new Date(q.serving_started_at).getTime() - enqueuedAt.getTime()) /
              60000,
          );
          servedWaitMinutesSum += waitMins;
          servedCount++;

          totalServedWaitMinutesSum += waitMins;
          totalServedCount++;
        }
      }

      totalWaitingAll += waitingCount;

      let etaResult = {
        totalWaitingSec: 0,
        expectedDurationSec: 900,
      };
      if (waitingCount > 0 || servingCount > 0) {
        etaResult = await this.queueEtaService.computeEtaForRoom(room.room_id);
      }

      const etaFullQueueMinutes = Math.round(etaResult.totalWaitingSec / 60);

      if (etaResult.totalWaitingSec > maxWaitingSecAll) {
        maxWaitingSecAll = etaResult.totalWaitingSec;
        busiestRoomId = room.room_id;
      }

      let congestionLevel: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW';
      if (
        (waitingCount == 5 && etaFullQueueMinutes > 50) ||
        waitingCount >= 10
      ) {
        congestionLevel = 'HIGH';
      } else if (
        (waitingCount == 3 && etaFullQueueMinutes > 30) ||
        waitingCount >= 6
      ) {
        congestionLevel = 'MEDIUM';
      }

      const avgWaitMinutesToday =
        servedCount > 0
          ? Number((servedWaitMinutesSum / servedCount).toFixed(1))
          : 0;

      roomResults.push({
        room_id: room.room_id,
        room_name: room.room_name,
        room_type: room.room_type,
        physical_room_id: room.physical_room_id,
        specialty_name: room.specialty?.specialty_name || 'Khám bệnh',
        waiting_count: waitingCount,
        serving_count: servingCount,
        missing_count: missingCount,
        avg_wait_minutes_today: avgWaitMinutesToday,
        max_current_wait_minutes: maxCurrentWaitMinutes,
        expected_service_minutes: Math.round(
          etaResult.expectedDurationSec / 60,
        ),
        eta_full_queue_minutes: etaFullQueueMinutes,
        completed_today: completedCount,
        congestion_level: congestionLevel,
      });
    }

    const avgWaitMinutesAll =
      totalServedCount > 0
        ? Number((totalServedWaitMinutesSum / totalServedCount).toFixed(1))
        : 0;

    return {
      code: 200,
      status: 'success',
      message: 'Lấy dữ liệu heatmap thành công.',
      data: {
        generated_at: now.toISOString(),
        rooms: roomResults,
        summary: {
          total_waiting: totalWaitingAll,
          busiest_room_id: busiestRoomId,
          avg_wait_minutes_all: avgWaitMinutesAll,
        },
      },
    };
  }
}
