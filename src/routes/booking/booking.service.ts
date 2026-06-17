import { Injectable } from '@nestjs/common';
import { CreateBookingDto } from './dto/request-booking.dto';
import { PrismaConfig } from '../../shared/config/prisma.config';

@Injectable()
export class BookingService {

  constructor(private readonly pismaClient: PrismaConfig) { }

  async create(createBookingDto: CreateBookingDto) {
    try {

      const exitedShift = await this.pismaClient.shift.findFirst({
        where: {
          id: createBookingDto.shiftId
        }
      })

      if (!exitedShift) {
        return {
          code: "404",
          message: "Không tồn tại ca trực",
          status: "error"
        }
      }
      if (exitedShift.capacity <= 0) {
        return {
          code: 400,
          message: "Không thể đặt lịch, ca trực đã hết chỗ",
          status: "error"
        };
      }

      const exitedBooking = await this.pismaClient.booking.findUnique({
        where: {
          userId_shiftId: {
            userId: createBookingDto.userId,
            shiftId: createBookingDto.shiftId
          }
        },
        include: {
          shift: true
        }
      })

      if (exitedBooking) {
        return {
          code: 400,
          message: `Bạn đã đặt lịch vào ngày ${(exitedBooking.shift.date).toISOString().split("T")[0]} lúc ${exitedBooking.shift.startTime}-${exitedBooking.shift.endTime}`,
          status: "error"
        };
      }

      const data = await this.pismaClient.booking.create({
        data: {
          userId: createBookingDto.userId,
          shiftId: createBookingDto.shiftId
        }
      })


      if (data) {
        await this.pismaClient.shift.update({
          where: {
            id: data.shiftId
          }, data: {
            capacity: {
              decrement: 1
            }
          }
        })
      }

      return {
        code: 200,
        message: "Tạo lịch hẹn thành công",
        status: "success",
        data: data
      }
    } catch (error) {
      return {
        code: 500,
        message: error,
        status: "error",
      }
    }
  }

}
