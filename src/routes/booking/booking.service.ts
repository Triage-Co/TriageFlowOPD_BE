import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  BookingSpecialtyDto,
  CreateBookingRequestDto,
} from './dto/request-booking.dto';
import { PrismaService } from '../../shared/config/prisma.service';
import {
  ClinicalRoomType,
  FlowStatusEnum,
  PaymentStatusEnum,
  PrismaClient,
  QueueStatusEnum,
  ServiceOrderDetailStatusEnum,
  ServiceOrderStatusEnum,
  StepStatusEnum,
  StepTypeEnum,
  TransTypeEnum,
} from '@prisma/client';
import { formatInTimeZone, toDate } from 'date-fns-tz';
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
import type { IQueueRepository } from '../../shared/interfaces/i-queue.repository';

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
    @Inject('IQueueRepository')
    private readonly queueRepository: IQueueRepository,
  ) {}


  async create(createBookingData: CreateBookingRequestDto) {
    const { patient_id, slot_id } = createBookingData;

    const [patient, slot] = await Promise.all([
      this.patientRepository.findOne(patient_id),
      this.SlotRepository.findOne(slot_id),
    ]);

    if (!patient) {
      throw new NotFoundException({
        message: 'Không tìm thấy bệnh nhân',
        detail: `Không tìm thấy bệnh nhân với id ${patient_id}`,
      });
    }

    if (!slot) {
      throw new NotFoundException({
        message: 'Không tìm thấy slot',
        detail: `Không tìm thấy slot với id ${slot_id}`,
      });
    }

    if (slot.capacity <= 0) {
      throw new BadRequestException({
        message: 'Hết slot trong khung giờ',
        detail: `Không còn slot trong khung giờ ${slot.start_time}-${slot.end_time}`,
      });
    }

    const [roomByType, service] = await Promise.all([
      this.roomRepository.findByType(ClinicalRoomType.CASHIER),
      this.serviceRepository.findByServiceCode('DAT_KHAM_CHUYEN_KHOA'),
    ]);
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

      const flow = await this.flowRepository.create(
        {
          booking_id: booking.booking_id,
          status: FlowStatusEnum.PENDING,
        },
        tx,
      );

      const serviceOrder = await this.serviceOrderRepository.create(
        {
          booking_id: booking.booking_id,
          name: 'Thanh toán ' + (service?.service_name || 'khám chuyên khoa'),
          payment_status: PaymentStatusEnum.PENDING,
          status: ServiceOrderStatusEnum.PENDING,
        },
        tx,
      );

      await this.serviceOrderDetailRepository.create(
        {
          price_at_order: service?.price || 2000,
          quantity: 1,
          service_id: service?.service_id || null,
          service_order_id: serviceOrder.service_order_id,
        },
        tx,
      );
      

      const paymentLink = await this.transactionService.create(
        {
          cancelUrl: 'https://triageflow.me/api-docs',
          returnUrl: 'https://triageflow.me/api-docs',
          transType: TransTypeEnum.APPOINTMENT_PAYMENT,
          amount: service?.price || 2000,
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
        roomByType && roomByType.length > 0 ? roomByType[0].room_id : null;

      const step_1 = await this.stepRepository.createParentStep(
        {
          step_name: 'Thanh toán khám chuyên khoa',
          flow_id: flow.flow_id,
          room_id: roomId,
          step_type: StepTypeEnum.PAYMENT,
          service_code: service ? service.service_code : null,
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
      return { serviceOrder, step_1, booking, paymentLink };
    });

    return {
      code: 200,
      message: 'tạo lịch thành công',
      status: 'success',
      data: {
        step_id: rs.step_1.step_id,
        booking_id: rs.booking.booking_id,
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
      throw new BadRequestException({ message: 'Không tìm thấy thông tin ca trực' });
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

    if (stepKhamBenh && stepKhamBenh.queues.length > 0) {
      return {
        code: 200,
        message: 'Bạn đã có số khám bệnh',
        status: 'success',
        data: {
          slot: slot,
          room: stepKhamBenh.room,
          specialty: stepKhamBenh.room?.specialty_id,
          queue: stepKhamBenh.queues[0],
        },
      };
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
    }

    const maxCapacity = Number(fullSlot.max_capacity || 10);
    const index = Number(fullSlot.slot_index || 0);
    const slotIsBooking = await this.bookingRepository.countBySlotId(slot.slot_id);
    const number: number = index * maxCapacity + slotIsBooking;

    const queue = await this.queueRepository.create({
      queue_number: `A-${number}`,
      step_id: stepKhamBenh.step_id,
      status: QueueStatusEnum.QUEUED,
    });

    if (step.flow_id) {
      await this.prismaService.flow.update({
        where: { flow_id: step.flow_id },
        data: { status: FlowStatusEnum.IN_PROGRESS },
      });

      const bookingId = serviceOrder.booking_id;
      const patientId = serviceOrder.booking?.patient_id;
      if (bookingId && patientId) {
        const existingSession = await this.prismaService.visit_Session.findUnique({
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
}
