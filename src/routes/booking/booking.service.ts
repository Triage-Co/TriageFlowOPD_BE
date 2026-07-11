import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  BookingSpecialtyDto,
  CreateBookingRequestDto,
  UpdateBookingRequestDto,
} from './dto/request-booking.dto';
import { PrismaService } from '../../shared/config/prisma.service';
import { PrismaClient } from '@prisma/client';
import { TransactionService } from '../transaction/transaction.service';
import type { INotificationRepository } from '../../shared/interfaces/i-notification.repository';
import type { IPatientRepository } from '../../shared/interfaces/i-patient.repository';

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
      const exitedPatient = await this.PATIENT.findUnique({
        where: {
          patient_id: createBookingRequestDto.patient_id,
        },
      });

      if (!exitedPatient) {
        throw new NotFoundException({
          message: 'Không tìm thấy bệnh nhân',
          detail: `Không tìm thấy bệnh nhân với id ${createBookingRequestDto.patient_id}`,
        });
      }

      const exitedSlot = await this.SLOT.findUnique({
        where: {
          slot_id: createBookingRequestDto.slot_id,
        },
        include: {
          shift: {
            include: {
              slots: {
                orderBy: {
                  start_time: 'asc',
                },
              },
            },
          },
        },
      });

      if (!exitedSlot) {
        throw new NotFoundException({
          message: 'Không tìm thấy slot',
          detail: `Không tìm thấy slot với id ${createBookingRequestDto.slot_id}`,
        });
      }

      if (exitedSlot?.capacity! <= 0) {
        throw new BadRequestException({
          message: 'Hết slot trong khung giờ',
          detail: `Không còn slot trong khung giờ ${exitedSlot.start_time}-${exitedSlot.end_time}`,
        });
      }

      const data = await this.BOOKING.create({
        data: {
          ...createBookingRequestDto,
        },
      });

      const createFlowData = await this.FLOW.create({
        data: {
          booking_id: data.booking_id,
        },
        include: {
          booking: {
            include: {
              slot: true,
            },
          },
        },
      });

      const existedShiftData = await this.SHIFT.findFirst({
        where: {
          shift_id: createFlowData.booking.slot.shift_id,
        },
      });

      // const slotIndex = exitedSlot.shift.slots.findIndex(
      //   (s) => s.slot_id === createBookingRequestDto.slot_id
      // );

      // const MAX_CAPACITY_PER_SLOT = 10;
      // const orderInCurrentSlot = MAX_CAPACITY_PER_SLOT - exitedSlot.capacity + 1;

      // const generatedQueueNumber = (slotIndex * MAX_CAPACITY_PER_SLOT) + orderInCurrentSlot;

      const createPaymentData = await this.transactionService.create({
        amount: 2000,
        cancelUrl:
          'https://www.youtube.com/watch?v=d2icAj6DPZI&list=RDd2icAj6DPZI&start_radio=1',
        returnUrl:
          'https://www.youtube.com/watch?v=d2icAj6DPZI&list=RDd2icAj6DPZI&start_radio=1',
        clientId: exitedPatient.account_id,
        transType: 'APPOINTMENT_PAYMENT',
      });

      if (!('data' in createPaymentData)) {
        return (createPaymentData?.detail as any).error?.desc || createFlowData;
      }

      const createStepData = await this.STEP.create({
        data: {
          flow_id: createFlowData.flow_id,
          room_id: existedShiftData?.room_id,
          staff_id: existedShiftData?.staff_id,
          docNo: createPaymentData.data.orderCode,
          payment_status: 'PENDING',
        },
      });

      // await this.QUEUE.create({
      //   data: {
      //     step_id: createStepData.step_id,
      //     queue_number: generatedQueueNumber + ""
      //   }
      // })

      return {
        code: 200,
        message: 'tạo lịch thành công',
        status: 'success',
        data: {
          step_id: createStepData.step_id,
          data,
          payment: createPaymentData,
        },
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
          room: true,
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

      if (!step) throw new NotFoundException('Không tìm thấy Step');

      console.log(step.payment_status);
      if (step.payment_status !== 'SUCCESSED') {
        throw new BadRequestException(
          'Vui lòng thanh toán trước khi lấy số thứ tự',
        );
      }

      if (step.queues.length > 0) {
        return {
          code: 200,
          status: 'success',
          message: 'Bạn đã có số thứ tự',
          data: step.queues,
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

      const createQueueData = await this.QUEUE.create({
        data: {
          step_id: step_id,
          queue_number: generateNumber + '',
        },
      });

      if (createQueueData) {
        await this.notificationRepository.create({
          account_id: step.staff_id,
          message: `Bạn có lượt khám mới lúc ${findSlotData?.start_time} tại phòng ${step.room?.room_name} với số ${createQueueData.queue_number}`,
        });
      }

      return {
        code: 200,
        status: 'success',
        message: 'Bạn đã thanh toán',
        data: createQueueData,
      };
    } catch (error) {
      throw error;
    }
  }

  async findAll() {
    try {
      const data = await this.BOOKING.findMany();
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
      const data = await this.BOOKING.findUnique({
        where: {
          booking_id: id,
        },
      });

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
    const exitedTriageInfor = await this.TRIAGE_INFOR.findFirst({
      where: {
        interview_token: bookingSpecialtyDto.interview_token,
      },
    });

    if (!exitedTriageInfor) {
      throw new NotFoundException({
        detail: 'Không tìm thấy chuẩn đoán bệnh trong hệ thống',
        message: 'Không tìm thấy chuẩn đoán bệnh trong hệ thống',
      });
    }

    console.log(exitedTriageInfor.specialty_id);
    const currentDate = new Date();
    const currentHours = `${currentDate.getHours().toString().padStart(2, '0')}:${currentDate.getMinutes().toString().padStart(2, '0')}`;

    console.log(currentHours);

    const availableSlots = await this.SLOT.findMany({
      where: {
        start_time: {
          gte: currentHours,
        },
        capacity: {
          gt: 0,
        },
        shift: {
          room: {
            specialty_id: exitedTriageInfor.specialty_id,
          },
        },
      },
      include: {
        shift: {
          include: {
            room: true,
          },
        },
      },
      orderBy: [
        {
          start_time: 'asc',
        },
        {
          capacity: 'desc',
        },
      ],
    });

    if (!availableSlots || availableSlots.length === 0) {
      throw new NotFoundException({
        detail: 'Hiện tại đã hết slot trống cho chuyên khoa này',
        message: 'Không tìm thấy slot trong hệ thống',
      });
    }

    const bestSlot = availableSlots[0];

    const createBookingData: CreateBookingRequestDto = {
      patient_id: bookingSpecialtyDto.patient_id,
      slot_id: bestSlot.slot_id,
    };

    return await this.create(createBookingData);
  }
}
