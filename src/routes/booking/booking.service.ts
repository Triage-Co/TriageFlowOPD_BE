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
  PaymentStatusEnum,
  PrismaClient,
  StepStatusEnum,
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

@Injectable()
export class BookingService {
  BOOKING: PrismaClient['booking'];
  SHIFT: PrismaClient['shift'];
  SLOT: PrismaClient['slot'];
  PATIENT: PrismaClient['patient'];
  FLOW: PrismaClient['flow'];
  STEP: PrismaClient['step'];
  QUEUE: PrismaClient['queue'];
  TRANSATION: PrismaClient['transaction'];
  SPECIALTY: PrismaClient['specialty'];
  TRIAGE_INFOR: PrismaClient['triage_Information'];
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
  ) {
    this.BOOKING = this.prismaService.booking;
    this.SHIFT = this.prismaService.shift;
    this.SLOT = this.prismaService.slot;
    this.PATIENT = this.prismaService.patient;
    this.FLOW = this.prismaService.flow;
    this.STEP = this.prismaService.step;
    this.QUEUE = this.prismaService.queue;
    this.TRANSATION = this.prismaService.transaction;
    this.SPECIALTY = this.prismaService.specialty;
    this.TRIAGE_INFOR = this.prismaService.triage_Information;
  }

  async create(createBookingRequestDto: CreateBookingRequestDto) {
    try {
      const { patient_id, slot_id } = createBookingRequestDto;

      const [existedPatient, existedSlot] = await Promise.all([
        this.PATIENT.findUnique({
          where: { patient_id },
          select: {
            patient_id: true,
            account_id: true,
          },
        }),
        this.SLOT.findUnique({
          where: { slot_id },
          select: {
            slot_id: true,
            capacity: true,
            start_time: true,
            end_time: true,
            shift: {
              select: {
                staff_id: true,
                room_id: true,
              },
            },
          },
        }),
      ]);

      if (!existedPatient) {
        throw new NotFoundException({
          message: 'Không tìm thấy bệnh nhân',
          detail: `Không tìm thấy bệnh nhân với id ${patient_id}`,
        });
      }

      if (!existedSlot) {
        throw new NotFoundException({
          message: 'Không tìm thấy slot',
          detail: `Không tìm thấy slot với id ${slot_id}`,
        });
      }

      if (existedSlot.capacity <= 0) {
        throw new BadRequestException({
          message: 'Hết slot trong khung giờ',
          detail: `Không còn slot trong khung giờ ${existedSlot.start_time}-${existedSlot.end_time}`,
        });
      }

      const createPaymentData = await this.transactionService.create({
        amount: 2000,
        cancelUrl:
          'https://www.triageflow.me/api-docs#/Staff/StaffController_create',
        returnUrl:
          'https://www.triageflow.me/api-docs#/Staff/StaffController_create',
        clientId: existedPatient.account_id,
        transType: 'APPOINTMENT_PAYMENT',
      });

      if (!createPaymentData || !('data' in createPaymentData)) {
        throw new BadRequestException(
          (createPaymentData?.detail as any).error?.desc ||
            'Lỗi tạo giao dịch thanh toán',
        );
      }
      const rs = await this.prismaService.$transaction(async (tx) => {
        const booking = await this.bookingRepository.create(
          createBookingRequestDto,
          tx,
        );

        const flow = await this.flowRepository.create(
          { booking_id: booking.booking_id },
          tx,
        );

        const shift = existedSlot.shift;

        if (!shift) {
          throw new NotFoundException('Không tìm thấy ca trực');
        }

        const step = await this.stepRepository.createParentStep(
          {
            flow_id: flow.flow_id,
            // room_id: shift.room_id,
            // staff_id: shift.staff_id,
            docNo: createPaymentData.data.orderCode,
            step_name: 'Đặt khám',
            step_status: StepStatusEnum.PENDING,
            payment_status: PaymentStatusEnum.PENDING,
            qr_text: createPaymentData.data.qrCode,
          },
          tx,
        );

        return {
          step_id: step.step_id,
          booking_id: booking.booking_id,
          payment: createPaymentData,
        };
      });

      return {
        code: 200,
        message: 'tạo lịch thành công',
        status: 'success',
        data: rs,
      };
    } catch (error) {
      throw error;
    }
  }

  async generateNumber(step_id: string) {
    try {
      const step = await this.STEP.findUnique({
        where: { step_id: step_id },
        include: {
          room: {
            include: {
              specialty: true,
            },
          },
          queues: true,
          flow: {
            include: {
              booking: {
                include: {
                  slot: {
                    include: {
                      shift: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

      if (!step) throw new NotFoundException('Không tìm thấy Step');

      if (step.payment_status !== 'SUCCESSED') {
        throw new BadRequestException(
          'Vui lòng thanh toán trước khi lấy số thứ tự',
        );
      }

      if (step.step_status == StepStatusEnum.COMPLETED) {
        const existingStepKhamBenh = await this.STEP.findFirst({
          where: {
            step_name: 'Khám bệnh',
            flow_id: step.flow_id,
          },
          include: {
            room: {
              include: {
                specialty: true,
              },
            },
            queues: true,
          },
        });

        return {
          code: 200,
          status: 'success',
          message: 'Bạn đã có số thứ tự',
          data: {
            slot: step.flow?.booking.slot,
            room: existingStepKhamBenh?.room,
            specialty: existingStepKhamBenh?.room?.specialty,
            queue: existingStepKhamBenh?.queues,
          },
        };
      }

      if (step.flow_id) {
        await this.FLOW.update({
          data: {
            status: 'IN_PROGRESS',
          },
          where: {
            flow_id: step.flow_id,
          },
        });

        await this.STEP.update({
          data: {
            step_status: 'COMPLETED',
          },
          where: {
            step_id: step_id,
          },
        });
      }

      if (step.queues.length > 0) {
        return {
          code: 200,
          status: 'success',
          message: 'Bạn đã có số thứ tự',
          data: {
            slot: step.flow?.booking.slot,
            room: step.room,
            specialty: step.room?.specialty,
            queue: step.queues,
          },
        };
      }

      const findSlotData = await this.SLOT.findFirst({
        where: {
          slot_id: step.flow?.booking.slot.slot_id,
        },
      });

      const countBookingData = await this.BOOKING.count({
        where: {
          slot_id: step.flow?.booking.slot.slot_id,
        },
      });

      const generateNumber =
        findSlotData?.slot_index! * findSlotData?.max_capacity! +
        countBookingData;

      await this.SLOT.update({
        where: {
          slot_id: findSlotData?.slot_id,
        },
        data: {
          capacity: {
            decrement: 1,
          },
        },
      });

      const shiftData = step.flow?.booking.slot.shift;
      const stepKhamBenh = await this.stepRepository.createParentStep({
        room_id: shiftData?.room_id,
        flow_id: step.flow_id,
        staff_id: shiftData?.staff_id,
        step_name: 'Khám bệnh',
        step_status: 'PENDING',
      });

      const createQueueData = await this.QUEUE.create({
        data: {
          step_id: stepKhamBenh.step_id,
          queue_number: generateNumber.toString(),
        },
        include: {
          step: {
            include: {
              room: {
                include: {
                  specialty: true,
                },
              },
              queues: true,
              flow: {
                include: {
                  booking: {
                    include: {
                      slot: {
                        include: {
                          shift: {
                            include: {
                              room: {
                                include: {
                                  specialty: true,
                                },
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      });

      if (createQueueData) {
        await this.notificationRepository.create({
          account_id: shiftData?.staff_id,
          message: `Bạn có lượt khám mới lúc ${findSlotData?.start_time} tại phòng ${step.room?.room_name} với số ${createQueueData.queue_number}`,
        });
      }

      return {
        code: 200,
        status: 'success',
        message: 'Bạn đã thanh toán',
        data: {
          slot: createQueueData.step.flow?.booking.slot,
          room: createQueueData.step.room,
          specialty: createQueueData.step.room?.specialty,
          queue: createQueueData.step.queues,
        },
      };
    } catch (error) {
      throw error;
    }
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
