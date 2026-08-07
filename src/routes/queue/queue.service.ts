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
  ClinicalRoomType,
  PaymentStatusEnum,
  Prisma,
  Queue,
  QueueRuleTypeEnum,
  QueueStatusEnum,
  QueueTypeEnum,
  RoleTypeEnum,
  ServiceOrderDetailStatusEnum,
  ServiceOrderStatusEnum,
  StepStatusEnum,
  StepTypeEnum,
} from '@prisma/client';
import { toZonedTime, formatInTimeZone, toDate } from 'date-fns-tz';
import { PrismaService } from '../../shared/config/prisma.service';
import { QueueGateway } from '../../shared/gateways/queue.gateway';
import { QueuePriorityService } from './queue-priority.service';
import { EntryEtaInfo, QueueEtaService } from './queue-eta.service';
import { QueueRebalanceService } from './queue-rebalance.service';
import { REBALANCEABLE_STEP_TYPES } from './queue.constants';
import { StepService } from '../step/step.service';

const ACTIVE_SOD_STATUSES: ServiceOrderDetailStatusEnum[] = [
  ServiceOrderDetailStatusEnum.PENDING,
  ServiceOrderDetailStatusEnum.PAID,
  ServiceOrderDetailStatusEnum.IN_PROGRESS,
];

const SERVING_STEP_INCLUDE = {
  flow: {
    include: {
      booking: {
        include: {
          patient: true,
        },
      },
    },
  },
  service_order: {
    include: {
      serviceOrderDetails: {
        include: {
          service: true,
        },
      },
    },
  },
} as const;

const VN_TZ = 'Asia/Ho_Chi_Minh';

export function getStartOfDayVn(now: Date = new Date()): Date {
  const todayDateString = formatInTimeZone(now, VN_TZ, 'yyyy-MM-dd');
  return toDate(`${todayDateString}T00:00:00`, { timeZone: VN_TZ });
}

export function getEndOfDayVn(now: Date = new Date()): Date {
  const todayDateString = formatInTimeZone(now, VN_TZ, 'yyyy-MM-dd');
  return toDate(`${todayDateString}T23:59:59.999`, { timeZone: VN_TZ });
}

export function isAppointmentOnTime(
  slotStartTime: string,
  slotEndTime: string,
  shiftDate: Date,
  checkTime: Date = new Date(),
  timeZone: string = 'Asia/Ho_Chi_Minh',
): boolean {
  if (!slotStartTime || !slotEndTime || !shiftDate) return false;

  const zonedShift = toZonedTime(shiftDate, timeZone);
  const zonedCheck = toZonedTime(checkTime, timeZone);

  if (
    zonedShift.getFullYear() !== zonedCheck.getFullYear() ||
    zonedShift.getMonth() !== zonedCheck.getMonth() ||
    zonedShift.getDate() !== zonedCheck.getDate()
  ) {
    return false;
  }

  const [startH, startM] = slotStartTime.split(':').map(Number);
  const [endH, endM] = slotEndTime.split(':').map(Number);

  const startMs = (startH * 60 + startM - 30) * 60 * 1000;
  const endMs = (endH * 60 + endM + 1) * 60 * 1000;
  const checkMs =
    (zonedCheck.getHours() * 60 + zonedCheck.getMinutes()) * 60 * 1000 + zonedCheck.getSeconds() * 1000;

  return checkMs >= startMs && checkMs < endMs;
}

@Injectable()
export class QueueService {
  private readonly logger = new Logger(QueueService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly queuePriorityService: QueuePriorityService,
    private readonly queueEtaService: QueueEtaService,

    @Inject(forwardRef(() => QueueGateway))
    private readonly queueGateway: QueueGateway,

    @Inject(forwardRef(() => QueueRebalanceService))
    private readonly queueRebalanceService: QueueRebalanceService,

    @Inject(forwardRef(() => StepService))
    private readonly stepService: StepService,
  ) {}

  async assertCanManageRoom(
    user: { id: string; role: string },
    roomId: string,
    stepId?: string,
  ): Promise<void> {
    // Load role from Account (JWT role is usually "authenticated", not RoleTypeEnum)
    const account = await this.prisma.account.findUnique({
      where: { account_id: user.id },
      select: { role: true },
    });
    if (account?.role === RoleTypeEnum.ADMIN) {
      return;
    }

    if (stepId) {
      const step = await this.prisma.step.findUnique({
        where: { step_id: stepId },
        select: { staff_id: true },
      });
      if (step && step.staff_id === user.id) {
        return;
      }
    }

    const startOfDay = getStartOfDayVn();
    const endOfDay = getEndOfDayVn();

    const shift = await this.prisma.shift.findFirst({
      where: {
        staff_id: user.id,
        room_id: roomId,
        date: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
    });

    if (shift) {
      return;
    }

    throw new ForbiddenException('Bạn không có quyền thao tác trên phòng khám này.');
  }

  async getLatestTriagePriority(
    patientId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<number | null> {
    const client = tx || this.prisma;
    const triage = await client.triage_Information.findFirst({
      where: {
        answer: {
          patient_id: patientId,
        },
      },
      orderBy: {
        created_at: 'desc',
      },
      select: {
        suggested_priority: true,
      },
    });
    return triage?.suggested_priority ?? null;
  }

  async generateQueueNumberForRoom(
    roomId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<string> {
    const client = tx || this.prisma;
    const startOfDay = getStartOfDayVn();

    const count = await client.queue.count({
      where: {
        room_id: roomId,
        created_at: {
          gte: startOfDay,
        },
      },
    });

    return (count + 1).toString();
  }

  private async evaluatePriorityForStep(
    step: {
      room?: { room_type: ClinicalRoomType; specialty_id: string | null } | null;
      flow?: {
        booking?: {
          patient?: { patient_id: string; dob: Date | null; gender: any } | null;
          slot?: {
            start_time: string;
            end_time: string;
            shift?: { date: Date } | null;
          } | null;
          visitSession?: {
            temperature: number | null;
            heart_rate: number | null;
            spo2: number | null;
            blood_pressure_sys: number | null;
          } | null;
        } | null;
      } | null;
    },
    queueType: QueueTypeEnum,
    missedCount: number,
    prismaTx: Prisma.TransactionClient,
  ): Promise<{ basePriority: number; appliedRules: any }> {
    if (process.env.QUEUE_ENGINE_ENABLED === 'false') {
      return { basePriority: 0, appliedRules: null };
    }

    const patient = step.flow?.booking?.patient ?? null;
    const slot = step.flow?.booking?.slot ?? null;
    const shift = slot?.shift ?? null;
    const visitSession = step.flow?.booking?.visitSession ?? null;

    const suggestedPriority = patient
      ? await this.getLatestTriagePriority(patient.patient_id, prismaTx)
      : null;

    const appointmentOnTime = Boolean(
      slot?.start_time &&
        slot?.end_time &&
        shift?.date &&
        isAppointmentOnTime(slot.start_time, slot.end_time, new Date(shift.date)),
    );

    const vitals = visitSession
      ? {
          temperature: visitSession.temperature ?? null,
          heart_rate: visitSession.heart_rate ?? null,
          spo2: visitSession.spo2 ?? null,
          blood_pressure_sys: visitSession.blood_pressure_sys ?? null,
        }
      : null;

    const evalResult = await this.queuePriorityService.evaluateRulesForEntry({
      patient: patient
        ? { dob: patient.dob ? new Date(patient.dob) : null, gender: patient.gender }
        : null,
      queueType,
      suggestedPriority,
      vitals,
      appointmentOnTime,
      missedCount,
      roomType: step.room?.room_type ?? null,
      specialtyId: step.room?.specialty_id ?? null,
    });

    return {
      basePriority: evalResult.basePriority,
      appliedRules: evalResult.appliedRules,
    };
  }

  /**
   * Create (or repair/retype) a queue entry for a step.
   * @param options.forceType - when true, update queue_type + re-evaluate priority on existing entry
   */
  async enqueueStep(
    stepId: string,
    queueType: QueueTypeEnum,
    tx?: Prisma.TransactionClient,
    options?: { forceType?: boolean },
  ): Promise<Queue> {
    const execute = async (prismaTx: Prisma.TransactionClient) => {
      const step = await prismaTx.step.findUnique({
        where: { step_id: stepId },
        include: {
          room: true,
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
                  visitSession: true,
                },
              },
            },
          },
        },
      });

      if (!step) {
        throw new BadRequestException('Không tìm thấy lượt khám (step).');
      }

      if (!step.room_id) {
        throw new BadRequestException('Step chưa được gán phòng khám.');
      }

      const existingQueue = await prismaTx.queue.findFirst({
        where: {
          step_id: stepId,
          status: {
            notIn: [QueueStatusEnum.FINISHED, QueueStatusEnum.CANCELLED],
          },
        },
      });

      if (existingQueue) {
        const needsRepair = !existingQueue.room_id;
        const needsRetype =
          options?.forceType === true && existingQueue.queue_type !== queueType;

        if (!needsRepair && !needsRetype) {
          return existingQueue;
        }

        const { basePriority, appliedRules } = await this.evaluatePriorityForStep(
          step,
          queueType,
          existingQueue.missed_count ?? 0,
          prismaTx,
        );

        return prismaTx.queue.update({
          where: { queue_id: existingQueue.queue_id },
          data: {
            room_id: step.room_id,
            queue_type: queueType,
            base_priority: basePriority,
            applied_rules: appliedRules ?? undefined,
            status:
              existingQueue.status === QueueStatusEnum.PENDING
                ? QueueStatusEnum.QUEUED
                : existingQueue.status,
          },
        });
      }

      const nextNumber = await this.generateQueueNumberForRoom(step.room_id, prismaTx);
      const { basePriority, appliedRules } = await this.evaluatePriorityForStep(
        step,
        queueType,
        0,
        prismaTx,
      );

      return prismaTx.queue.create({
        data: {
          step_id: stepId,
          room_id: step.room_id,
          queue_number: nextNumber,
          queue_type: queueType,
          base_priority: basePriority,
          applied_rules: appliedRules ?? undefined,
          enqueued_at: new Date(),
          status: QueueStatusEnum.QUEUED,
        },
      });
    };

    const result = tx ? await execute(tx) : await this.prisma.$transaction(execute);

    if (result.room_id) {
      this.broadcastRoomUpdate(result.room_id);

      // Fire-and-forget rebalance detector for CLS/procedure queues
      this.prisma.step
        .findUnique({
          where: { step_id: result.step_id },
          select: { step_type: true },
        })
        .then((step) => {
          if (step?.step_type && REBALANCEABLE_STEP_TYPES.includes(step.step_type)) {
            return this.queueRebalanceService.detectAndSuggest();
          }
        })
        .catch((err) =>
          this.logger.warn(`Post-enqueue rebalance failed: ${err?.message || err}`),
        );
    }

    return result;
  }

  async generateServiceQueueNumber(serviceOrderId: string) {
    const steps = await this.prisma.step.findMany({
      where: {
        service_order_id: serviceOrderId,
        service_order: {
          payment_status: PaymentStatusEnum.SUCCESSED,
        },
      },
      include: {
        queues: true,
        flow: {
          include: {
            booking: {
              include: {
                slot: true,
              },
            },
          },
        },
      },
    });

    for (const step of steps) {
      if (!step.room_id) continue;

      const hasBooking = Boolean(step.flow?.booking?.slot_id);
      const queueType = hasBooking ? QueueTypeEnum.APPOINTMENT : QueueTypeEnum.NEW;
      const activeQueue = (step.queues || []).find(
        (q) =>
          q.status !== QueueStatusEnum.FINISHED &&
          q.status !== QueueStatusEnum.CANCELLED,
      );

      // Repair orphaned booking-created rows (missing room_id / priority) via forceType path
      if (activeQueue && !activeQueue.room_id) {
        await this.enqueueStep(step.step_id, queueType, undefined, { forceType: true });
        continue;
      }

      if (activeQueue) continue;

      await this.enqueueStep(step.step_id, queueType);
    }
  }

  async callNextPatient(
    stepId: string | undefined,
    roomId: string,
    staffId: string,
    user?: { id: string; role: string },
  ) {
    if (user) {
      await this.assertCanManageRoom(user, roomId, stepId);
    }

    await this.prisma.$transaction(async (tx) => {
      // 1. Process currently serving patient if any
      const currentlyServing = await tx.queue.findFirst({
        where: {
          room_id: roomId,
          status: QueueStatusEnum.SERVING,
        },
        include: {
          step: true,
        },
      });

      if (currentlyServing) {
        const now = new Date();
        if (currentlyServing.step?.step_status === StepStatusEnum.COMPLETED) {
          await tx.queue.update({
            where: { queue_id: currentlyServing.queue_id },
            data: {
              status: QueueStatusEnum.FINISHED,
              finished_at: now,
            },
          });

          await tx.move_Log.create({
            data: {
              queue_id: currentlyServing.queue_id,
              action_type: 'FINISHED',
              actor_account_id: user?.id ?? null,
            },
          });

          if (currentlyServing.serving_started_at) {
            const durationSec = Math.round(
              (now.getTime() - new Date(currentlyServing.serving_started_at).getTime()) / 1000,
            );
            this.queueEtaService
              .recordServiceDuration(
                roomId,
                currentlyServing.step?.step_type ?? null,
                durationSec,
              )
              .catch((err) => this.logger.warn(`Failed recording service duration: ${err.message}`));
          }
        } else {
          // Patient did not show up before calling next -> auto mark MISSING
          await tx.queue.update({
            where: { queue_id: currentlyServing.queue_id },
            data: {
              status: QueueStatusEnum.MISSING,
              missed_at: now,
              missed_count: { increment: 1 },
            },
          });

          await tx.step.update({
            where: { step_id: currentlyServing.step_id },
            data: { step_status: StepStatusEnum.PENDING },
          });

          await tx.move_Log.create({
            data: {
              queue_id: currentlyServing.queue_id,
              action_type: 'MISSED',
              actor_account_id: user?.id ?? null,
              reason: 'Tự động đánh dấu vắng mặt khi gọi lượt tiếp theo',
            },
          });
        }
      }

      // 2. Pick next patient (order read uses same tx client)
      let nextQueueId: string | undefined;

      if (stepId) {
        const stepQueue = await tx.queue.findFirst({
          where: {
            step_id: stepId,
            status: { in: [QueueStatusEnum.PENDING, QueueStatusEnum.QUEUED] },
            OR: [
              { room_id: roomId },
              { room_id: null },
            ],
          },
        });
        if (!stepQueue) {
          throw new BadRequestException('Lượt khám không hợp lệ, không đúng phòng ban hoặc đã được xử lý.');
        }
        if (!stepQueue.room_id) {
          await tx.queue.update({
            where: { queue_id: stepQueue.queue_id },
            data: { room_id: roomId },
          });
        }
        nextQueueId = stepQueue.queue_id;
      } else {
        const order = await this.queuePriorityService.computeQueueOrder(roomId, tx);
        if (!order || order.length === 0) {
          throw new BadRequestException('Hàng chờ trống.');
        }
        nextQueueId = order[0].queue.queue_id;
      }

      // 3. Optimistic locking check & update to SERVING
      const updateResult = await tx.queue.updateMany({
        where: {
          queue_id: nextQueueId,
          status: { in: [QueueStatusEnum.PENDING, QueueStatusEnum.QUEUED] },
        },
        data: {
          status: QueueStatusEnum.SERVING,
          called_at: new Date(),
          serving_started_at: new Date(),
        },
      });

      if (updateResult.count === 0) {
        throw new BadRequestException('Lượt khám này đã được gọi hoặc thay đổi trạng thái.');
      }

      const nextQueue = await tx.queue.findUnique({
        where: { queue_id: nextQueueId },
      });

      if (nextQueue) {
        await tx.step.update({
          where: { step_id: nextQueue.step_id },
          data: {
            step_status: StepStatusEnum.IN_PROGRESS,
            staff_id: staffId,
          },
        });

        await tx.move_Log.create({
          data: {
            queue_id: nextQueue.queue_id,
            action_type: 'CALLED',
            actor_account_id: user?.id ?? null,
          },
        });
      }
    });

    const displayPayload = await this.getRoomDisplayPayload(roomId, staffId);
    this.broadcastRoomUpdate(roomId, staffId, displayPayload);

    return {
      code: 200,
      status: 'success',
      message: 'Đã gọi bệnh nhân và cập nhật màn hình TV',
      data: displayPayload,
    };
  }

  async broadcastRoomUpdate(roomId: string, staffId?: string, preloadedPayload?: any): Promise<void> {
    try {
      const payload = preloadedPayload || (await this.getRoomDisplayPayload(roomId, staffId));
      this.queueGateway.emitQueueUpdate(roomId, payload);
    } catch (err: any) {
      this.logger.warn(`WS emit failed for room ${roomId}: ${err?.message || err}`);
    }
  }

  async getRoomDisplayPayload(roomId: string, staffId?: string) {
    // Heal orphans first so upcoming/current queries by room_id stay consistent
    await this.prisma.queue.updateMany({
      where: {
        room_id: null,
        status: {
          in: [
            QueueStatusEnum.PENDING,
            QueueStatusEnum.QUEUED,
            QueueStatusEnum.CALLED,
            QueueStatusEnum.SERVING,
            QueueStatusEnum.MISSING,
          ],
        },
        step: { room_id: roomId },
      },
      data: { room_id: roomId },
    });

    const currentQueue = await this.prisma.queue.findFirst({
      where: {
        status: { in: [QueueStatusEnum.SERVING, QueueStatusEnum.CALLED] },
        OR: [
          { room_id: roomId },
          { room_id: null, step: { room_id: roomId } },
        ],
      },
      include: {
        step: {
          include: {
            ...SERVING_STEP_INCLUDE,
            staff: true,
            room: { include: { specialty: true } },
          },
        },
      },
    });

    const room = await this.prisma.room.findUnique({
      where: { room_id: roomId },
      include: { specialty: true },
    });

    const staff = staffId
      ? await this.prisma.staff.findUnique({ where: { staff_id: staffId } })
      : currentQueue?.step?.staff;

    const upcomingOrder = await this.queuePriorityService.computeQueueOrder(roomId);
    const roomEta = await this.queueEtaService.computeEtaForRoom(roomId);
    const etaMap = new Map<string, EntryEtaInfo>();
    for (const e of roomEta.entries) {
      etaMap.set(e.queueId, e);
    }

    const serving = currentQueue ? this.buildServingPayload(currentQueue) : null;

    return {
      room_info: {
        specialty_name: room?.specialty?.specialty_name || 'KHOA KHÁM BỆNH',
        room_name: room?.room_name || 'Phòng Khám',
        doctor_name: staff?.full_name ? `BS. ${staff.full_name}` : 'Đang cập nhật',
      },
      // TV: số + tên + status (CALLING/IN_PROGRESS); staff có thể dùng `serving` đầy đủ
      current_patient: currentQueue
        ? {
            queue_id: currentQueue.queue_id,
            queue_number: currentQueue.queue_number,
            patient_name:
              (currentQueue.step as any)?.flow?.booking?.patient?.full_name ||
              '---',
            status:
              currentQueue.status === QueueStatusEnum.CALLED
                ? 'CALLING'
                : currentQueue.status === QueueStatusEnum.SERVING
                  ? 'IN_PROGRESS'
                  : String(currentQueue.status),
          }
        : null,
      serving,
      upcoming_patients: upcomingOrder.slice(0, 5).map((entry) => {
        const etaInfo = etaMap.get(entry.queue.queue_id);
        return {
          queue_id: entry.queue.queue_id,
          queue_number: entry.queue.queue_number,
          patient_name: (entry.queue as any).step?.flow?.booking?.patient?.full_name || '---',
          queue_type: entry.queue.queue_type,
          priority_reasons: entry.reasons,
          eta_minutes: etaInfo ? Math.round(etaInfo.etaSec / 60) : 0,
        };
      }),
      timestamp: new Date().toISOString(),
    };
  }

  async transferQueue(
    stepId: string,
    toRoomId: string,
    staffId?: string,
    user?: { id: string; role: string },
  ) {
    const step = await this.prisma.step.findUnique({
      where: { step_id: stepId },
      include: { queues: true },
    });

    if (!step) {
      throw new NotFoundException('Không tìm thấy lượt khám (step).');
    }

    const fromRoomId = step.room_id;

    if (user && fromRoomId) {
      await this.assertCanManageRoom(user, fromRoomId);
    }

    const activeQueue = step.queues.find(
      (q) => q.status !== QueueStatusEnum.FINISHED && q.status !== QueueStatusEnum.CANCELLED,
    );

    const newQueue = await this.prisma.$transaction(async (tx) => {
      if (activeQueue) {
        await tx.queue.update({
          where: { queue_id: activeQueue.queue_id },
          data: { status: QueueStatusEnum.CANCELLED },
        });
      }

      await tx.step.update({
        where: { step_id: stepId },
        data: {
          room_id: toRoomId,
          staff_id: staffId ?? null,
        },
      });

      if (activeQueue) {
        await tx.move_Log.create({
          data: {
            queue_id: activeQueue.queue_id,
            action_type: 'TRANSFERRED',
            actor_account_id: user?.id ?? null,
            payload: { from_room_id: fromRoomId, to_room_id: toRoomId },
          },
        });
      }

      return this.enqueueStep(stepId, QueueTypeEnum.TRANSFER, tx);
    });

    if (fromRoomId) {
      await this.broadcastRoomUpdate(fromRoomId);
    }
    await this.broadcastRoomUpdate(toRoomId);

    return {
      code: 200,
      status: 'success',
      message: 'Đã chuyển bệnh nhân sang phòng khám mới thành công.',
      data: newQueue,
    };
  }

  async overrideQueuePosition(
    queueId: string,
    dto: { action: 'PIN_TOP' | 'MOVE_TO_POSITION' | 'UNPIN'; position?: number; reason?: string },
    user: { id: string; role: string },
  ) {
    const queue = await this.prisma.queue.findUnique({
      where: { queue_id: queueId },
    });

    if (!queue || !queue.room_id) {
      throw new NotFoundException('Không tìm thấy lượt chờ.');
    }

    await this.assertCanManageRoom(user, queue.room_id);

    const orderBefore = await this.queuePriorityService.computeQueueOrder(queue.room_id);
    const fromPos = orderBefore.findIndex((o) => o.queue.queue_id === queueId);

    let updateData: Prisma.QueueUpdateInput = {};
    let actionType = 'MOVED_POSITION';

    if (dto.action === 'PIN_TOP') {
      updateData = { is_pinned: true, pinned_at: new Date() };
      actionType = 'PINNED_TOP';
    } else if (dto.action === 'UNPIN') {
      updateData = { is_pinned: false, pinned_at: null };
      actionType = 'UNPINNED';
    } else if (dto.action === 'MOVE_TO_POSITION') {
      const pos = dto.position ?? 0;
      if (pos > fromPos && fromPos !== -1) {
        updateData = { hold_positions: pos, is_pinned: false, pinned_at: null };
      } else {
        updateData = { is_pinned: true, pinned_at: new Date() };
      }
    }

    const updatedQueue = await this.prisma.queue.update({
      where: { queue_id: queueId },
      data: updateData,
    });

    const orderAfter = await this.queuePriorityService.computeQueueOrder(queue.room_id);
    const toPos = orderAfter.findIndex((o) => o.queue.queue_id === queueId);

    await this.prisma.move_Log.create({
      data: {
        queue_id: queueId,
        action_type: actionType,
        actor_account_id: user.id,
        reason: dto.reason,
        payload: { from_position: fromPos, to_position: toPos },
      },
    });

    await this.broadcastRoomUpdate(queue.room_id);

    return {
      code: 200,
      status: 'success',
      message: 'Đã cập nhật vị trí lượt chờ.',
      data: updatedQueue,
    };
  }

  async markQueueMissed(queueId: string, user: { id: string; role: string }) {
    const queue = await this.prisma.queue.findUnique({
      where: { queue_id: queueId },
    });

    if (!queue || !queue.room_id) {
      throw new NotFoundException('Không tìm thấy lượt chờ.');
    }

    await this.assertCanManageRoom(user, queue.room_id);

    const allowedStatuses: QueueStatusEnum[] = [
      QueueStatusEnum.CALLED,
      QueueStatusEnum.SERVING,
    ];
    let canMiss = allowedStatuses.includes(queue.status);

    if (!canMiss && queue.status === QueueStatusEnum.QUEUED) {
      const order = await this.queuePriorityService.computeQueueOrder(queue.room_id);
      canMiss = order[0]?.queue.queue_id === queueId;
    }

    if (!canMiss) {
      throw new BadRequestException(
        'Chỉ được đánh dấu vắng mặt khi đang gọi/phục vụ hoặc đang đứng đầu hàng chờ.',
      );
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const q = await tx.queue.update({
        where: { queue_id: queueId },
        data: {
          status: QueueStatusEnum.MISSING,
          missed_at: new Date(),
          missed_count: { increment: 1 },
        },
      });

      await tx.step.update({
        where: { step_id: queue.step_id },
        data: { step_status: StepStatusEnum.PENDING },
      });

      await tx.move_Log.create({
        data: {
          queue_id: queueId,
          action_type: 'MISSED',
          actor_account_id: user.id,
        },
      });

      return q;
    });

    await this.broadcastRoomUpdate(queue.room_id);

    return {
      code: 200,
      status: 'success',
      message: 'Đã đánh dấu vắng mặt.',
      data: updated,
    };
  }

  async recallQueue(queueId: string, user: { id: string; role: string }) {
    const queue = await this.prisma.queue.findUnique({
      where: { queue_id: queueId },
    });

    if (!queue || !queue.room_id) {
      throw new NotFoundException('Không tìm thấy lượt chờ.');
    }

    if (queue.status !== QueueStatusEnum.MISSING) {
      throw new BadRequestException('Chỉ lượt chờ trạng thái VẮNG MẶT mới được gọi lại.');
    }

    await this.assertCanManageRoom(user, queue.room_id);

    const rules = await this.queuePriorityService.getActiveRules();
    const missedRule = rules.find((r) => r.rule_type === QueueRuleTypeEnum.MISSED_TURN);
    const holdPositions = (missedRule?.params as any)?.hold_positions ?? 3;

    const updated = await this.prisma.$transaction(async (tx) => {
      const q = await tx.queue.update({
        where: { queue_id: queueId },
        data: {
          status: QueueStatusEnum.QUEUED,
          hold_positions: holdPositions,
        },
      });

      await tx.move_Log.create({
        data: {
          queue_id: queueId,
          action_type: 'RECALLED',
          actor_account_id: user.id,
        },
      });

      return q;
    });

    await this.broadcastRoomUpdate(queue.room_id);

    return {
      code: 200,
      status: 'success',
      message: 'Đã gọi lại bệnh nhân vào hàng chờ.',
      data: updated,
    };
  }

  async getRoomQueueView(roomId: string, user: { id: string; role: string }) {
    await this.assertCanManageRoom(user, roomId);

    const servingQueue = await this.prisma.queue.findFirst({
      where: {
        room_id: roomId,
        status: QueueStatusEnum.SERVING,
      },
      include: {
        step: {
          include: SERVING_STEP_INCLUDE,
        },
      },
    });

    const roomEta = await this.queueEtaService.computeEtaForRoom(roomId);
    const etaMap = new Map<string, EntryEtaInfo>();
    for (const e of roomEta.entries) {
      etaMap.set(e.queueId, e);
    }

    const waitingOrder = await this.queuePriorityService.computeQueueOrder(roomId);

    const missingEntries = await this.prisma.queue.findMany({
      where: {
        room_id: roomId,
        status: QueueStatusEnum.MISSING,
      },
      include: {
        step: {
          include: {
            flow: {
              include: {
                booking: {
                  include: {
                    patient: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { missed_at: 'asc' },
    });

    const now = new Date();

    return {
      code: 200,
      status: 'success',
      message: 'Lấy danh sách hàng chờ phòng khám thành công.',
      data: {
        room_id: roomId,
        expected_service_minutes: Math.round(roomEta.expectedDurationSec / 60),
        serving: servingQueue ? this.buildServingPayload(servingQueue) : null,
        waiting: waitingOrder.map((entry) => {
          const enqueuedAt = entry.queue.enqueued_at
            ? new Date(entry.queue.enqueued_at)
            : new Date(entry.queue.created_at);
          const waitedMinutes = Math.floor(
            Math.max(0, now.getTime() - enqueuedAt.getTime()) / 60000,
          );
          const etaInfo = etaMap.get(entry.queue.queue_id);
          const etaMinutes = etaInfo ? Math.round(etaInfo.etaSec / 60) : 0;

          return {
            position: entry.position,
            queue_id: entry.queue.queue_id,
            queue_number: entry.queue.queue_number,
            patient_name:
              (entry.queue as any).step?.flow?.booking?.patient?.full_name ||
              '---',
            queue_type: entry.queue.queue_type,
            effective_score: entry.effectiveScore,
            reasons: entry.reasons,
            is_pinned: entry.queue.is_pinned,
            enqueued_at: entry.queue.enqueued_at,
            waited_minutes: waitedMinutes,
            eta_minutes: etaMinutes,
            eta_time: etaInfo?.etaTime || null,
          };
        }),
        missing: missingEntries.map((m) => ({
          queue_id: m.queue_id,
          queue_number: m.queue_number,
          patient_name: m.step?.flow?.booking?.patient?.full_name || '---',
          missed_at: m.missed_at,
        })),
      },
    };
  }

  buildServingPayload(servingQueue: any) {
    const step = servingQueue.step;
    const patient = step?.flow?.booking?.patient ?? null;
    const so = step?.service_order ?? null;

    return {
      queue_id: servingQueue.queue_id,
      queue_number: servingQueue.queue_number,
      serving_started_at: servingQueue.serving_started_at,
      patient: patient
        ? {
            patient_id: patient.patient_id,
            full_name: patient.full_name,
            dob: patient.dob,
            gender: patient.gender,
          }
        : null,
      step: step
        ? {
            step_id: step.step_id,
            step_name: step.step_name,
            step_type: step.step_type,
            step_status: step.step_status,
            service_code: step.service_code,
          }
        : null,
      service_order: so
        ? {
            service_order_id: so.service_order_id,
            name: so.name,
            status: so.status,
            details: (so.serviceOrderDetails || []).map((d: any) => ({
              service_order_detail_id: d.service_order_detail_id,
              name: d.name || d.service?.service_name || null,
              service_id: d.service_id,
              service_code: d.service?.service_code || null,
              service_name: d.service?.service_name || null,
              quantity: d.quantity,
              status: d.status,
            })),
          }
        : null,
    };
  }

  private async assertQueueServing(
    queueId: string,
    user: { id: string; role: string },
  ) {
    const queue = await this.prisma.queue.findUnique({
      where: { queue_id: queueId },
      include: {
        step: {
          include: SERVING_STEP_INCLUDE,
        },
      },
    });

    if (!queue || !queue.room_id) {
      throw new NotFoundException('Không tìm thấy lượt chờ.');
    }
    if (queue.status !== QueueStatusEnum.SERVING) {
      throw new BadRequestException(
        'Chỉ thao tác được trên lượt đang phục vụ (SERVING).',
      );
    }

    await this.assertCanManageRoom(user, queue.room_id, queue.step_id);
    return queue;
  }

  async syncServiceOrderFromStep(
    step: {
      step_id: string;
      service_order_id: string | null;
      service_code: string | null;
      service_order?: any;
    },
    outcome: 'complete' | 'refuse',
    tx?: Prisma.TransactionClient,
  ) {
    if (!step.service_order_id) return;

    const db = tx || this.prisma;
    const so =
      step.service_order ||
      (await db.service_Order.findUnique({
        where: { service_order_id: step.service_order_id },
        include: {
          serviceOrderDetails: { include: { service: true } },
        },
      }));

    if (!so) return;

    const details = so.serviceOrderDetails || [];
    const active = details.filter((d: any) =>
      ACTIVE_SOD_STATUSES.includes(d.status),
    );
    if (active.length === 0) return;

    let targets = active.filter(
      (d: any) =>
        step.service_code &&
        d.service?.service_code &&
        d.service.service_code === step.service_code,
    );

    if (targets.length === 0) {
      targets = active.length === 1 ? active : active;
    }

    const detailStatus =
      outcome === 'complete'
        ? ServiceOrderDetailStatusEnum.COMPLETED
        : ServiceOrderDetailStatusEnum.CANCELLED;

    await db.service_Order_Detail.updateMany({
      where: {
        service_order_detail_id: {
          in: targets.map((d: any) => d.service_order_detail_id),
        },
      },
      data: { status: detailStatus },
    });

    await this.maybeCloseServiceOrder(step.service_order_id, outcome, db);
  }

  private async maybeCloseServiceOrder(
    serviceOrderId: string,
    outcome: 'complete' | 'refuse',
    tx?: Prisma.TransactionClient,
  ) {
    const db = tx || this.prisma;
    const remaining = await db.service_Order_Detail.count({
      where: {
        service_order_id: serviceOrderId,
        status: { in: ACTIVE_SOD_STATUSES },
      },
    });

    if (remaining > 0) return;

    await db.service_Order.update({
      where: { service_order_id: serviceOrderId },
      data: {
        status:
          outcome === 'complete'
            ? ServiceOrderStatusEnum.COMPLETED
            : ServiceOrderStatusEnum.CANCELLED,
      },
    });
  }

  /**
   * Close SERVING queue for a step (used by StepService complete/decline legacy paths).
   */
  async closeServingQueueByStepId(
    stepId: string,
    outcome: 'complete' | 'refuse',
    reason?: string,
  ) {
    const queue = await this.prisma.queue.findFirst({
      where: {
        step_id: stepId,
        status: QueueStatusEnum.SERVING,
      },
      include: {
        step: {
          include: SERVING_STEP_INCLUDE,
        },
      },
    });
    if (!queue) return null;

    await this.syncServiceOrderFromStep(queue.step as any, outcome);
    return this.closeServingQueue(queue, outcome, reason);
  }

  async closeServingQueue(
    queue: Queue & { step?: { step_type?: StepTypeEnum | null } | null },
    outcome: 'complete' | 'refuse',
    reason?: string,
    actorId?: string | null,
  ) {
    const now = new Date();
    const status =
      outcome === 'complete'
        ? QueueStatusEnum.FINISHED
        : QueueStatusEnum.CANCELLED;

    const updated = await this.prisma.queue.update({
      where: { queue_id: queue.queue_id },
      data: {
        status,
        finished_at: outcome === 'complete' ? now : queue.finished_at,
      },
    });

    await this.prisma.move_Log.create({
      data: {
        queue_id: queue.queue_id,
        action_type: outcome === 'complete' ? 'FINISHED' : 'DECLINED',
        actor_account_id: actorId ?? null,
        reason: reason ?? null,
      },
    });

    if (
      outcome === 'complete' &&
      queue.room_id &&
      queue.serving_started_at
    ) {
      const durationSec = Math.round(
        (now.getTime() - new Date(queue.serving_started_at).getTime()) / 1000,
      );
      this.queueEtaService
        .recordServiceDuration(
          queue.room_id,
          queue.step?.step_type ?? null,
          durationSec,
        )
        .catch((err) =>
          this.logger.warn(`Failed recording service duration: ${err.message}`),
        );
    }

    if (queue.room_id) {
      await this.broadcastRoomUpdate(queue.room_id);
    }

    return updated;
  }

  async completeServingQueue(
    queueId: string,
    user: { id: string; role: string },
  ) {
    const queue = await this.assertQueueServing(queueId, user);
    const step = queue.step as any;

    await this.stepService.completeStep(step.step_id, {
      skipCloseServingQueue: true,
    });

    await this.syncServiceOrderFromStep(step, 'complete');
    await this.closeServingQueue(queue, 'complete', undefined, user.id);

    const view = await this.getRoomQueueView(queue.room_id!, user);
    return {
      code: 200,
      status: 'success',
      message: 'Đã hoàn thành lượt phục vụ tại phòng.',
      data: view.data,
    };
  }

  async refuseServingQueue(
    queueId: string,
    user: { id: string; role: string },
    reason?: string,
  ) {
    const queue = await this.assertQueueServing(queueId, user);
    const step = queue.step as any;

    await this.stepService.declineStep(step.step_id, {
      skipCloseServingQueue: true,
      reason,
    });

    await this.syncServiceOrderFromStep(step, 'refuse');
    await this.closeServingQueue(queue, 'refuse', reason, user.id);

    const view = await this.getRoomQueueView(queue.room_id!, user);
    return {
      code: 200,
      status: 'success',
      message: 'Đã từ chối lượt phục vụ tại phòng.',
      data: view.data,
    };
  }

  async completeServiceOrderDetail(
    queueId: string,
    detailId: string,
    user: { id: string; role: string },
  ) {
    const queue = await this.assertQueueServing(queueId, user);
    const step = queue.step as any;
    if (!step?.service_order_id) {
      throw new BadRequestException('Lượt này không gắn Service Order.');
    }

    const detail = await this.prisma.service_Order_Detail.findFirst({
      where: {
        service_order_detail_id: detailId,
        service_order_id: step.service_order_id,
      },
    });
    if (!detail) {
      throw new NotFoundException('Không tìm thấy chi tiết chỉ định thuộc lượt này.');
    }
    if (!ACTIVE_SOD_STATUSES.includes(detail.status)) {
      throw new BadRequestException('Chi tiết chỉ định không còn ở trạng thái chờ xử lý.');
    }

    await this.prisma.service_Order_Detail.update({
      where: { service_order_detail_id: detailId },
      data: { status: ServiceOrderDetailStatusEnum.COMPLETED },
    });
    await this.maybeCloseServiceOrder(step.service_order_id, 'complete');

    if (queue.room_id) {
      await this.broadcastRoomUpdate(queue.room_id);
    }

    const view = await this.getRoomQueueView(queue.room_id!, user);
    return {
      code: 200,
      status: 'success',
      message: 'Đã hoàn thành chi tiết chỉ định.',
      data: view.data.serving,
    };
  }

  async refuseServiceOrderDetail(
    queueId: string,
    detailId: string,
    user: { id: string; role: string },
  ) {
    const queue = await this.assertQueueServing(queueId, user);
    const step = queue.step as any;
    if (!step?.service_order_id) {
      throw new BadRequestException('Lượt này không gắn Service Order.');
    }

    const detail = await this.prisma.service_Order_Detail.findFirst({
      where: {
        service_order_detail_id: detailId,
        service_order_id: step.service_order_id,
      },
    });
    if (!detail) {
      throw new NotFoundException('Không tìm thấy chi tiết chỉ định thuộc lượt này.');
    }
    if (!ACTIVE_SOD_STATUSES.includes(detail.status)) {
      throw new BadRequestException('Chi tiết chỉ định không còn ở trạng thái chờ xử lý.');
    }

    await this.prisma.service_Order_Detail.update({
      where: { service_order_detail_id: detailId },
      data: { status: ServiceOrderDetailStatusEnum.CANCELLED },
    });
    await this.maybeCloseServiceOrder(step.service_order_id, 'refuse');

    if (queue.room_id) {
      await this.broadcastRoomUpdate(queue.room_id);
    }

    const view = await this.getRoomQueueView(queue.room_id!, user);
    return {
      code: 200,
      status: 'success',
      message: 'Đã từ chối chi tiết chỉ định.',
      data: view.data.serving,
    };
  }

  async completeServiceOrder(
    queueId: string,
    orderId: string,
    user: { id: string; role: string },
  ) {
    const queue = await this.assertQueueServing(queueId, user);
    const step = queue.step as any;
    if (!step?.service_order_id || step.service_order_id !== orderId) {
      throw new BadRequestException(
        'Service Order không khớp với lượt đang phục vụ.',
      );
    }

    await this.prisma.service_Order_Detail.updateMany({
      where: {
        service_order_id: orderId,
        status: { in: ACTIVE_SOD_STATUSES },
      },
      data: { status: ServiceOrderDetailStatusEnum.COMPLETED },
    });
    await this.prisma.service_Order.update({
      where: { service_order_id: orderId },
      data: { status: ServiceOrderStatusEnum.COMPLETED },
    });

    if (queue.room_id) {
      await this.broadcastRoomUpdate(queue.room_id);
    }

    const view = await this.getRoomQueueView(queue.room_id!, user);
    return {
      code: 200,
      status: 'success',
      message: 'Đã hoàn thành toàn bộ Service Order.',
      data: view.data.serving,
    };
  }

  async refuseServiceOrder(
    queueId: string,
    orderId: string,
    user: { id: string; role: string },
  ) {
    const queue = await this.assertQueueServing(queueId, user);
    const step = queue.step as any;
    if (!step?.service_order_id || step.service_order_id !== orderId) {
      throw new BadRequestException(
        'Service Order không khớp với lượt đang phục vụ.',
      );
    }

    await this.prisma.service_Order_Detail.updateMany({
      where: {
        service_order_id: orderId,
        status: { in: ACTIVE_SOD_STATUSES },
      },
      data: { status: ServiceOrderDetailStatusEnum.CANCELLED },
    });
    await this.prisma.service_Order.update({
      where: { service_order_id: orderId },
      data: { status: ServiceOrderStatusEnum.CANCELLED },
    });

    if (queue.room_id) {
      await this.broadcastRoomUpdate(queue.room_id);
    }

    const view = await this.getRoomQueueView(queue.room_id!, user);
    return {
      code: 200,
      status: 'success',
      message: 'Đã từ chối toàn bộ Service Order.',
      data: view.data.serving,
    };
  }

  async computeRoomEta(roomId: string) {
    return await this.queueEtaService.computeEtaForRoom(roomId);
  }

  async updateRoomDefaultDurationSec(
    roomId: string,
    stepType: StepTypeEnum,
    defaultDurationSec: number,
  ) {
    return await this.queueEtaService.updateDefaultDurationSec(roomId, stepType, defaultDurationSec);
  }
}
