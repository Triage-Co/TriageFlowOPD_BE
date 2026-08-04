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
  StepStatusEnum,
} from '@prisma/client';
import { toZonedTime } from 'date-fns-tz';
import { PrismaService } from '../../shared/config/prisma.service';
import { QueueGateway } from '../../shared/gateways/queue.gateway';
import { QueuePriorityService } from './queue-priority.service';

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

    @Inject(forwardRef(() => QueueGateway))
    private readonly queueGateway: QueueGateway,
  ) {}

  async assertCanManageRoom(
    user: { id: string; role: string },
    roomId: string,
    stepId?: string,
  ): Promise<void> {
    if (user.role === RoleTypeEnum.ADMIN) {
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

    const today = new Date();
    const zonedToday = toZonedTime(today, 'Asia/Ho_Chi_Minh');

    const startOfDay = new Date(zonedToday);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(zonedToday);
    endOfDay.setHours(23, 59, 59, 999);

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
    const now = new Date();
    const zonedNow = toZonedTime(now, 'Asia/Ho_Chi_Minh');
    zonedNow.setHours(0, 0, 0, 0);

    const count = await client.queue.count({
      where: {
        room_id: roomId,
        created_at: {
          gte: zonedNow,
        },
      },
    });

    return (count + 1).toString();
  }

  async enqueueStep(
    stepId: string,
    queueType: QueueTypeEnum,
    tx?: Prisma.TransactionClient,
  ): Promise<Queue> {
    const execute = async (prismaTx: Prisma.TransactionClient) => {
      // 1. Idempotent check
      const existingQueue = await prismaTx.queue.findFirst({
        where: {
          step_id: stepId,
          status: {
            notIn: [QueueStatusEnum.FINISHED, QueueStatusEnum.CANCELLED],
          },
        },
      });

      if (existingQueue) {
        return existingQueue;
      }

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

      const nextNumber = await this.generateQueueNumberForRoom(step.room_id, prismaTx);
      const isEngineEnabled = process.env.QUEUE_ENGINE_ENABLED !== 'false';

      let basePriority = 0;
      let appliedRules: any = null;

      if (isEngineEnabled) {
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

        const evalInput = {
          patient: patient ? { dob: patient.dob ? new Date(patient.dob) : null, gender: patient.gender } : null,
          queueType,
          suggestedPriority,
          vitals,
          appointmentOnTime,
          missedCount: 0,
          roomType: step.room?.room_type ?? null,
          specialtyId: step.room?.specialty_id ?? null,
        };

        const evalResult = await this.queuePriorityService.evaluateRulesForEntry(evalInput);
        basePriority = evalResult.basePriority;
        appliedRules = evalResult.appliedRules;
      }

      const createdQueue = await prismaTx.queue.create({
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

      return createdQueue;
    };

    const result = tx ? await execute(tx) : await this.prisma.$transaction(execute);

    if (result.room_id) {
      this.getRoomDisplayPayload(result.room_id)
        .then((payload) => this.queueGateway.emitQueueUpdate(result.room_id!, payload))
        .catch((err) =>
          this.logger.warn(`Failed to emit WS update for room ${result.room_id}: ${err.message}`),
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
      if (step.queues && step.queues.length > 0) continue;
      if (!step.room_id) continue;

      const hasBooking = Boolean(step.flow?.booking?.slot_id);
      const queueType = hasBooking ? QueueTypeEnum.APPOINTMENT : QueueTypeEnum.NEW;

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

    const displayPayload = await this.prisma.$transaction(async (tx) => {
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

      // 2. Pick next patient
      let nextQueueId: string | undefined;

      if (stepId) {
        const stepQueue = await tx.queue.findFirst({
          where: {
            step_id: stepId,
            room_id: roomId,
            status: { in: [QueueStatusEnum.PENDING, QueueStatusEnum.QUEUED] },
          },
        });
        if (!stepQueue) {
          throw new BadRequestException('Lượt khám không hợp lệ, không đúng phòng ban hoặc đã được xử lý.');
        }
        nextQueueId = stepQueue.queue_id;
      } else {
        const order = await this.queuePriorityService.computeQueueOrder(roomId);
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

      return await this.getRoomDisplayPayload(roomId, staffId);
    });

    this.queueGateway.emitQueueUpdate(roomId, displayPayload);

    return {
      code: 200,
      status: 'success',
      message: 'Đã gọi bệnh nhân và cập nhật màn hình TV',
      data: displayPayload,
    };
  }

  async getRoomDisplayPayload(roomId: string, staffId?: string) {
    const currentQueue = await this.prisma.queue.findFirst({
      where: {
        room_id: roomId,
        status: { in: [QueueStatusEnum.SERVING, QueueStatusEnum.CALLED] },
      },
      include: {
        step: {
          include: {
            flow: { include: { booking: { include: { patient: true } } } },
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

    return {
      room_info: {
        specialty_name: room?.specialty?.specialty_name || 'KHOA KHÁM BỆNH',
        room_name: room?.room_name || 'Phòng Khám',
        doctor_name: staff?.full_name ? `BS. ${staff.full_name}` : 'Đang cập nhật',
      },
      current_patient: currentQueue
        ? {
            queue_number: currentQueue.queue_number,
            patient_name: (currentQueue.step as any)?.flow?.booking?.patient?.full_name || '---',
          }
        : null,
      upcoming_patients: upcomingOrder.slice(0, 5).map((entry) => ({
        queue_number: entry.queue.queue_number,
        patient_name: (entry.queue as any).step?.flow?.booking?.patient?.full_name || '---',
        queue_type: entry.queue.queue_type,
        priority_reasons: entry.reasons,
      })),
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

    await this.prisma.$transaction(async (tx) => {
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
    });

    const newQueue = await this.enqueueStep(stepId, QueueTypeEnum.TRANSFER);

    if (fromRoomId) {
      const fromPayload = await this.getRoomDisplayPayload(fromRoomId);
      this.queueGateway.emitQueueUpdate(fromRoomId, fromPayload);
    }
    const toPayload = await this.getRoomDisplayPayload(toRoomId);
    this.queueGateway.emitQueueUpdate(toRoomId, toPayload);

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
      actionType = 'MOVED_POSITION';
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

    const displayPayload = await this.getRoomDisplayPayload(queue.room_id);
    this.queueGateway.emitQueueUpdate(queue.room_id, displayPayload);

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

    const displayPayload = await this.getRoomDisplayPayload(queue.room_id);
    this.queueGateway.emitQueueUpdate(queue.room_id, displayPayload);

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

    const displayPayload = await this.getRoomDisplayPayload(queue.room_id);
    this.queueGateway.emitQueueUpdate(queue.room_id, displayPayload);

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
    });

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
        serving: servingQueue
          ? {
              queue_id: servingQueue.queue_id,
              queue_number: servingQueue.queue_number,
              patient_name: servingQueue.step?.flow?.booking?.patient?.full_name || '---',
              serving_started_at: servingQueue.serving_started_at,
            }
          : null,
        waiting: waitingOrder.map((entry) => {
          const enqueuedAt = entry.queue.enqueued_at
            ? new Date(entry.queue.enqueued_at)
            : new Date(entry.queue.created_at);
          const waitedMinutes = Math.floor(Math.max(0, now.getTime() - enqueuedAt.getTime()) / 60000);
          return {
            position: entry.position,
            queue_id: entry.queue.queue_id,
            queue_number: entry.queue.queue_number,
            patient_name: (entry.queue as any).step?.flow?.booking?.patient?.full_name || '---',
            queue_type: entry.queue.queue_type,
            effective_score: entry.effectiveScore,
            reasons: entry.reasons,
            is_pinned: entry.queue.is_pinned,
            enqueued_at: entry.queue.enqueued_at,
            waited_minutes: waitedMinutes,
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
}
