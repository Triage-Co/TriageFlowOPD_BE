import { BadRequestException, Injectable } from '@nestjs/common';
import { CreateBookingDto } from './dto/request-booking.dto';
import { PrismaConfig } from '../../shared/config/prisma.config';

@Injectable()
export class BookingService {
  constructor(private readonly pismaClient: PrismaConfig) {}

  async create(createBookingDto: CreateBookingDto) {
    try {
      const exitedShift = await this.pismaClient.shift.findFirst({
        where: {
          id: createBookingDto.shiftId,
        },
      });

      if (!exitedShift) {
        return {
          code: '404',
          message: 'Không tồn tại ca trực',
          status: 'error',
        };
      }
      if (exitedShift.capacity <= 0) {
        return {
          code: 400,
          message: 'Không thể đặt lịch, ca trực đã hết chỗ',
          status: 'error',
        };
      }

      const exitedBooking = await this.pismaClient.booking.findUnique({
        where: {
          userId_shiftId: {
            userId: createBookingDto.userId,
            shiftId: createBookingDto.shiftId,
          },
        },
        include: {
          shift: true,
        },
      });

      if (exitedBooking) {
        return {
          code: 400,
          message: `Bạn đã đặt lịch vào ngày ${exitedBooking.shift.date.toISOString().split('T')[0]} lúc ${exitedBooking.shift.startTime}-${exitedBooking.shift.endTime}`,
          status: 'error',
        };
      }

      const data = await this.pismaClient.booking.create({
        data: {
          userId: createBookingDto.userId,
          shiftId: createBookingDto.shiftId,
        },
        include: {
          shift: true,
        },
      });

      if (data) {
        await this.pismaClient.shift.update({
          where: {
            id: data.shiftId,
          },
          data: {
            capacity: {
              decrement: 1,
            },
          },
        });

        const flowData = await this.pismaClient.flow.create({
          data: {
            name: `FLOW_${data.userId}_${data.shift.date.toISOString().split('T')[0]}`,
            userId: createBookingDto.userId,
          },
        });
        if (!flowData) {
          return {
            code: 400,
            message: 'Đã tạo lịch thành công, tạo flow thất bại',
            status: 'error',
          };
        } else {
          const stepData = await this.pismaClient.step.create({
            data: {
              name: 'Đặt lịch',
              description: `Đặt lịch khám bệnh ngày ${data.shift.date.toISOString().split('T')[0]} lúc ${data.shift.startTime}-${data.shift.endTime}`,
              flowId: flowData.id,
              number: 1,
            },
          });
          if (!stepData) {
            return {
              code: 400,
              message:
                'Đã tạo lịch thành công, tạo flow thành công, tạo step thất bại',
              status: 'error',
            };
          }
        }
      }

      return {
        code: 200,
        message: 'Tạo lịch hẹn thành công',
        status: 'success',
        data: data,
      };
    } catch (error) {
      return {
        code: 500,
        message: error,
        status: 'error',
      };
    }
  }

  async findOne(id: string) {
    try {
      const data = await this.pismaClient.booking.findFirst({
        where: {
          id: id,
        },
        select: {
          id: true,
          patient: {
            select: {
              id: true,
              full_name: true,
              email: true,
              dob: true,
              role: true,
              gender: true,
              citizen_id: true,
            },
          },
          shift: {
            select: {
              date: true,
              startTime: true,
              endTime: true,
              doctors: {
                select: {
                  specialty: {
                    select: {
                      name: true,
                    },
                  },
                  doctor: {
                    select: {
                      full_name: true,
                      email: true,
                      gender: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

      if (!data) {
        throw new BadRequestException('Không tìm thấy lịch hẹn');
      }

      return {
        code: 200,
        message: 'Lấy danh sách lịch hẹn theo id thành công',
        status: 'success',
        data: data,
      };
    } catch (error) {
      return {
        code: 500,
        message: error instanceof Error ? error.message : 'Unknown error',
        status: 'error',
      };
    }
  }

  async findMany() {
    try {
      const data = await this.pismaClient.booking.findMany({
        select: {
          id: true,
          shift: {
            select: {
              date: true,
              startTime: true,
              endTime: true,
            },
          },
          patient: {
            select: {
              full_name: true,
            },
          },
        },
      });

      if (!data) {
        throw new BadRequestException('Không tìm thấy lịch hẹn');
      }

      return {
        code: 200,
        message: 'Lấy danh sách lịch hẹn thành công',
        status: 'success',
        data: data,
      };
    } catch (error) {
      return {
        code: 500,
        message: error instanceof Error ? error.message : 'Unknown error',
        status: 'error',
      };
    }
  }
}
