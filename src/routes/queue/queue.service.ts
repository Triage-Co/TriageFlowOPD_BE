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
  RebalanceSuggestionStatusEnum,
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
import { QueueCacheService } from './queue-cache.service';
import {
  buildQueueDateFilter,
  parseStringCodeList,
  pickSameDayFlaggedSession,
  resolveManualCodesForEnqueue,
  REBALANCE_REDIRECT_OVERLAY_MS,
  REBALANCEABLE_STEP_TYPES,
} from './queue.constants';
import { StepService } from '../step/step.service';
import { ScanQueueDto } from './dto/create-queue.dto';

const ACTIVE_SOD_STATUSES: ServiceOrderDetailStatusEnum[] = [
  ServiceOrderDetailStatusEnum.PENDING,
  ServiceOrderDetailStatusEnum.PAID,
  ServiceOrderDetailStatusEnum.IN_PROGRESS,
];

function toValidUuidOrNull(val?: string | null): string | null {
  if (!val) return null;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(val)
    ? val
    : null;
}

function readOldQueueNumber(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return null;
  }
  const old = (payload as Record<string, unknown>).old_queue_number;
  if (typeof old === 'string' && old.trim()) return old;
  if (typeof old === 'number') return String(old);
  return null;
}

const SERVING_STEP_INCLUDE = {
  flow: {
    include: {
      booking: {
        include: {
          patient: {
            include: {
              account: {
                select: {
                  phone: true,
                },
              },
            },
          },
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
    (zonedCheck.getHours() * 60 + zonedCheck.getMinutes()) * 60 * 1000 +
    zonedCheck.getSeconds() * 1000;

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

    private readonly queueCacheService: QueueCacheService,
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

    throw new ForbiddenException(
      'Bạn không có quyền thao tác trên phòng khám này.',
    );
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
    targetDate: Date = new Date(),
  ): Promise<string> {
    const client = tx || this.prisma;
    const startOfDay = getStartOfDayVn(targetDate);
    const endOfDay = getEndOfDayVn(targetDate);

    const count = await client.queue.count({
      where: {
        room_id: roomId,
        ...buildQueueDateFilter(startOfDay, endOfDay),
      },
    });

    return (count + 1).toString();
  }

  private async evaluatePriorityForStep(
    step: {
      room?: {
        room_type: ClinicalRoomType;
        specialty_id: string | null;
      } | null;
      flow?: {
        booking?: {
          patient?: {
            patient_id: string;
            dob: Date | null;
            gender: any;
          } | null;
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
            manual_rule_codes?: unknown;
          } | null;
        } | null;
      } | null;
    },
    queueType: QueueTypeEnum,
    missedCount: number,
    prismaTx: Prisma.TransactionClient,
    manualRuleCodes?: string[],
  ): Promise<{
    basePriority: number;
    appliedRules: { rule_code: string; weight: number }[] | null;
    queueType?: QueueTypeEnum;
  }> {
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
        ? {
            dob: patient.dob ? new Date(patient.dob) : null,
            gender: patient.gender,
          }
        : null,
      queueType,
      suggestedPriority,
      vitals,
      appointmentOnTime,
      missedCount,
      roomType: step.room?.room_type ?? null,
      specialtyId: step.room?.specialty_id ?? null,
      manualRuleCodes,
    });

    return {
      basePriority: evalResult.basePriority,
      appliedRules: evalResult.appliedRules,
      queueType: evalResult.queueType,
    };
  }

  private async loadVisitManualRuleCodes(
    prismaTx: Prisma.TransactionClient,
    booking:
      | {
          booking_id?: string;
          patient_id?: string;
          patient?: { patient_id: string } | null;
          visitSession?: { manual_rule_codes?: unknown } | null;
        }
      | null
      | undefined,
  ): Promise<string[]> {
    const attached = parseStringCodeList(
      booking?.visitSession?.manual_rule_codes,
    );
    if (attached.length > 0) return attached;

    const patientId = booking?.patient_id ?? booking?.patient?.patient_id;
    if (!patientId) return [];

    const sessions = await prismaTx.visit_Session.findMany({
      where: {
        patient_id: patientId,
        visit_date: { gte: getStartOfDayVn(), lte: getEndOfDayVn() },
      },
      orderBy: { visit_date: 'desc' },
      take: 20,
      select: {
        booking_id: true,
        visit_date: true,
        manual_rule_codes: true,
      },
    });

    const picked = pickSameDayFlaggedSession(sessions, booking?.booking_id);
    return parseStringCodeList(picked?.manual_rule_codes);
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

      const visitCodes = await this.loadVisitManualRuleCodes(
        prismaTx,
        step.flow?.booking,
      );

      if (existingQueue) {
        const { codes: manualCodes, copyToQueue: needsCopyFlags } =
          resolveManualCodesForEnqueue(
            existingQueue.manual_rule_codes,
            visitCodes,
          );
        const needsRepair = !existingQueue.room_id;
        const needsRetype =
          options?.forceType === true && existingQueue.queue_type !== queueType;

        if (!needsRepair && !needsRetype && !needsCopyFlags) {
          return existingQueue;
        }

        const baseType = needsRetype ? queueType : existingQueue.queue_type;

        const {
          basePriority,
          appliedRules,
          queueType: typeOverride,
        } = await this.evaluatePriorityForStep(
          step,
          baseType,
          existingQueue.missed_count ?? 0,
          prismaTx,
          manualCodes,
        );

        return prismaTx.queue.update({
          where: { queue_id: existingQueue.queue_id },
          data: {
            room_id: step.room_id,
            queue_type: typeOverride ?? baseType,
            base_priority: basePriority,
            applied_rules: appliedRules ?? undefined,
            ...(needsCopyFlags ? { manual_rule_codes: manualCodes } : {}),
            status:
              existingQueue.status === QueueStatusEnum.PENDING
                ? QueueStatusEnum.QUEUED
                : existingQueue.status,
          },
        });
      }

      const targetDate = step.flow?.booking?.slot?.shift?.date
        ? new Date(step.flow.booking.slot.shift.date)
        : new Date();

      const nextNumber = await this.generateQueueNumberForRoom(
        step.room_id,
        prismaTx,
        targetDate,
      );
      const { codes: manualCodes, copyToQueue } = resolveManualCodesForEnqueue(
        null,
        visitCodes,
      );
      const {
        basePriority,
        appliedRules,
        queueType: typeOverride,
      } = await this.evaluatePriorityForStep(
        step,
        queueType,
        0,
        prismaTx,
        manualCodes,
      );

      return prismaTx.queue.create({
        data: {
          step_id: stepId,
          room_id: step.room_id,
          queue_number: nextNumber,
          queue_type: typeOverride ?? queueType,
          base_priority: basePriority,
          applied_rules: appliedRules ?? undefined,
          ...(copyToQueue ? { manual_rule_codes: manualCodes } : {}),
          enqueued_at: new Date(),
          status: QueueStatusEnum.QUEUED,
        },
      });
    };

    const result = tx
      ? await execute(tx)
      : await this.prisma.$transaction(execute);

    if (result.room_id) {
      await this.broadcastRoomUpdate(result.room_id);

      // Fire-and-forget rebalance detector for CLS/procedure queues
      this.prisma.step
        .findUnique({
          where: { step_id: result.step_id },
          select: { step_type: true },
        })
        .then((step) => {
          if (
            step?.step_type &&
            REBALANCEABLE_STEP_TYPES.includes(step.step_type)
          ) {
            this.queueRebalanceService.scheduleDetectAndSuggest();
          }
        })
        .catch((err) =>
          this.logger.warn(
            `Post-enqueue rebalance failed: ${err?.message || err}`,
          ),
        );
    }

    return result;
  }

  /**
   * After SO payment succeeds: create at most ONE active queue for the order
   * (primary non-PAYMENT step). PHARMACY / DISPENSING orders are skipped.
   */
  async generateServiceQueueNumber(serviceOrderId: string) {
    const serviceOrder = await this.prisma.service_Order.findUnique({
      where: { service_order_id: serviceOrderId },
      select: {
        payment_status: true,
        type: true,
      },
    });

    if (
      !serviceOrder ||
      serviceOrder.payment_status !== PaymentStatusEnum.SUCCESSED
    ) {
      return;
    }

    // Pharmacy / dispensing: never enter clinical queue
    if (serviceOrder.type === StepTypeEnum.DISPENSING) {
      return;
    }

    const steps = await this.prisma.step.findMany({
      where: {
        service_order_id: serviceOrderId,
        step_type: { not: StepTypeEnum.PAYMENT },
        step_status: { not: StepStatusEnum.CANCELLED },
      },
      orderBy: { created_at: 'asc' },
      include: {
        queues: true,
        room: true,
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

    if (steps.length === 0) return;

    // Lọc ra các bước khám lâm sàng / cận lâm sàng (bỏ qua bước cấp thuốc nhà thuốc)
    const clinicalSteps = steps.filter(
      (s) => s.room?.room_type !== ClinicalRoomType.PHARMACY,
    );

    if (clinicalSteps.length === 0) return;

    // Idempotent: if any step of this SO already has an active queue, do not create another
    for (const step of clinicalSteps) {
      const activeQueue = (step.queues || []).find(
        (q) =>
          q.status !== QueueStatusEnum.FINISHED &&
          q.status !== QueueStatusEnum.CANCELLED,
      );
      if (activeQueue) {
        if (!activeQueue.room_id && step.room_id) {
          const hasBooking = Boolean(step.flow?.booking?.slot_id);
          const queueType = hasBooking
            ? QueueTypeEnum.APPOINTMENT
            : QueueTypeEnum.NEW;
          await this.enqueueStep(step.step_id, queueType, undefined, {
            forceType: true,
          });
        }
        return;
      }
    }

    // Ưu tiên chọn bước đang IN_PROGRESS hoặc bước đầu tiên có phòng
    const primary =
      clinicalSteps.find(
        (s) => s.step_status === StepStatusEnum.IN_PROGRESS && !!s.room_id,
      ) || clinicalSteps.find((s) => !!s.room_id);

    if (!primary) return;

    const hasBooking = Boolean(primary.flow?.booking?.slot_id);
    const queueType = hasBooking
      ? QueueTypeEnum.APPOINTMENT
      : QueueTypeEnum.NEW;
    await this.enqueueStep(primary.step_id, queueType);
  }

  /**
   * Move all clinical steps of an SO + their active queues to a new room.
   * Blocked when any active queue is SERVING.
   */
  async reassignServiceOrderRoom(serviceOrderId: string, newRoomId: string) {
    const newRoom = await this.prisma.room.findUnique({
      where: { room_id: newRoomId },
    });
    if (!newRoom) {
      throw new NotFoundException('Không tìm thấy phòng mới.');
    }

    const steps = await this.prisma.step.findMany({
      where: {
        service_order_id: serviceOrderId,
        step_type: { not: StepTypeEnum.PAYMENT },
        step_status: { not: StepStatusEnum.CANCELLED },
      },
      include: {
        queues: {
          where: {
            status: {
              notIn: [QueueStatusEnum.FINISHED, QueueStatusEnum.CANCELLED],
            },
          },
        },
      },
    });

    if (steps.length === 0) {
      throw new BadRequestException(
        'Service Order không có bước lâm sàng để đổi phòng.',
      );
    }

    const oldRoomIds = new Set<string>();
    for (const step of steps) {
      if (step.room_id) oldRoomIds.add(step.room_id);
      for (const q of step.queues || []) {
        if (q.status === QueueStatusEnum.SERVING) {
          throw new BadRequestException(
            'Không thể đổi phòng khi đang phục vụ bệnh nhân (SERVING).',
          );
        }
        if (q.room_id) oldRoomIds.add(q.room_id);
      }
    }

    if (newRoom.room_type && steps[0].room_id) {
      const firstRoom = await this.prisma.room.findUnique({
        where: { room_id: steps[0].room_id },
        select: { room_type: true },
      });
      if (firstRoom && firstRoom.room_type !== newRoom.room_type) {
        throw new BadRequestException(
          `Phòng mới (${newRoom.room_type}) không cùng loại với order (${firstRoom.room_type}).`,
        );
      }
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.step.updateMany({
        where: {
          service_order_id: serviceOrderId,
          step_type: { not: StepTypeEnum.PAYMENT },
          step_status: { not: StepStatusEnum.CANCELLED },
        },
        data: { room_id: newRoomId },
      });

      const stepIds = steps.map((s) => s.step_id);
      await tx.queue.updateMany({
        where: {
          step_id: { in: stepIds },
          status: {
            notIn: [QueueStatusEnum.FINISHED, QueueStatusEnum.CANCELLED],
          },
        },
        data: { room_id: newRoomId },
      });
    });

    for (const oldId of oldRoomIds) {
      if (oldId !== newRoomId) {
        await this.broadcastRoomUpdate(oldId);
      }
    }
    await this.broadcastRoomUpdate(newRoomId);
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

    let rebalanceStepType: StepTypeEnum | null = null;
    await this.prisma.$transaction(async (tx) => {
      // 1. Process currently active patient in room (SERVING or CALLED)
      const currentlyActive = await tx.queue.findFirst({
        where: {
          room_id: roomId,
          status: { in: [QueueStatusEnum.SERVING, QueueStatusEnum.CALLED] },
        },
        include: {
          step: true,
        },
      });

      if (currentlyActive) {
        const now = new Date();
        if (currentlyActive.status === QueueStatusEnum.SERVING) {
          rebalanceStepType = currentlyActive.step?.step_type ?? null;
          // Direction A: Auto-finish SERVING patient when calling next
          await tx.queue.update({
            where: { queue_id: currentlyActive.queue_id },
            data: {
              status: QueueStatusEnum.FINISHED,
              finished_at: now,
            },
          });

          if (currentlyActive.step_id) {
            await tx.step.update({
              where: { step_id: currentlyActive.step_id },
              data: { step_status: StepStatusEnum.COMPLETED },
            });
          }

          await tx.move_Log.create({
            data: {
              queue_id: currentlyActive.queue_id,
              action_type: 'FINISHED',
              actor_account_id: user?.id ?? null,
              reason: 'Tự động hoàn thành lượt phục vụ khi gọi lượt tiếp theo',
            },
          });

          if (currentlyActive.serving_started_at) {
            const durationSec = Math.round(
              (now.getTime() -
                new Date(currentlyActive.serving_started_at).getTime()) /
                1000,
            );
            this.queueEtaService
              .recordServiceDuration(
                roomId,
                currentlyActive.step?.step_type ?? null,
                durationSec,
              )
              .catch((err) =>
                this.logger.warn(
                  `Failed recording service duration: ${err.message}`,
                ),
              );
          }
        } else if (currentlyActive.status === QueueStatusEnum.CALLED) {
          rebalanceStepType = currentlyActive.step?.step_type ?? null;
          // Patient was CALLED but did not show up before calling next -> mark MISSING
          await tx.queue.update({
            where: { queue_id: currentlyActive.queue_id },
            data: {
              status: QueueStatusEnum.MISSING,
              missed_at: now,
              missed_count: { increment: 1 },
            },
          });

          if (currentlyActive.step_id) {
            await tx.step.update({
              where: { step_id: currentlyActive.step_id },
              data: { step_status: StepStatusEnum.PENDING },
            });
          }

          await tx.move_Log.create({
            data: {
              queue_id: currentlyActive.queue_id,
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
            OR: [{ room_id: roomId }, { room_id: null }],
          },
        });
        if (!stepQueue) {
          throw new BadRequestException(
            'Lượt khám không hợp lệ, không đúng phòng ban hoặc đã được xử lý.',
          );
        }
        if (!stepQueue.room_id) {
          await tx.queue.update({
            where: { queue_id: stepQueue.queue_id },
            data: { room_id: roomId },
          });
        }
        nextQueueId = stepQueue.queue_id;
      } else {
        const order = await this.queuePriorityService.computeQueueOrder(
          roomId,
          tx,
        );
        if (!order || order.length === 0) {
          throw new BadRequestException('Hàng chờ trống.');
        }
        nextQueueId = order[0].queue.queue_id;
      }

      // 3. Optimistic locking check & update to CALLED
      const updateResult = await tx.queue.updateMany({
        where: {
          queue_id: nextQueueId,
          status: { in: [QueueStatusEnum.PENDING, QueueStatusEnum.QUEUED] },
        },
        data: {
          status: QueueStatusEnum.CALLED,
          called_at: new Date(),
        },
      });

      if (updateResult.count === 0) {
        throw new BadRequestException(
          'Lượt khám này đã được gọi hoặc thay đổi trạng thái.',
        );
      }

      const nextQueue = await tx.queue.findUnique({
        where: { queue_id: nextQueueId },
      });

      if (nextQueue) {
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
    await this.broadcastRoomUpdate(roomId, staffId, displayPayload);
    this.scheduleRebalanceIfCls(rebalanceStepType);

    return {
      code: 200,
      status: 'success',
      message: 'Đã gọi bệnh nhân và cập nhật màn hình TV',
      data: displayPayload,
    };
  }

  async scanQueueTicket(
    dto: ScanQueueDto,
    user: { id: string; role: string },
  ) {
    const { ticket_code, queue_id, room_id, staff_id } = dto;
    await this.assertCanManageRoom(user, room_id);

    let queueItem: any;

    if (ticket_code) {
      queueItem = await this.prisma.queue.findFirst({
        where: {
          step: {
            flow: {
              ticket_code: ticket_code,
            },
          },
          status: {
            in: [
              QueueStatusEnum.CALLED,
              QueueStatusEnum.MISSING,
              QueueStatusEnum.SERVING,
            ],
          },
        },
        include: {
          step: true,
        },
        orderBy: { created_at: 'desc' },
      });

      if (!queueItem) {
        throw new NotFoundException(
          `Không tìm thấy lượt chờ hợp lệ cho vé ${ticket_code}.`,
        );
      }
    } else if (queue_id) {
      queueItem = await this.prisma.queue.findUnique({
        where: { queue_id },
        include: { step: true },
      });

      if (!queueItem) {
        throw new NotFoundException('Không tìm thấy lượt chờ.');
      }
    } else {
      throw new BadRequestException(
        'Vui lòng cung cấp ticket_code hoặc queue_id.',
      );
    }

    // Edge Case 1: Wrong room check
    if (queueItem.room_id && queueItem.room_id !== room_id) {
      throw new BadRequestException(
        'Vé khám này thuộc phòng khác, không phải phòng hiện tại!',
      );
    }

    // Edge Case 3: Already SERVING (Duplicate scan)
    if (queueItem.status === QueueStatusEnum.SERVING) {
      const displayPayload = await this.getRoomDisplayPayload(room_id, staff_id);
      return {
        code: 200,
        status: 'success',
        message: 'Bệnh nhân đã ở trạng thái đang khám.',
        data: displayPayload,
      };
    }

    // Edge Case 2: MISSING ticket -> Recall back to QUEUED
    if (queueItem.status === QueueStatusEnum.MISSING) {
      const rules = await this.queuePriorityService.getActiveRules();
      const missedRule = rules.find(
        (r) => r.rule_type === QueueRuleTypeEnum.MISSED_TURN,
      );
      const holdPositions = (missedRule?.params as any)?.hold_positions ?? 3;

      await this.prisma.$transaction(async (tx) => {
        await tx.queue.update({
          where: { queue_id: queueItem.queue_id },
          data: {
            status: QueueStatusEnum.QUEUED,
            hold_positions: holdPositions,
            room_id: room_id,
          },
        });

        await tx.move_Log.create({
          data: {
            queue_id: queueItem.queue_id,
            action_type: 'RECALLED',
            actor_account_id: user.id,
            reason: 'Quét vé lỡ lượt đưa lại vào hàng chờ',
          },
        });
      });

      await this.broadcastRoomUpdate(room_id, staff_id);

      return {
        code: 200,
        status: 'success',
        message: 'Bệnh nhân lỡ lượt đã được đưa lại vào hàng chờ.',
        data: await this.getRoomDisplayPayload(room_id, staff_id),
      };
    }

    // Normal case: CALLED -> SERVING
    if (queueItem.status === QueueStatusEnum.CALLED) {
      const now = new Date();
      await this.prisma.$transaction(async (tx) => {
        await tx.queue.update({
          where: { queue_id: queueItem.queue_id },
          data: {
            status: QueueStatusEnum.SERVING,
            serving_started_at: now,
            room_id: room_id,
          },
        });

        if (queueItem.step_id) {
          await tx.step.update({
            where: { step_id: queueItem.step_id },
            data: {
              step_status: StepStatusEnum.IN_PROGRESS,
              staff_id: staff_id ?? null,
            },
          });
        }

        await tx.move_Log.create({
          data: {
            queue_id: queueItem.queue_id,
            action_type: 'SERVING',
            actor_account_id: user.id,
          },
        });
      });

      const displayPayload = await this.getRoomDisplayPayload(room_id, staff_id);
      await this.broadcastRoomUpdate(room_id, staff_id, displayPayload);

      return {
        code: 200,
        status: 'success',
        message: 'Đã bắt đầu khám cho bệnh nhân.',
        data: displayPayload,
      };
    }

    throw new BadRequestException(
      `Không thể quét vé ở trạng thái ${queueItem.status}.`,
    );
  }

  async broadcastRoomUpdate(
    roomId: string,
    staffId?: string,
    preloadedPayload?: unknown,
  ): Promise<void> {
    try {
      await this.queueCacheService.invalidateRoom(roomId);
      const payload =
        preloadedPayload || (await this.getRoomDisplayPayload(roomId, staffId));
      this.queueGateway.emitQueueUpdate(roomId, payload);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`WS emit failed for room ${roomId}: ${message}`);
    }
  }

  private scheduleRebalanceIfCls(stepType?: StepTypeEnum | null): void {
    if (stepType && REBALANCEABLE_STEP_TYPES.includes(stepType)) {
      this.queueRebalanceService.scheduleDetectAndSuggest();
    }
  }

  async getRoomDisplayPayload(roomId: string, staffId?: string) {
    const bypassCache = Boolean(staffId);
    if (!bypassCache) {
      const cached =
        await this.queueCacheService.getDisplayPayload<
          Awaited<ReturnType<QueueService['buildRoomDisplayPayload']>>
        >(roomId);
      if (cached) return cached;
    }

    const payload = await this.buildRoomDisplayPayload(roomId, staffId);
    if (!bypassCache) {
      await this.queueCacheService.setDisplayPayload(roomId, payload);
    }
    return payload;
  }

  private async buildRoomDisplayPayload(roomId: string, staffId?: string) {
    const currentQueue = await this.prisma.queue.findFirst({
      where: {
        status: { in: [QueueStatusEnum.SERVING, QueueStatusEnum.CALLED] },
        OR: [{ room_id: roomId }, { room_id: null, step: { room_id: roomId } }],
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

    const staff = await this.resolveRoomDisplayDoctor(
      roomId,
      staffId,
      currentQueue?.step?.staff ?? null,
    );

    const upcomingOrder = await this.queuePriorityService.computeQueueOrder(
      roomId,
      undefined,
      { room_type: room?.room_type, specialty_id: room?.specialty_id },
    );
    const roomEta = await this.queueEtaService.computeEtaForRoom(
      roomId,
      upcomingOrder,
    );
    const etaMap = new Map<string, EntryEtaInfo>();
    for (const e of roomEta.entries) {
      etaMap.set(e.queueId, e);
    }

    const serving = currentQueue
      ? this.buildServingPayload(currentQueue)
      : null;

    const redirectedPatients = await this.getRedirectedPatientsForRoom(roomId);

    return {
      room_info: {
        specialty_name: room?.specialty?.specialty_name || 'KHOA KHÁM BỆNH',
        room_name: room?.room_name || 'Phòng Khám',
        doctor_name: staff?.full_name
          ? `BS. ${staff.full_name}`
          : 'Đang cập nhật',
      },
      // TV: số + tên + status (CALLING/IN_PROGRESS); staff có thể dùng `serving` đầy đủ
      current_patient: currentQueue
        ? {
            queue_id: currentQueue.queue_id,
            queue_number: currentQueue.queue_number,
            patient_name:
              currentQueue.step?.flow?.booking?.patient?.full_name || '---',
            status:
              currentQueue.status === QueueStatusEnum.CALLED
                ? 'CALLING'
                : currentQueue.status === QueueStatusEnum.SERVING
                  ? 'IN_PROGRESS'
                  : String(currentQueue.status),
          }
        : null,
      serving,
      upcoming_patients: upcomingOrder.slice(0, 7).map((entry) => {
        const etaInfo = etaMap.get(entry.queue.queue_id);
        return {
          queue_id: entry.queue.queue_id,
          queue_number: entry.queue.queue_number,
          patient_name:
            entry.queue.step?.flow?.booking?.patient?.full_name || '---',
          queue_type: entry.queue.queue_type,
          priority_reasons: entry.reasons,
          eta_minutes: etaInfo ? Math.round(etaInfo.etaSec / 60) : 0,
        };
      }),
      redirected_patients: redirectedPatients,
      timestamp: new Date().toISOString(),
    };
  }

  private async getRedirectedPatientsForRoom(roomId: string): Promise<
    Array<{
      queue_number: string;
      patient_name: string;
      to_room_name: string;
      expires_at: Date;
    }>
  > {
    const since = new Date(Date.now() - REBALANCE_REDIRECT_OVERLAY_MS);
    const suggestions = await this.prisma.queue_Rebalance_Suggestion.findMany({
      where: {
        from_room_id: roomId,
        status: RebalanceSuggestionStatusEnum.CONFIRMED,
        updated_at: { gte: since },
      },
      include: {
        toRoom: { select: { room_name: true } },
        queue: {
          include: {
            moveLogs: {
              where: { action_type: 'REBALANCED' },
              orderBy: { created_at: 'desc' },
              take: 1,
            },
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
      },
      orderBy: { updated_at: 'desc' },
    });

    return suggestions.map((s) => {
      const oldNumber = readOldQueueNumber(s.queue.moveLogs[0]?.payload);
      return {
        queue_number: oldNumber ?? s.queue.queue_number,
        patient_name:
          s.queue.step?.flow?.booking?.patient?.full_name || '---',
        to_room_name: s.toRoom.room_name,
        expires_at: new Date(
          s.updated_at.getTime() + REBALANCE_REDIRECT_OVERLAY_MS,
        ),
      };
    });
  }

  /**
   * Resolve doctor name for TV room display.
   * Priority: valid staffId UUID → staff on current serving step → shift on duty today.
   */
  private async resolveRoomDisplayDoctor(
    roomId: string,
    staffId?: string,
    servingStepStaff?: { staff_id: string; full_name: string } | null,
  ) {
    const staffIdUuid =
      staffId &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        staffId,
      )
        ? staffId
        : undefined;

    if (staffIdUuid) {
      const byId = await this.prisma.staff.findUnique({
        where: { staff_id: staffIdUuid },
      });
      if (byId) return byId;
    }

    if (servingStepStaff?.full_name) {
      return servingStepStaff;
    }

    const now = new Date();
    const startOfDay = getStartOfDayVn(now);
    const endOfDay = getEndOfDayVn(now);
    const nowHm = formatInTimeZone(now, VN_TZ, 'HH:mm');

    const shiftsToday = await this.prisma.shift.findMany({
      where: {
        room_id: roomId,
        date: { gte: startOfDay, lte: endOfDay },
      },
      include: { staff: true },
      orderBy: { start_time: 'asc' },
    });

    const covering = shiftsToday.find(
      (s) => !!s.staff && s.start_time <= nowHm && nowHm < s.end_time,
    );
    if (covering?.staff) return covering.staff;

    // Fallback: any assigned shift today (before/after exact window)
    return shiftsToday.find((s) => s.staff)?.staff ?? null;
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
      (q) =>
        q.status !== QueueStatusEnum.FINISHED &&
        q.status !== QueueStatusEnum.CANCELLED,
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
    dto: {
      action: 'PIN_TOP' | 'MOVE_TO_POSITION' | 'UNPIN';
      position?: number;
      reason?: string;
    },
    user: { id: string; role: string },
  ) {
    const queue = await this.prisma.queue.findUnique({
      where: { queue_id: queueId },
    });

    if (!queue || !queue.room_id) {
      throw new NotFoundException('Không tìm thấy lượt chờ.');
    }

    await this.assertCanManageRoom(user, queue.room_id);

    const orderBefore = await this.queuePriorityService.computeQueueOrder(
      queue.room_id,
    );
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

    const orderAfter = await this.queuePriorityService.computeQueueOrder(
      queue.room_id,
    );
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
      include: { step: { select: { step_type: true } } },
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
      const order = await this.queuePriorityService.computeQueueOrder(
        queue.room_id,
      );
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
          actor_account_id: toValidUuidOrNull(user?.id),
        },
      });

      return q;
    });

    await this.broadcastRoomUpdate(queue.room_id);
    this.scheduleRebalanceIfCls(queue.step?.step_type);

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
      throw new BadRequestException(
        'Chỉ lượt chờ trạng thái VẮNG MẶT mới được gọi lại.',
      );
    }

    await this.assertCanManageRoom(user, queue.room_id);

    const rules = await this.queuePriorityService.getActiveRules();
    const missedRule = rules.find(
      (r) => r.rule_type === QueueRuleTypeEnum.MISSED_TURN,
    );
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

  async getFlaggableRules() {
    const data = await this.queuePriorityService.getFlaggableRules();
    return {
      code: 200,
      status: 'success',
      message: 'Lấy danh sách quy tắc có thể gắn cờ thành công.',
      data,
    };
  }

  async assertValidManualRuleCodes(codes: string[]): Promise<string[]> {
    return this.validateAndNormalizeManualCodes(codes);
  }

  async updateQueueManualRuleCodes(
    queueId: string,
    codes: string[],
    user: { id: string; role: string },
  ) {
    const queue = await this.prisma.queue.findUnique({
      where: { queue_id: queueId },
    });
    if (!queue || !queue.room_id) {
      throw new NotFoundException('Không tìm thấy lượt chờ.');
    }
    await this.assertCanManageRoom(user, queue.room_id);
    const normalized = await this.validateAndNormalizeManualCodes(codes);
    const updated = await this.applyManualCodesToQueue(
      queue.queue_id,
      normalized,
    );
    await this.broadcastRoomUpdate(queue.room_id);
    return {
      code: 200,
      status: 'success',
      message: 'Đã cập nhật cờ quy tắc ưu tiên.',
      data: updated,
    };
  }

  async applyManualRuleCodesForVisit(
    visitSessionId: string,
    codes: string[],
  ): Promise<void> {
    const normalized = await this.validateAndNormalizeManualCodes(codes);
    const visit = await this.prisma.visit_Session.findUnique({
      where: { visit_session_id: visitSessionId },
      select: { booking_id: true },
    });
    if (!visit?.booking_id) {
      return;
    }

    const queues = await this.prisma.queue.findMany({
      where: {
        status: {
          notIn: [QueueStatusEnum.FINISHED, QueueStatusEnum.CANCELLED],
        },
        step: { flow: { booking_id: visit.booking_id } },
      },
      select: { queue_id: true, room_id: true },
    });

    const roomIds = new Set<string>();
    for (const q of queues) {
      await this.applyManualCodesToQueue(q.queue_id, normalized);
      if (q.room_id) roomIds.add(q.room_id);
    }
    for (const roomId of roomIds) {
      await this.broadcastRoomUpdate(roomId);
    }
  }

  private async validateAndNormalizeManualCodes(
    codes: string[],
  ): Promise<string[]> {
    const normalized = parseStringCodeList(codes);
    if (normalized.length === 0) {
      return [];
    }
    const flaggable = await this.queuePriorityService.getFlaggableRules();
    const allowed = new Set(flaggable.map((r) => r.rule_code));
    const invalid = normalized.filter((c) => !allowed.has(c));
    if (invalid.length > 0) {
      throw new BadRequestException(
        `rule_code không hợp lệ hoặc không gắn được: ${invalid.join(', ')}`,
      );
    }
    return normalized;
  }

  private async applyManualCodesToQueue(
    queueId: string,
    codes: string[],
  ): Promise<Queue> {
    return this.prisma.$transaction(async (tx) => {
      const queue = await tx.queue.findUnique({
        where: { queue_id: queueId },
        include: {
          step: {
            include: {
              room: true,
              flow: {
                include: {
                  booking: {
                    include: {
                      patient: true,
                      slot: { include: { shift: true } },
                      visitSession: true,
                    },
                  },
                },
              },
            },
          },
        },
      });
      if (!queue?.step) {
        throw new NotFoundException('Không tìm thấy lượt chờ.');
      }

      const {
        basePriority,
        appliedRules,
        queueType: typeOverride,
      } = await this.evaluatePriorityForStep(
        queue.step,
        queue.queue_type,
        queue.missed_count ?? 0,
        tx,
        codes,
      );

      return tx.queue.update({
        where: { queue_id: queueId },
        data: {
          manual_rule_codes: codes,
          base_priority: basePriority,
          applied_rules: appliedRules ?? undefined,
          queue_type: typeOverride ?? queue.queue_type,
        },
      });
    });
  }

  async getRoomQueueView(roomId: string, user: { id: string; role: string }) {
    await this.assertCanManageRoom(user, roomId);

    const now = new Date();
    const dateFormatted = formatInTimeZone(
      now,
      'Asia/Ho_Chi_Minh',
      'yyyy-MM-dd',
    );
    const startOfDay = toDate(`${dateFormatted}T00:00:00`, {
      timeZone: 'Asia/Ho_Chi_Minh',
    });
    const endOfDay = toDate(`${dateFormatted}T23:59:59.999`, {
      timeZone: 'Asia/Ho_Chi_Minh',
    });

    const servingQueue = await this.prisma.queue.findFirst({
      where: {
        room_id: roomId,
        status: { in: [QueueStatusEnum.SERVING, QueueStatusEnum.CALLED] },
        ...buildQueueDateFilter(startOfDay, endOfDay),
      },
      include: {
        step: {
          include: SERVING_STEP_INCLUDE,
        },
      },
    });

    const waitingOrder =
      await this.queuePriorityService.computeQueueOrder(roomId);
    const roomEta = await this.queueEtaService.computeEtaForRoom(
      roomId,
      waitingOrder,
    );
    const etaMap = new Map<string, EntryEtaInfo>();
    for (const e of roomEta.entries) {
      etaMap.set(e.queueId, e);
    }

    const missingEntries = await this.prisma.queue.findMany({
      where: {
        room_id: roomId,
        status: QueueStatusEnum.MISSING,
        ...buildQueueDateFilter(startOfDay, endOfDay),
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

    const finishedEntries = await this.prisma.queue.findMany({
      where: {
        room_id: roomId,
        OR: [
          {
            status: QueueStatusEnum.FINISHED,
            OR: [
              { finished_at: { gte: startOfDay, lte: endOfDay } },
              {
                finished_at: null,
                updated_at: { gte: startOfDay, lte: endOfDay },
              },
            ],
          },
          {
            status: QueueStatusEnum.CANCELLED,
            step: {
              step_status: {
                in: [StepStatusEnum.DECLINED, StepStatusEnum.CANCELLED],
              },
            },
            OR: [
              { finished_at: { gte: startOfDay, lte: endOfDay } },
              { updated_at: { gte: startOfDay, lte: endOfDay } },
            ],
          },
        ],
      },
      include: {
        step: {
          include: SERVING_STEP_INCLUDE,
        },
        moveLogs: {
          where: {
            action_type: { in: ['DECLINED', 'FINISHED', 'CANCELLED'] },
          },
          orderBy: { created_at: 'desc' },
          take: 1,
        },
      },
      orderBy: [{ finished_at: 'desc' }, { updated_at: 'desc' }],
    });

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
              entry.queue.step?.flow?.booking?.patient?.full_name || '---',
            queue_type: entry.queue.queue_type,
            effective_score: entry.effectiveScore,
            reasons: entry.reasons,
            is_pinned: entry.queue.is_pinned,
            manual_rule_codes: parseStringCodeList(
              entry.queue.manual_rule_codes,
            ),
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
        finished: finishedEntries.map((f) => this.buildFinishedPayload(f)),
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
            phone: patient.account?.phone ?? null,
            citizen_id: patient.citizen_id ?? null,
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

  buildFinishedPayload(finishedQueue: any) {
    const step = finishedQueue.step;
    const patient = step?.flow?.booking?.patient ?? null;
    const so = step?.service_order ?? null;
    const moveLog = finishedQueue.moveLogs?.[0] ?? null;

    const startedAt = finishedQueue.serving_started_at
      ? new Date(finishedQueue.serving_started_at)
      : null;
    const finishedAt = finishedQueue.finished_at
      ? new Date(finishedQueue.finished_at)
      : finishedQueue.updated_at
        ? new Date(finishedQueue.updated_at)
        : null;

    let durationMinutes = 0;
    if (startedAt && finishedAt) {
      durationMinutes = Math.max(
        0,
        Math.round((finishedAt.getTime() - startedAt.getTime()) / 60000),
      );
    }

    return {
      queue_id: finishedQueue.queue_id,
      queue_number: finishedQueue.queue_number,
      queue_type: finishedQueue.queue_type,
      status: finishedQueue.status,
      serving_started_at: finishedQueue.serving_started_at,
      finished_at: finishedQueue.finished_at ?? finishedQueue.updated_at,
      duration_minutes: durationMinutes,
      refusal_reason: moveLog?.reason ?? null,
      patient: patient
        ? {
            patient_id: patient.patient_id,
            full_name: patient.full_name,
            dob: patient.dob,
            gender: patient.gender,
            phone: patient.account?.phone ?? null,
            citizen_id: patient.citizen_id ?? null,
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

    const allowedStatuses: QueueStatusEnum[] = [
      QueueStatusEnum.SERVING,
      QueueStatusEnum.CALLED,
    ];

    if (!allowedStatuses.includes(queue.status)) {
      throw new BadRequestException(
        'Chỉ thao tác được trên lượt đang phục vụ (SERVING) hoặc đang gọi (CALLED).',
      );
    }

    await this.assertCanManageRoom(user, queue.room_id, queue.step_id);

    if (queue.status === QueueStatusEnum.CALLED) {
      const now = new Date();
      const servingStartedAt = queue.called_at || now;

      await this.prisma.$transaction(async (tx) => {
        await tx.queue.update({
          where: { queue_id: queueId },
          data: {
            status: QueueStatusEnum.SERVING,
            serving_started_at: servingStartedAt,
          },
        });

        if (queue.step_id) {
          await tx.step.update({
            where: { step_id: queue.step_id },
            data: { step_status: StepStatusEnum.IN_PROGRESS },
          });
        }

        await tx.move_Log.create({
          data: {
            queue_id: queueId,
            action_type: 'SERVING',
            actor_account_id: user.id,
            reason:
              'Tự động chuyển sang SERVING khi thực hiện thao tác dịch vụ/hoàn thành',
          },
        });
      });

      queue.status = QueueStatusEnum.SERVING;
      queue.serving_started_at = servingStartedAt;
      if (queue.step) {
        (queue.step as any).step_status = StepStatusEnum.IN_PROGRESS;
      }
    }

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

    // Match by service_code only — no fallback that updates every active detail
    let targets = active.filter(
      (d: any) =>
        step.service_code &&
        d.service?.service_code &&
        d.service.service_code === step.service_code,
    );

    if (targets.length === 0 && active.length === 1) {
      targets = active;
    }

    if (targets.length === 0) return;

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

  /**
   * Close entire SO at end of serving: all active details + sibling clinical steps.
   */
  private async finalizeServiceOrderOnServingClose(
    serviceOrderId: string,
    outcome: 'complete' | 'refuse',
    primaryStepId: string,
  ) {
    const detailStatus =
      outcome === 'complete'
        ? ServiceOrderDetailStatusEnum.COMPLETED
        : ServiceOrderDetailStatusEnum.CANCELLED;
    const stepStatus =
      outcome === 'complete'
        ? StepStatusEnum.COMPLETED
        : StepStatusEnum.DECLINED;

    await this.prisma.service_Order_Detail.updateMany({
      where: {
        service_order_id: serviceOrderId,
        status: { in: ACTIVE_SOD_STATUSES },
      },
      data: { status: detailStatus },
    });

    await this.prisma.step.updateMany({
      where: {
        service_order_id: serviceOrderId,
        step_type: { not: StepTypeEnum.PAYMENT },
        step_status: {
          notIn: [
            StepStatusEnum.COMPLETED,
            StepStatusEnum.CANCELLED,
            StepStatusEnum.DECLINED,
          ],
        },
        // primary already handled by completeStep/declineStep
        step_id: { not: primaryStepId },
      },
      data: { step_status: stepStatus },
    });

    await this.maybeCloseServiceOrder(serviceOrderId, outcome);
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

    await this.syncServiceOrderFromStep(queue.step, outcome);
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
        finished_at: outcome === 'complete' ? now : (queue.finished_at ?? now),
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

    if (outcome === 'complete' && queue.room_id && queue.serving_started_at) {
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
    if (outcome === 'complete') {
      this.scheduleRebalanceIfCls(queue.step?.step_type);
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

    if (step.service_order_id) {
      await this.finalizeServiceOrderOnServingClose(
        step.service_order_id,
        'complete',
        step.step_id,
      );
    }

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

    if (step.service_order_id) {
      await this.finalizeServiceOrderOnServingClose(
        step.service_order_id,
        'refuse',
        step.step_id,
      );
    }

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
      throw new NotFoundException(
        'Không tìm thấy chi tiết chỉ định thuộc lượt này.',
      );
    }
    if (!ACTIVE_SOD_STATUSES.includes(detail.status)) {
      throw new BadRequestException(
        'Chi tiết chỉ định không còn ở trạng thái chờ xử lý.',
      );
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
      throw new NotFoundException(
        'Không tìm thấy chi tiết chỉ định thuộc lượt này.',
      );
    }
    if (!ACTIVE_SOD_STATUSES.includes(detail.status)) {
      throw new BadRequestException(
        'Chi tiết chỉ định không còn ở trạng thái chờ xử lý.',
      );
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
    return await this.queueEtaService.updateDefaultDurationSec(
      roomId,
      stepType,
      defaultDurationSec,
    );
  }
}
