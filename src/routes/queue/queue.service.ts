import { BadRequestException, forwardRef, Inject, Injectable } from '@nestjs/common';

import { PrismaService } from '../../shared/config/prisma.service';
import { QueueGateway } from '../../shared/gateways/queue.gateway';
import { StepStatusEnum } from '@prisma/client';

@Injectable()
export class QueueService {
  constructor(
    private readonly prisma: PrismaService,

    @Inject(forwardRef(() => QueueGateway))
    private readonly queueGateway: QueueGateway,
  ) {}

  async callNextPatient(stepId: string, roomId: string, staffId: string) {
    await this.prisma.$transaction(async (tx) => {
      await tx.step.updateMany({
        where: {
          room_id: roomId,
          staff_id: staffId,
          step_status: StepStatusEnum.IN_PROGRESS,
        },
        data: { step_status: StepStatusEnum.COMPLETED },
      });

      const updateResult = await tx.step.updateMany({
        where: {
          step_id: stepId,
          room_id: roomId,
          staff_id: staffId,
          step_status: StepStatusEnum.PENDING,
        },
        data: { step_status: StepStatusEnum.IN_PROGRESS },
      });

      if (updateResult.count === 0) {
        throw new BadRequestException(
          'Lượt khám không hợp lệ, không đúng phòng ban hoặc đã được xử lý.',
        );
      }
    });

    const displayPayload = await this.getRoomDisplayPayload(roomId, staffId);

    this.queueGateway.emitQueueUpdate(roomId, displayPayload);

    return {
      code: 200,
      status: 'success',
      message: 'Đã gọi bệnh nhân và cập nhật màn hình TV',
      data: displayPayload,
    };
  }

  async getRoomDisplayPayload(roomId: string, staffId: string) {
    const currentStep = await this.prisma.step.findFirst({
      where: {
        room_id: roomId,
        staff_id: staffId,
        step_status: StepStatusEnum.IN_PROGRESS,
      },
      include: {
        queues: true,
        flow: { include: { booking: { include: { patient: true } } } },
        staff: true,
        room: { include: { specialty: true } },
      },
    });

    const upcomingSteps = await this.prisma.step.findMany({
      where: {
        room_id: roomId,
        staff_id: staffId,
        step_status: StepStatusEnum.PENDING,
      },
      include: {
        queues: true,
        flow: { include: { booking: { include: { patient: true } } } },
      },
      take: 5,
      orderBy: { created_at: 'asc' },
    });

    return {
      room_info: {
        specialty_name:
          currentStep?.room?.specialty?.specialty_name || 'KHOA KHÁM BỆNH',
        room_name: currentStep?.room?.room_name || 'Phòng Khám',
        doctor_name: currentStep?.staff?.full_name
          ? `BS. ${currentStep.staff.full_name}`
          : 'Đang cập nhật',
      },
      current_patient: currentStep
        ? {
            queue_number: currentStep.queues[0]?.queue_number || '---',
            patient_name:
              currentStep.flow?.booking?.patient?.full_name || '---',
          }
        : null,
      upcoming_patients: upcomingSteps.map((step) => ({
        queue_number: step.queues[0]?.queue_number || '---',
        patient_name: step.flow?.booking?.patient?.full_name || '---',
      })),
      timestamp: new Date().toISOString(),
    };
  }

  async generateServiceQueueNumber(serviceOrderId: string) {
    // Tìm tất cả các Step liên quan tới service_order_id đã thanh toán
    const steps = await this.prisma.step.findMany({
      where: {
        service_order_id: serviceOrderId,
        payment_status: 'SUCCESSED',
      },
      include: {
        queues: true,
      },
    });

    for (const step of steps) {
      // Nếu Step đã có queue rồi thì bỏ qua
      if (step.queues && step.queues.length > 0) continue;

      // Nếu Step không gắn với phòng nào thì không xếp hàng
      if (!step.room_id) continue;

      // Đếm số lượng queue đã tạo trong ngày hôm nay của phòng đó
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const count = await this.prisma.queue.count({
        where: {
          step: {
            room_id: step.room_id,
          },
          created_at: {
            gte: today,
          },
        },
      });

      const nextNumber = count + 1;

      // Tạo queue mới cho Step
      await this.prisma.queue.create({
        data: {
          step_id: step.step_id,
          queue_number: nextNumber.toString(),
        },
      });
    }
  }
}

