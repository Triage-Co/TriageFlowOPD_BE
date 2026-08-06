import {
  BadRequestException,
  forwardRef,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  BookingSpecialtyDto,
  CreateBookingRequestDto,
  CreateBookingWithPackageDto,
} from './dto/request-booking.dto';
import { PrismaService } from '../../shared/config/prisma.service';
import {
  ClinicalRoomType,
  FlowStatusEnum,
  PaymentStatusEnum,
  PrismaClient,
  QueueStatusEnum,
  QueueTypeEnum,
  ServiceOrderDetailStatusEnum,
  ServiceOrderStatusEnum,
  StepStatusEnum,
  StepTypeEnum,
  TransTypeEnum,
} from '@prisma/client';
import { formatInTimeZone, toDate } from 'date-fns-tz';
import { randomInt } from 'crypto';
import { format } from 'date-fns';
import { TransactionService } from '../transaction/transaction.service';
import type { INotificationRepository } from '../../shared/interfaces/i-notification.repository';
import type { IPatientRepository } from '../../shared/interfaces/i-patient.repository';
import type { IBookingRepository } from '../../shared/interfaces/i-booking.repository';
import type { IFlowRepository } from '../../shared/interfaces/i-flow.repository';
import type { IShiftRepository } from '../../shared/interfaces/i-shift.repository';
import type { IStepRepository } from '../../shared/interfaces/i-step.repository';
import type { ITriageInformationRepository } from '../../shared/interfaces/i-triage-information.repository';
import type { ISlotRepository } from '../../shared/interfaces/i-slot.repository';
import type { IServiceOrderDetailRepository } from '../../shared/interfaces/i-service-order-detail.repository';
import type { IServiceOrderRepository } from '../../shared/interfaces/i-service-order.repository';
import type { IServiceRepository } from '../../shared/interfaces/i-service.repository';
import type { IRoomRepository } from '../../shared/interfaces/i-room.repository';
import { StepErrors } from '../../shared/exceptions/step.exceptions';
import { QueueService } from '../queue/queue.service';
import { SlotErrors } from '../../shared/exceptions/slot.exceptions';
import { FlowErrors } from '../../shared/exceptions/flow.exceptions';
import { PatientErrors } from '../../shared/exceptions/patient.exceptions';
import type { IRoomServiceRepository } from '../../shared/interfaces/i-room-service.repository';
import { RoomServiceErrors } from '../../shared/exceptions/patient.exceptions copy';

@Injectable()
export class BookingService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly transactionService: TransactionService,
    @Inject('INotificationRepository')
    private readonly notificationRepository: INotificationRepository,
    @Inject('IPatientRepository')
    private readonly patientRepository: IPatientRepository,
    @Inject('IBookingRepository')
    private readonly bookingRepository: IBookingRepository,
    @Inject('IFlowRepository')
    private readonly flowRepository: IFlowRepository,
    @Inject('IShiftRepository')
    private readonly shiftRepository: IShiftRepository,
    @Inject('IStepRepository')
    private readonly stepRepository: IStepRepository,
    @Inject('ITriageInformationRepository')
    private readonly triageInformationRepository: ITriageInformationRepository,
    @Inject('ISlotRepository')
    private readonly SlotRepository: ISlotRepository,
    @Inject('IRoomRepository')
    private readonly roomRepository: IRoomRepository,
    @Inject('IServiceOrderDetailRepository')
    private readonly serviceOrderDetailRepository: IServiceOrderDetailRepository,
    @Inject('IServiceOrderRepository')
    private readonly serviceOrderRepository: IServiceOrderRepository,
    @Inject('IServiceRepository')
    private readonly serviceRepository: IServiceRepository,
    @Inject('IRoomServiceRepository')
    private readonly roomServiceRepository: IRoomServiceRepository,
    @Inject(forwardRef(() => QueueService))
    private readonly queueService: QueueService,
  ) { }

  private generateTicketCode(): string {
    const dateStr = format(new Date(), 'yyyyMMdd');
    const randomNum = randomInt(1000, 9999);
    return `V-${dateStr}-${randomNum}`;
  }

  async create(createBookingData: CreateBookingRequestDto) {
    const { patient_id, slot_id } = createBookingData;

    const [patient, slot] = await Promise.all([
      this.patientRepository.findOne(patient_id),
      this.SlotRepository.findAvailableBySlotId(slot_id),
    ]);

    if (!patient) {
      throw PatientErrors.PatientNotFoundById(patient_id);
    }

    if (!slot) {
      throw SlotErrors.NotFoundAvailableSlot(slot_id);
    }

    const flowInProgress = await this.flowRepository.findIsActiveByDate(
      patient_id,
      slot.shift.date,
    );

    if (flowInProgress.length > 0) {
      throw FlowErrors.FlowInProgress(patient_id, flowInProgress[0].flow_id)
    }

    const [room, roomService] = await Promise.all([
      this.roomRepository.findByType(ClinicalRoomType.CASHIER),
      this.roomServiceRepository.findOneByRoomId(slot.shift.room_id),
    ]);

    if (!roomService || !roomService.service.price) {
      throw RoomServiceErrors.RoomServiceNotFoundById(slot.shift.room.room_id);
    }

    const rs = await this.prismaService.$transaction(async (tx) => {
      const booking = await this.bookingRepository.create(
        {
          patient_id,
          slot_id,
        },
        tx,
      );

      await this.SlotRepository.update(
        slot_id,
        {
          capacity: {
            decrement: 1,
          },
        },
        tx,
      );

      const ticketCode = this.generateTicketCode();
      
      const flow = await this.flowRepository.create(
        {
          booking_id: booking.booking_id,
          status: FlowStatusEnum.PENDING,
          ticket_code: ticketCode,
        },
        tx,
      );

      const serviceOrder = await this.serviceOrderRepository.create(
        {
          booking_id: booking.booking_id,
          name: 'Thanh toán ' + (roomService.service.service_name || 'khám chuyên khoa'),
          payment_status: PaymentStatusEnum.PENDING,
          status: ServiceOrderStatusEnum.PENDING,
        },
        tx,
      );

      await this.serviceOrderDetailRepository.create(
        {
          price_at_order: roomService.service.price,
          quantity: 1,
          service_id: roomService.service.service_id,
          service_order_id: serviceOrder.service_order_id,
        },
        tx,
      );

      const paymentLink = await this.transactionService.create(
        {
          cancelUrl: 'https://triageflow.me/api-docs',
          returnUrl: 'https://triageflow.me/api-docs',
          transType: TransTypeEnum.APPOINTMENT_PAYMENT,
          amount: roomService.service.price,
          clientId: patient_id,
          service_order_id: serviceOrder.service_order_id,
        },
        tx,
      );

      if (!paymentLink || !('data' in paymentLink)) {
        throw new BadRequestException(
          (paymentLink?.detail as any)?.error?.desc ||
          'Lỗi tạo giao dịch thanh toán',
        );
      }

      const roomId =
        room && room.length > 0 ? room[0].room_id : null;

      const step = await this.stepRepository.createParentStep(
        {
          step_name: 'Thanh toán khám chuyên khoa',
          flow_id: flow.flow_id,
          room_id: roomId,
          step_type: StepTypeEnum.PAYMENT,
          service_code: roomService.service.service_code,
          service_order_id: serviceOrder.service_order_id,
          step_status: StepStatusEnum.PENDING,
        },
        tx,
      );

      await this.serviceOrderRepository.update(
        serviceOrder.service_order_id,
        {
          qr_code: paymentLink.data.qrCode,
        },
        tx,
      );
      return { serviceOrder, step, booking, paymentLink, flow };
    });

    return {
      code: 200,
      message: 'tạo lịch thành công',
      status: 'success',
      data: {
        step_id: rs.step.step_id,
        booking_id: rs.booking.booking_id,
        ticket_code: rs.flow.ticket_code,
        payment: rs.paymentLink,
      },
    };
  }

  async generateNumber(step_id: string) {
    const step = await this.stepRepository.getById(step_id);
    if (!step) {
      throw StepErrors.StepNotFoundById(step_id);
    }

    const serviceOrder = step.service_order;
    if (!serviceOrder) {
      throw new BadRequestException({ message: 'Không tìm thấy hóa đơn' });
    }

    const slot = serviceOrder.booking?.slot;
    if (!slot) {
      throw new BadRequestException({
        message: 'Đã xảy ra lỗi',
        detail: `Không tìm thấy slot nào trong step có trong hệ thống`,
      });
    }

    if (serviceOrder.payment_status !== PaymentStatusEnum.SUCCESSED) {
      throw new BadRequestException({
        message: 'Bạn chưa thanh toán',
        detail: 'Vui lòng thanh toán để lấy số thứ tự',
      });
    }

    const fullSlot = await this.prismaService.slot.findUnique({
      where: { slot_id: slot.slot_id },
      include: {
        shift: {
          include: {
            room: true,
          },
        },
      },
    });

    if (!fullSlot || !fullSlot.shift) {
      throw new BadRequestException({
        message: 'Không tìm thấy thông tin ca trực',
      });
    }

    let stepKhamBenh = await this.prismaService.step.findFirst({
      where: {
        flow_id: step.flow_id,
        step_name: 'Khám bệnh',
      },
      include: {
        room: true,
        queues: true,
      },
    });

    if (stepKhamBenh) {
      const activeQueue = (stepKhamBenh.queues || []).find(
        (q) =>
          q.status !== QueueStatusEnum.FINISHED &&
          q.status !== QueueStatusEnum.CANCELLED,
      );
      if (activeQueue?.room_id) {
        return {
          code: 200,
          message: 'Bạn đã có số khám bệnh',
          status: 'success',
          data: {
            slot: slot,
            room: stepKhamBenh.room,
            specialty: stepKhamBenh.room?.specialty_id,
            queue: activeQueue,
          },
        };
      }
    }

    if (!stepKhamBenh) {
      stepKhamBenh = await this.prismaService.step.create({
        data: {
          flow_id: step.flow_id,
          room_id: fullSlot.shift.room_id,
          staff_id: fullSlot.shift.staff_id,
          step_name: 'Khám bệnh',
          step_status: StepStatusEnum.PENDING,
          step_type: StepTypeEnum.CLINICAL,
        },
        include: {
          room: true,
          queues: true,
        },
      });
    } else if (!stepKhamBenh.room_id) {
      stepKhamBenh = await this.prismaService.step.update({
        where: { step_id: stepKhamBenh.step_id },
        data: {
          room_id: fullSlot.shift.room_id,
          staff_id: fullSlot.shift.staff_id,
        },
        include: {
          room: true,
          queues: true,
        },
      });
    }

    const queue = await this.queueService.enqueueStep(
      stepKhamBenh.step_id,
      QueueTypeEnum.APPOINTMENT,
      undefined,
      { forceType: true },
    );

    if (step.flow_id) {
      await this.prismaService.flow.update({
        where: { flow_id: step.flow_id },
        data: { status: FlowStatusEnum.IN_PROGRESS },
      });

      const bookingId = serviceOrder.booking_id;
      const patientId = serviceOrder.booking?.patient_id;
      if (bookingId && patientId) {
        const existingSession =
          await this.prismaService.visit_Session.findUnique({
            where: { booking_id: bookingId },
          });
        if (!existingSession) {
          await this.prismaService.visit_Session.create({
            data: {
              patient_id: patientId,
              booking_id: bookingId,
            },
          });
        }
      }
    }

    return {
      code: 200,
      status: 'success',
      message: 'Bạn đã lấy số thứ tự thành công',
      data: {
        slot: slot,
        room: fullSlot.shift.room,
        specialty: fullSlot.shift.room?.specialty_id,
        queue: queue,
      },
    };
  }

  async findAll() {
    try {
      const data = await this.bookingRepository.findMany();
      if (!data) {
        throw new NotFoundException({
          message: 'Danh sách rỗng',
          detail: `Không tìm thấy lịch hẹn trong hệ thống`,
        });
      }
      return {
        code: 200,
        status: 'success',
        message: 'Lấy toàn bộ danh sách thành công',
        data: data,
      };
    } catch (error) {
      throw error;
    }
  }

  async findOne(id: string) {
    try {
      const data = await this.bookingRepository.findOne(id);

      if (!data) {
        throw new NotFoundException({
          message: 'Danh sách rỗng',
          detail: `Không tìm thấy lịch hẹn với id ${id}`,
        });
      }
      return {
        code: 200,
        status: 'success',
        message: 'Lấy toàn bộ danh sách thành công',
        data: data,
      };
    } catch (error) {
      throw error;
    }
  }

  async bookingWithSpecialty(bookingSpecialtyDto: BookingSpecialtyDto) {
    const { interview_token, patient_id } = bookingSpecialtyDto;
    const exitedTriageInformation =
      await this.triageInformationRepository.findOneByInterviewToken(
        interview_token,
      );

    if (!exitedTriageInformation) {
      throw new NotFoundException({
        detail: 'Không tìm thấy chuẩn đoán bệnh trong hệ thống',
        message: 'Không tìm thấy chuẩn đoán bệnh trong hệ thống',
      });
    }

    if (!exitedTriageInformation.specialty_id) {
      throw new NotFoundException({
        detail: 'Không tìm thấy chuyên khoa trong chuẩn đoán',
        message: 'Không tìm thấy chuyên khoa trong chuẩn đoán',
      });
    }
    const timeZone = 'Asia/Ho_Chi_Minh';
    const now = new Date();

    const currentHours = formatInTimeZone(now, timeZone, 'HH:mm');

    const todayDateString = formatInTimeZone(now, timeZone, 'yyyy-MM-dd');
    const startOfToday = toDate(`${todayDateString}T00:00:00`, { timeZone });

    const availableSlots = await this.SlotRepository.findAvailableSlots(
      exitedTriageInformation.specialty_id,
      currentHours,
      startOfToday,
    );

    if (!availableSlots || availableSlots.length === 0) {
      throw new NotFoundException({
        detail: 'Hiện tại đã hết slot trống cho chuyên khoa này',
        message: 'Không tìm thấy slot trong hệ thống',
      });
    }

    const bestSlot = availableSlots[0];

    const createBookingData: CreateBookingRequestDto = {
      patient_id: patient_id,
      slot_id: bestSlot.slot_id,
    };

    return await this.create(createBookingData);
  }

  async createBookingWithPackage(dto: CreateBookingWithPackageDto) {
    const { patient_id, slot_id, package_id, return_url, cancel_url } = dto;

    const [patient, slot] = await Promise.all([
      this.patientRepository.findOne(patient_id),
      this.SlotRepository.findAvailableBySlotId(slot_id),
    ]);

    if (!patient) {
      throw new NotFoundException({
        message: 'Không tìm thấy bệnh nhân',
        detail: `Không tìm thấy bệnh nhân với id ${patient_id}`,
      });
    }

    if (!slot) {
      throw SlotErrors.NotFoundAvailableSlot(slot_id)
    }

    const flowInProgress = await this.flowRepository.findIsActiveByDate(
      patient_id,
      slot.shift.date,
    );

    if (flowInProgress.length > 0) {
      throw new BadRequestException({
        message: 'Bệnh nhân đã đặt khám trong ngày hôm này',
        detail: `Bênh nhân với id ${patient_id} đang có lịch khám trong ngày hôm nay`,
      });
    }

    const examPackage = await this.prismaService.exam_Package.findUnique({
      where: { package_id },
    });

    if (!examPackage) {
      throw new NotFoundException({
        message: 'Không tìm thấy gói khám',
        detail: `Không tìm thấy gói khám với id ${package_id}`,
      });
    }

    const packagePrice = examPackage.price || 0;

    const rs = await this.prismaService.$transaction(async (tx) => {
      const booking = await this.bookingRepository.create(
        { patient_id, slot_id },
        tx,
      );

      await this.SlotRepository.update(
        slot_id,
        { capacity: { decrement: 1 } },
        tx,
      );

      const serviceOrder = await tx.service_Order.create({
        data: {
          booking_id: booking.booking_id,
          name: `Thanh toán gói: ${examPackage.package_name}`,
          status: 'PENDING',
          payment_status: 'PENDING',
          package_id: package_id,
        },
      });

      const invoice = await tx.invoice.create({
        data: {
          service_order_id: serviceOrder.service_order_id,
          status: 'PENDING',
          total_amount: packagePrice,
        },
      });

      await tx.invoice_Detail.create({
        data: {
          invoice_id: invoice.invoice_id,
          item_name: examPackage.package_name,
          quantity: 1,
          unit_price: packagePrice,
          sub_total: packagePrice,
        },
      });

      const paymentLink = await this.transactionService.create(
        {
          cancelUrl: cancel_url || 'https://triageflow.me',
          returnUrl: return_url || 'https://triageflow.me',
          transType: TransTypeEnum.BOOKING_PAYMENT_1,
          amount: packagePrice > 0 ? packagePrice : 1000,
          clientId: patient_id,
          service_order_id: serviceOrder.service_order_id,
        },
        tx,
      );

      if (!paymentLink || !('data' in paymentLink)) {
        throw new BadRequestException(
          (paymentLink?.detail as any)?.error?.desc ||
          'Lỗi tạo giao dịch thanh toán',
        );
      }

      await tx.service_Order.update({
        where: { service_order_id: serviceOrder.service_order_id },
        data: { qr_code: paymentLink.data.qrCode },
      });

      return { booking, serviceOrder, paymentLink };
    });

    return {
      code: 200,
      message:
        'Tạo đơn gói khám thành công. Vui lòng thanh toán để tạo lịch khám.',
      status: 'success',
      data: {
        booking_id: rs.booking.booking_id,
        service_order_id: rs.serviceOrder.service_order_id,
        package_name: examPackage.package_name,
        amount: packagePrice,
        payment: rs.paymentLink,
      },
    };
  }
}
