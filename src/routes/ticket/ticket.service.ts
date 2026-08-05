import {
  BadRequestException,
  ForbiddenException,
  forwardRef,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../shared/config/prisma.service';
import type { IFlowRepository } from '../../shared/interfaces/i-flow.repository';
import { NavigationService } from '../navigation/core/navigation.service';
import { QueueGateway } from '../../shared/gateways/queue.gateway';
import { QueueService } from '../queue/queue.service';
import { TicketNavigateDto } from './dto/ticket-navigate.dto';
import { TicketCheckInDto } from './dto/ticket-check-in.dto';
import { RouteLocationType } from '../navigation/core/dto/get-route.dto';
import { QueueStatusEnum, QueueTypeEnum, StepStatusEnum } from '@prisma/client';

@Injectable()
export class TicketService {
  private readonly logger = new Logger(TicketService.name);

  constructor(
    private readonly prisma: PrismaService,

    @Inject('IFlowRepository')
    private readonly flowRepository: IFlowRepository,

    private readonly navigationService: NavigationService,

    @Inject(forwardRef(() => QueueGateway))
    private readonly queueGateway: QueueGateway,

    @Inject(forwardRef(() => QueueService))
    private readonly queueService: QueueService,
  ) {}

  /**
   * 1. GET /ticket/:code - Tra cứu thông tin cơ bản phiếu khám
   */
  async getTicketInfo(ticketCode: string) {
    const flow = await this.prisma.flow.findUnique({
      where: { ticket_code: ticketCode },
      include: {
        booking: {
          include: {
            patient: true,
            slot: {
              include: {
                shift: true,
              },
            },
          },
        },
        steps: {
          include: {
            room: true,
            staff: true,
          },
        },
      },
    });

    if (!flow) {
      throw new NotFoundException({
        message: 'Không tìm thấy phiếu khám',
        detail: `Không tìm thấy thông tin cho mã ticket: ${ticketCode}`,
      });
    }

    const patient = flow.booking?.patient;
    const totalSteps = flow.steps.length;
    const completedSteps = flow.steps.filter(
      (s) => s.step_status === StepStatusEnum.COMPLETED,
    ).length;
    const inProgressSteps = flow.steps.filter(
      (s) => s.step_status === StepStatusEnum.IN_PROGRESS,
    ).length;
    const pendingSteps = flow.steps.filter(
      (s) => s.step_status === StepStatusEnum.PENDING,
    ).length;

    // Determine current active or next pending step
    const currentStep =
      flow.steps.find((s) => s.step_status === StepStatusEnum.IN_PROGRESS) ||
      flow.steps.find((s) => s.step_status === StepStatusEnum.PENDING) ||
      null;

    let queueInfo: any = null;

    if (currentStep && currentStep.room_id) {
      const activeQueue = await this.prisma.queue.findFirst({
        where: {
          step_id: currentStep.step_id,
          status: { notIn: [QueueStatusEnum.FINISHED, QueueStatusEnum.CANCELLED] },
        },
      });

      if (activeQueue) {
        const isWaiting =
          activeQueue.status === QueueStatusEnum.QUEUED ||
          activeQueue.status === QueueStatusEnum.PENDING;

        if (isWaiting) {
          const roomEta = await this.queueService.computeRoomEta(currentStep.room_id);
          const entryEta = roomEta.entries.find(
            (e) => e.queueId === activeQueue.queue_id,
          );

          queueInfo = {
            queue_number: activeQueue.queue_number,
            position: entryEta ? entryEta.position : null,
            waiting_ahead: entryEta ? entryEta.position : null,
            eta_minutes: entryEta ? Math.round(entryEta.etaSec / 60) : null,
            eta_time: entryEta?.etaTime || null,
            queue_status: activeQueue.status,
          };
        } else {
          queueInfo = {
            queue_number: activeQueue.queue_number,
            position: null,
            waiting_ahead: null,
            eta_minutes: null,
            eta_time: null,
            queue_status: activeQueue.status,
          };
        }
      }
    }

    return {
      code: 200,
      status: 'success',
      message: 'Tra cứu thông tin ticket thành công',
      data: {
        ticket_code: flow.ticket_code,
        flow_id: flow.flow_id,
        flow_status: flow.status,
        created_at: flow.created_at,
        patient: patient
          ? {
              patient_id: patient.patient_id,
              full_name: patient.full_name,
              citizen_id: patient.citizen_id,
              gender: patient.gender,
              dob: patient.dob,
            }
          : null,
        current_step: currentStep
          ? {
              step_id: currentStep.step_id,
              step_name: currentStep.step_name,
              step_status: currentStep.step_status,
              room_name: currentStep.room?.room_name || 'Đang cập nhật',
              staff_name: currentStep.staff?.full_name || 'Đang cập nhật',
            }
          : null,
        queue_info: queueInfo,
        progress_summary: {
          total: totalSteps,
          completed: completedSteps,
          in_progress: inProgressSteps,
          pending: pendingSteps,
        },
      },
    };
  }

  /**
   * 2. GET /ticket/:code/flow-progress - Lộ trình chi tiết cây các bước khám
   */
  async getFlowProgress(ticketCode: string) {
    const flowData = await this.flowRepository.findByTicketCode(ticketCode);
    return {
      code: 200,
      status: 'success',
      message: 'Lấy tiến trình lộ trình thành công',
      data: flowData,
    };
  }

  /**
   * 3. GET /ticket/:code/navigate - Tự động tìm bước tiếp theo & chỉ đường
   */
  async navigate(ticketCode: string, dto: TicketNavigateDto) {
    const flow = await this.prisma.flow.findUnique({
      where: { ticket_code: ticketCode },
      include: {
        steps: {
          orderBy: { created_at: 'asc' },
          include: {
            room: true,
          },
        },
      },
    });

    if (!flow) {
      throw new NotFoundException({
        message: 'Không tìm thấy phiếu khám',
        detail: `Không tìm thấy flow với mã ticket ${ticketCode}`,
      });
    }

    // Next target step: IN_PROGRESS step first, otherwise earliest PENDING step
    const targetStep =
      flow.steps.find((s) => s.step_status === StepStatusEnum.IN_PROGRESS) ||
      flow.steps.find((s) => s.step_status === StepStatusEnum.PENDING);

    if (!targetStep) {
      throw new BadRequestException({
        message: 'Lộ trình khám đã hoàn thành',
        detail: 'Không còn bước khám nào đang chờ hoặc cần thực hiện',
      });
    }

    if (!targetStep.room || !targetStep.room.physical_room_id) {
      throw new BadRequestException({
        message: 'Phòng khám chưa được liên kết vị trí bản đồ',
        detail: `Bước '${targetStep.step_name}' ở phòng '${targetStep.room?.room_name || 'chưa gán'}' chưa có physical_room_id`,
      });
    }

    const routeResult = await this.navigationService.findRoute({
      startType: dto.startType,
      startId: dto.startId,
      targetType: RouteLocationType.ROOM,
      targetId: targetStep.room.physical_room_id,
    });

    return {
      code: 200,
      status: 'success',
      message: 'Tìm đường đi đến bước tiếp theo thành công',
      data: {
        target_step: {
          step_id: targetStep.step_id,
          step_name: targetStep.step_name,
          step_status: targetStep.step_status,
          room_id: targetStep.room_id,
          room_name: targetStep.room.room_name,
          physical_room_id: targetStep.room.physical_room_id,
        },
        route: routeResult,
      },
    };
  }

  /**
   * 4. GET /ticket/:code/payment - Danh sách hóa đơn & thanh toán
   */
  async getPaymentInfo(ticketCode: string) {
    const flow = await this.prisma.flow.findUnique({
      where: { ticket_code: ticketCode },
      select: { booking_id: true },
    });

    if (!flow) {
      throw new NotFoundException({
        message: 'Không tìm thấy phiếu khám',
        detail: `Không tìm thấy mã ticket: ${ticketCode}`,
      });
    }

    const serviceOrders = await this.prisma.service_Order.findMany({
      where: { booking_id: flow.booking_id },
      include: {
        serviceOrderDetails: {
          include: {
            service: true,
          },
        },
        invoices: {
          include: {
            invoice_details: true,
          },
        },
        transactions: true,
      },
      orderBy: { created_at: 'desc' },
    });

    const totalAmount = serviceOrders.reduce((sum, order) => {
      const orderTotal = order.serviceOrderDetails.reduce(
        (acc, detail) =>
          acc + (detail.price_at_order || 0) * (detail.quantity || 1),
        0,
      );
      return sum + orderTotal;
    }, 0);

    return {
      code: 200,
      status: 'success',
      message: 'Lấy thông tin thanh toán thành công',
      data: {
        ticket_code: ticketCode,
        booking_id: flow.booking_id,
        total_amount: totalAmount,
        service_orders: serviceOrders,
      },
    };
  }

  /**
   * 5. GET /ticket/:code/prescription - Thông tin đơn thuốc
   */
  async getPrescription(ticketCode: string) {
    const flow = await this.prisma.flow.findUnique({
      where: { ticket_code: ticketCode },
      select: { booking_id: true, flow_id: true },
    });

    if (!flow) {
      throw new NotFoundException({
        message: 'Không tìm thấy phiếu khám',
        detail: `Không tìm thấy mã ticket: ${ticketCode}`,
      });
    }

    const prescriptions = await this.prisma.prescription.findMany({
      where: {
        OR: [{ booking_id: flow.booking_id }, { flow_id: flow.flow_id }],
      },
      include: {
        doctor: {
          select: {
            staff_id: true,
            full_name: true,
            license_number: true,
          },
        },
        prescriptionDetails: {
          include: {
            medicine: true,
          },
        },
        serviceOrder: true,
      },
    });

    return {
      code: 200,
      status: 'success',
      message: 'Lấy thông tin đơn thuốc thành công',
      data: {
        ticket_code: ticketCode,
        prescriptions,
      },
    };
  }

  /**
   * 6. POST /ticket/:code/check-in - Check-in tự động tại phòng
   */
  async checkIn(ticketCode: string, dto: TicketCheckInDto, currentUser?: any) {
    const flow = await this.prisma.flow.findUnique({
      where: { ticket_code: ticketCode },
      include: {
        booking: {
          include: {
            patient: true,
            slot: true,
          },
        },
        steps: {
          where: {
            room_id: dto.room_id,
            step_status: {
              in: [StepStatusEnum.PENDING, StepStatusEnum.IN_PROGRESS],
            },
          },
          include: {
            queues: true,
            room: true,
          },
        },
      },
    });

    if (!flow) {
      throw new NotFoundException({
        message: 'Không tìm thấy phiếu khám',
        detail: `Không tìm thấy mã ticket: ${ticketCode}`,
      });
    }

    // Verify ownership if user is logged in as USER role
    if (currentUser && currentUser.role === 'USER') {
      const patientAccountId = flow.booking?.patient?.account_id;
      const currentUserId = currentUser.id || currentUser.sub;
      if (patientAccountId && patientAccountId !== currentUserId) {
        throw new ForbiddenException({
          message: 'Không có quyền thực hiện',
          detail: 'Bạn không thể check-in cho phiếu khám của người khác',
        });
      }
    }

    if (!flow.steps || flow.steps.length === 0) {
      throw new BadRequestException({
        message: 'Check-in không hợp lệ',
        detail:
          'Bệnh nhân không có bước khám nào đang chờ hoặc thực hiện tại phòng này',
      });
    }

    const step = flow.steps[0];

    let updatedStep = step;
    if (step.step_status === StepStatusEnum.PENDING) {
      updatedStep = await this.prisma.step.update({
        where: { step_id: step.step_id },
        data: { step_status: StepStatusEnum.IN_PROGRESS },
        include: {
          queues: true,
          room: true,
        },
      });
    }

    const hasBookingSlot = Boolean(flow.booking?.slot_id);
    const queueType = hasBookingSlot
      ? QueueTypeEnum.APPOINTMENT
      : QueueTypeEnum.NEW;

    const activeQueue = (updatedStep.queues || []).find(
      (q) =>
        q.status !== QueueStatusEnum.FINISHED &&
        q.status !== QueueStatusEnum.CANCELLED,
    );

    let queueNumber = activeQueue?.queue_number || '---';

    if (step.room_id) {
      try {
        if (!activeQueue) {
          const created = await this.queueService.enqueueStep(
            step.step_id,
            queueType,
          );
          queueNumber = created.queue_number;
        } else if (activeQueue.status === QueueStatusEnum.PENDING) {
          // First real presence at room: start aging clock
          const updatedQueue = await this.prisma.queue.update({
            where: { queue_id: activeQueue.queue_id },
            data: {
              enqueued_at: new Date(),
              status: QueueStatusEnum.QUEUED,
              room_id: activeQueue.room_id || step.room_id,
            },
          });
          queueNumber = updatedQueue.queue_number;
        } else if (!activeQueue.room_id) {
          const repaired = await this.queueService.enqueueStep(
            step.step_id,
            queueType,
            undefined,
            { forceType: true },
          );
          queueNumber = repaired.queue_number;
        }

        await this.queueService.broadcastRoomUpdate(
          step.room_id,
          step.staff_id || undefined,
        );
      } catch (err: any) {
        this.logger.warn(`Queue/socket error during check-in: ${err?.message || err}`);
      }
    }

    return {
      code: 200,
      status: 'success',
      message: 'Check-in tại phòng khám thành công',
      data: {
        ticket_code: ticketCode,
        step_id: updatedStep.step_id,
        step_name: updatedStep.step_name,
        step_status: updatedStep.step_status,
        room_name: updatedStep.room?.room_name,
        queue_number: queueNumber,
      },
    };
  }

  /**
   * 7. GET /ticket/:code/clinical-results - Kết quả xét nghiệm / chẩn đoán hình ảnh
   */
  async getClinicalResults(ticketCode: string) {
    const flow = await this.prisma.flow.findUnique({
      where: { ticket_code: ticketCode },
      select: { booking_id: true },
    });

    if (!flow) {
      throw new NotFoundException({
        message: 'Không tìm thấy phiếu khám',
        detail: `Không tìm thấy mã ticket: ${ticketCode}`,
      });
    }

    const visitSession = await this.prisma.visit_Session.findUnique({
      where: { booking_id: flow.booking_id },
      include: {
        clinicalDocuments: true,
      },
    });

    return {
      code: 200,
      status: 'success',
      message: 'Lấy kết quả lâm sàng thành công',
      data: {
        ticket_code: ticketCode,
        visit_session_id: visitSession?.visit_session_id || null,
        diagnosis: visitSession?.diagnosis || null,
        final_diagnosis: visitSession?.final_diagnosis || null,
        documents: visitSession?.clinicalDocuments || [],
      },
    };
  }
}
