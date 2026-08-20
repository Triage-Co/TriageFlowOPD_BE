import { Prisma, Booking, Shift } from '@prisma/client';
import { IBookingRepository } from '../interfaces/i-booking.repository';
import { PrismaService } from '../config/prisma.service';
import { IShiftRepository } from '../interfaces/i-shift.repository';
import { Injectable } from '@nestjs/common';
import { formatInTimeZone, toDate } from 'date-fns-tz';

const TIME_ZONE = 'Asia/Ho_Chi_Minh';
@Injectable()
export class PrismaShiftRepository implements IShiftRepository {
  constructor(private readonly prismaService: PrismaService) {}
  create(
    data: Prisma.ShiftUncheckedCreateInput,
    tx?: Prisma.TransactionClient,
  ): Promise<Shift> {
    const db = tx || this.prismaService;
    return db.shift.create({
      data,
    });
  }

  async findAll(
    page?: number,
    limit?: number,
    search?: string,
    staff_id?: string,
    room_id?: string,
    date?: string,
    start_time?: string,
    end_time?: string,
  ): Promise<any> {
    const skip =
      page && limit && page > 0 && limit > 0
        ? (Number(page) - 1) * Number(limit)
        : undefined;
    const take = limit && limit > 0 ? Number(limit) : undefined;

    const whereCondition: Prisma.ShiftWhereInput = {};

    if (search) {
      whereCondition.OR = [
        { staff: { full_name: { contains: search, mode: 'insensitive' } } },
        {
          staff: {
            account: { email: { contains: search, mode: 'insensitive' } },
          },
        },
        { room: { room_name: { contains: search, mode: 'insensitive' } } },
      ];
    }

    if (staff_id) whereCondition.staff_id = staff_id;
    if (room_id) whereCondition.room_id = room_id;
    if (start_time) whereCondition.start_time = start_time;
    if (end_time) whereCondition.end_time = end_time;

    if (date) {
      const dateFormatted = formatInTimeZone(
        new Date(date),
        TIME_ZONE,
        'yyyy-MM-dd',
      );
      const startOfDay = toDate(`${dateFormatted}T00:00:00`, {
        timeZone: TIME_ZONE,
      });
      const endOfDay = toDate(`${dateFormatted}T23:59:59.999`, {
        timeZone: TIME_ZONE,
      });
      whereCondition.date = { gte: startOfDay, lte: endOfDay };
    }

    const [data, total] = await Promise.all([
      this.prismaService.shift.findMany({
        where: whereCondition,
        skip,
        ...(take ? { take } : {}),
        include: {
          room: {
            include: {
              specialty: true,
            },
          },
          staff: {
            select: {
              full_name: true,
              account: {
                select: {
                  email: true,
                },
              },
            },
          },
        },
        orderBy: { date: 'desc' },
      }),
      this.prismaService.shift.count({ where: whereCondition }),
    ]);

    const formattedData = data.map((shift) => ({
      ...shift,
      date: formatInTimeZone(shift.date, TIME_ZONE, 'yyyy-MM-dd'),
    }));

    return {
      data: formattedData,
      meta: {
        total,
        page: Number(page) || 1,
        limit: Number(limit) || total,
        totalPages: take ? Math.ceil(total / take) : 1,
      },
    };
  }
}
